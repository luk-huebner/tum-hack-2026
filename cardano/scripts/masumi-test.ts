// Drives the Masumi agent (src/masumi-agent.ts) against a stand-in for the Masumi payment service, in one process, with no
// network and no money:   node_modules/.bin/tsx scripts/masumi-test.ts
// It checks the MIP-003 routes, the refusals, the payment request the agent sends, the job life cycle up to "completed" and the
// result hash it submits. It does NOT prove that a real Masumi payment service accepts the requests: that needs the real service.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { USDM, inputHash, makeMps, masumiRoutes, resultHash, type Outcome, type PolicyCheck } from "../src/masumi-agent.js";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
};
const listen = (app: express.Express): Promise<{ server: Server; url: string }> =>
  new Promise((resolve) => {
    const server = createServer(app).listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }));
  });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (f: () => Promise<boolean> | boolean, ms = 4000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await f()) return true;
    await sleep(40);
  }
  return false;
};

// ---- a stand-in for the Masumi payment service
interface Pay {
  body: Record<string, unknown>;
  state: string;
  resultHash?: string;
}
const payments = new Map<string, Pay>();
const received: string[] = [];
const mpsApp = express();
mpsApp.use(express.json());
mpsApp.use((req, res, next) => {
  if (req.headers.token !== "test-token") return void res.status(401).json({ status: "error" });
  received.push(req.path);
  next();
});
mpsApp.post("/api/v1/payment", (req, res) => {
  const id = `bc-${payments.size + 1}`;
  payments.set(id, { body: req.body, state: "WaitingForExternalAction" });
  const b = req.body as Record<string, string>;
  res.json({ status: "success", data: { blockchainIdentifier: id, payByTime: Date.parse(b.payByTime), submitResultTime: Date.parse(b.submitResultTime), unlockTime: Date.parse(b.unlockTime), externalDisputeUnlockTime: Date.parse(b.externalDisputeUnlockTime) } });
});
mpsApp.post("/api/v1/payment/resolve-blockchain-identifier", (req, res) => {
  const p = payments.get(String(req.body.blockchainIdentifier));
  if (!p) return void res.status(404).json({ status: "error" });
  res.json({ status: "success", data: { onChainState: p.state, resultHash: p.resultHash, CurrentTransaction: { status: "Confirmed", newOnChainState: p.state }, TransactionHistory: [] } });
});
mpsApp.post("/api/v1/payment/submit-result", (req, res) => {
  const p = payments.get(String(req.body.blockchainIdentifier));
  if (!p) return void res.status(404).json({ status: "error" });
  p.resultHash = String(req.body.submitResultHash);
  p.state = "ResultSubmitted";
  res.json({ status: "success", data: {} });
});
const mps = await listen(mpsApp);

// ---- the agent, with a fake chain
let outcome: Outcome = { state: "open" };
let clock = 0;
const A = `${"a".repeat(64)}#0`;
const checkPolicy = async (ref: string): Promise<PolicyCheck> => {
  if (ref === A) return { ok: true, deadlineMs: Date.now() + clock + 2 * 3600_000, rule: "rule" };
  if (ref.startsWith("b")) return { ok: false, reason: "The keeper does not serve this escrow" };
  return { ok: true, deadlineMs: Date.now() + clock + 10 * 60_000, rule: "rule" };
};
const agent = masumiRoutes({
  mps: makeMps(mps.url, "test-token"),
  registration: { agentIdentifier: "agent-1", sellerVKey: "vkey-1", supportedPaymentSourceIndex: 0 },
  checkPolicy,
  outcomeOf: async () => outcome,
  pollMs: 40,
  now: () => Date.now() + clock,
});
const app = express();
app.use("/masumi", agent.router);
const svc = await listen(app);
const base = `${svc.url}/masumi`;
const get = async (path: string) => {
  const r = await fetch(`${base}${path}`);
  return { status: r.status, body: (await r.json()) as Record<string, unknown> };
};
const post = async (path: string, body: unknown) => {
  const r = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, body: (await r.json()) as Record<string, unknown> };
};

const availability = await get("/availability");
check("availability", availability.body.status === "available" && availability.body.type === "masumi-agent");
const schema = await get("/input_schema");
check("input_schema has one string field", Array.isArray(schema.body.input_data) && (schema.body.input_data as { id: string }[])[0]?.id === "policy");

const nonce = "0123456789abcdef0123";
check("a short identifier is refused", (await post("/start_job", { identifier_from_purchaser: "abc", input_data: { policy: A } })).status === 400);
check("an input with another key is refused", (await post("/start_job", { identifier_from_purchaser: nonce, input_data: { policy: A, extra: 1 } })).status === 400);
check("a bad escrow reference is refused", (await post("/start_job", { identifier_from_purchaser: nonce, input_data: { policy: "nope" } })).status === 400);
const refused = await post("/start_job", { identifier_from_purchaser: nonce, input_data: { policy: `${"b".repeat(64)}#0` } });
check("an escrow the keeper does not serve is refused, and no payment was requested", refused.status === 400 && payments.size === 0, String(refused.body.error));
check("an escrow too close to its deadline is refused", (await post("/start_job", { identifier_from_purchaser: nonce, input_data: { policy: `${"c".repeat(64)}#0` } })).status === 400);

const started = await post("/start_job", { identifier_from_purchaser: nonce, input_data: { policy: A } });
check("start_job answers with the payment fields", started.status === 200 && started.body.blockchainIdentifier === "bc-1" && started.body.agentIdentifier === "agent-1" && started.body.sellerVKey === "vkey-1" && typeof started.body.id === "string" && typeof started.body.submitResultTime === "number");
const sent = payments.get("bc-1")?.body as Record<string, unknown>;
const funds = (sent?.RequestedFunds as { unit: string; amount: string }[] | undefined)?.[0];
check("the payment request asks for tUSDM and carries the input hash", funds?.unit === USDM && funds?.amount === "1000000" && sent?.inputHash === inputHash({ policy: A }, nonce) && sent?.identifierFromPurchaser === nonce && sent?.paymentSourceType === "Web3CardanoV2");
check("the submit time is the escrow's deadline minus 5 minutes, ahead of payByTime", Number(started.body.submitResultTime) > Number(started.body.payByTime) + 25 * 60_000);

const again = await post("/start_job", { identifier_from_purchaser: nonce, input_data: { policy: A } });
check("the same identifier and input returns the same answer, no second payment", again.status === 200 && again.body.id === started.body.id && payments.size === 1);
check("the same identifier with another input is refused", (await post("/start_job", { identifier_from_purchaser: nonce, input_data: { policy: `${"d".repeat(64)}#0` } })).status === 409);

const id = String(started.body.id);
check("status: awaiting_payment", (await get(`/status?job_id=${id}`)).body.status === "awaiting_payment");
payments.get("bc-1")!.state = "FundsLocked"; // the buyer pays into Masumi's escrow
check("status: running once the funds are locked", await until(async () => (await get(`/status?job_id=${id}`)).body.status === "running"));
await sleep(150);
check("still running while the escrow is open", (await get(`/status?job_id=${id}`)).body.status === "running");
outcome = { state: "released", tx: "ab".repeat(32) }; // the keeper released it
check("status: completed with a result", await until(async () => (await get(`/status?job_id=${id}`)).body.status === "completed"));
const done = await get(`/status?job_id=${id}`);
const result = String(done.body.result ?? "");
check("the result names the release transaction", result.includes("released") && result.includes("ab".repeat(32)));
check("the hash that was submitted is sha256(nonce;result)", payments.get("bc-1")?.resultHash === resultHash(result, nonce));
check("the agent called only the three payment-service routes", [...new Set(received)].sort().join(",") === "/api/v1/payment,/api/v1/payment/resolve-blockchain-identifier,/api/v1/payment/submit-result");

// a job that is never paid fails after its pay-by time
const nonce2 = "fedcba9876543210fedc";
const second = await post("/start_job", { identifier_from_purchaser: nonce2, input_data: { policy: A } });
clock += 20 * 60_000;
check("an unpaid job fails after the pay-by time", await until(async () => (await get(`/status?job_id=${String(second.body.id)}`)).body.status === "failed"));

check("status refuses a bad id and an unknown id", (await get("/status?job_id=zzz")).status === 400 && (await get(`/status?job_id=${"0".repeat(8)}-0000-0000-0000-${"0".repeat(12)}`)).status === 404);

// an agent without a payment service says so
const bare = masumiRoutes({ checkPolicy, outcomeOf: async () => outcome, pollMs: 1000 });
const bareApp = express();
bareApp.use("/masumi", bare.router);
const bareSvc = await listen(bareApp);
const bareStart = await fetch(`${bareSvc.url}/masumi/start_job`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier_from_purchaser: nonce, input_data: { policy: A } }) });
check("without a payment service start_job answers 503", bareStart.status === 503);
const bareAvail = (await (await fetch(`${bareSvc.url}/masumi/availability`)).json()) as { status: string };
check("and availability says unavailable", bareAvail.status === "unavailable");

agent.stop();
bare.stop();
for (const s of [mps.server, svc.server, bareSvc.server]) s.close();
console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);

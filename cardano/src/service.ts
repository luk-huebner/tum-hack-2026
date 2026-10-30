/**
 * Pay-on-Proof service on Cardano preprod: one process, two jobs.
 *
 *   POST /api/keep   a paid x402 job (2 tADA). The keeper fetches a fresh signed AirnodeHub response for a locked policy
 *                    and, if the rule holds, releases the policy's funds to its beneficiary. You are charged only when
 *                    it releases: any answer with a 4xx or 5xx status cancels the payment (see @x402/express).
 *   POST /api/escrow a paid x402 payment (5 tADA) that is locked straight into the validator: the Cardano x402 "script"
 *                    transfer method. The buyer names the refund address, a price threshold and a deadline; the datum
 *                    is built here (escrow.ts), the seller is the beneficiary. Nothing is sent to the chain by this
 *                    process: the buyer's payment transaction is submitted by the facilitator when it settles.
 *   POST /api/judge  free. Takes a signed response and a policy and answers with the validator's own verdict. It never
 *                    sends a transaction. The page at / drives it for the tamper test.
 *
 * The contract is the authority for both. This process only buys data, builds transactions and reports what the node's
 * script evaluation said. The operator wallet (SELLER_MNEMONIC) pays fees and collateral and never touches the funds.
 */
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express, { type Request, type Response } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactCardanoScheme } from "@x402/cardano/exact/server";
import { type SignedResponse, hexOf, makeClient, scriptHash, waitForTip } from "./engine.js";
import { ESCROW_LOVELACE, ESCROW_MAX_AGE_MS, offerExtra, parseOffer, validatorAddressBech32 } from "./escrow.js";
import {
  type Client,
  checkAgainst,
  evaluateRelease,
  evaluationWindow,
  fetchSigned,
  findPolicyUtxo,
  parseRef,
  parseSource,
  policyViewOf,
  releaseTx,
  submitWindow,
} from "./proof.js";

const payTo = process.env.SELLER_ADDRESS;
const facilitatorUrl = process.env.FACILITATOR_URL;
if (!payTo?.startsWith("addr_test1") || !facilitatorUrl) {
  console.error("Set SELLER_ADDRESS to a preprod address (addr_test1...) and FACILITATOR_URL in cardano/.env (see .env.example)");
  process.exit(1);
}

const NETWORK = "cardano:preprod" as const;
const PRICE_LOVELACE = "2000000"; // 2 tADA
const PAYMENT_WINDOW_SECONDS = 420; // a release waits for the chain tip, so the payment must outlive it
const ALLOW_PAID_SOURCES = process.env.ALLOW_PAID_SOURCES === "1"; // tweet sources cost 0.01 aUSD per call
const AUSD_CAP = Number(process.env.SERVICE_AUSD_CAP ?? "0.2"); // for the life of this process
let ausdSpent = 0;

const webDir = fileURLToPath(new URL("../web/", import.meta.url));
const vectorDir = new URL("../vectors/tamper/", import.meta.url);
const outDir = new URL("../out/", import.meta.url);
const jobsFile = new URL("service-jobs.jsonl", outDir);

interface Standing {
  name: string;
  ref: string;
  note: string;
}
const standing: Standing[] = JSON.parse(readFileSync(new URL("../standing-policies.json", import.meta.url), "utf8"));
const standingRef = (name: string) => standing.find((s) => s.name === name)?.ref;

let operatorClient: Client | undefined;
const operator = (): Client => (operatorClient ??= makeClient("SELLER_MNEMONIC"));

const jobs: Record<string, unknown>[] = [];
const recordJob = (entry: Record<string, unknown>) => {
  const row = { at: new Date().toISOString(), ...entry };
  jobs.unshift(row);
  jobs.length = Math.min(jobs.length, 20);
  try {
    mkdirSync(outDir, { recursive: true });
    appendFileSync(jobsFile, `${JSON.stringify(row)}\n`);
  } catch {
    // the page must keep working if the log cannot be written
  }
};

// ---------------------------------------------------------------------------
// Small guards: a per-client rate limit and a cap on parallel evaluations

const hits = new Map<string, number[]>();
const tooMany = (key: string, max: number, windowMs = 60_000): boolean => {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
};
let evaluating = 0;

const asSignedResponse = (value: unknown): SignedResponse => {
  const r = (value ?? {}) as Record<string, unknown>;
  const text = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : typeof r[k] === "number" ? String(r[k]) : "");
  const response = { airnode: text("airnode"), requestHash: text("requestHash"), timestamp: text("timestamp"), data: text("data"), signature: text("signature") };
  if (!/^0x[0-9a-fA-F]{40}$/.test(response.airnode)) throw new Error("airnode must be a 0x address");
  if (!/^0x[0-9a-fA-F]{64}$/.test(response.requestHash)) throw new Error("requestHash must be 0x followed by 64 hex characters");
  if (!/^\d{9,12}$/.test(response.timestamp)) throw new Error("timestamp must be unix seconds");
  if (!response.data || response.data.length > 8000) throw new Error("data must be the signed text (at most 8000 characters)");
  if (!/^0x[0-9a-fA-F]{128,130}$/.test(response.signature)) throw new Error("signature must be 0x followed by 128 or 130 hex characters");
  return response;
};

const policySummary = (utxo: Parameters<typeof policyViewOf>[0]) => {
  const p = policyViewOf(utxo);
  return {
    rule: `${p.cmp === "Below" ? "below" : "at least"} ${p.threshold / 10 ** p.scale}`,
    payoutTada: Number(p.payout) / 1_000_000,
    maxAgeSeconds: p.maxAgeMs / 1000,
    deadline: new Date(p.deadlineMs).toISOString(),
    requestHash: `0x${p.requestHashHex}`,
    signerKey: `0x${p.signerHex}`,
  };
};

// ---------------------------------------------------------------------------
// The paid job

const resourceServer = new x402ResourceServer(new HTTPFacilitatorClient({ url: facilitatorUrl }));
resourceServer.register(NETWORK, new ExactCardanoScheme());

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));

app.use(
  paymentMiddleware(
    {
      "POST /api/keep": {
        accepts: [{ scheme: "exact", network: NETWORK, price: { amount: PRICE_LOVELACE, asset: "lovelace" }, payTo, maxTimeoutSeconds: PAYMENT_WINDOW_SECONDS }],
        description: "Keeper job: fetch a fresh signed AirnodeHub response for a locked Pay-on-Proof policy and release its funds if the rule holds. Charged only on release.",
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

const inFlight = new Set<string>();

app.post("/api/keep", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { ref?: unknown; source?: unknown };
  let ref = "";
  try {
    const parsed = parseRef(String(body.ref ?? ""));
    ref = `${parsed.txHash}#${parsed.index}`;
  } catch (error) {
    return void res.status(400).json({ error: (error as Error).message, charged: false });
  }
  let source;
  try {
    source = parseSource(String(body.source ?? "nodary:ETH/USD"));
  } catch (error) {
    return void res.status(400).json({ error: (error as Error).message, charged: false });
  }
  if (source.costAusd > 0 && (!ALLOW_PAID_SOURCES || ausdSpent + source.costAusd > AUSD_CAP)) {
    return void res.status(403).json({ error: "This deployment only fetches free sources (nodary:<feed>), or its aUSD cap is used up.", charged: false });
  }
  if (inFlight.has(ref)) return void res.status(409).json({ error: "A job for this policy is already running.", charged: false });
  inFlight.add(ref);
  const started = Date.now();
  try {
    const client = operator();
    const utxo = await findPolicyUtxo(client, ref);
    if (!utxo) {
      recordJob({ ref, source: source.spec, outcome: "policy-not-found" });
      return void res.status(404).json({ error: "No such policy at the validator (already spent, or never locked).", charged: false });
    }
    const policy = policyViewOf(utxo);
    if (Date.now() > policy.deadlineMs - 3 * 60_000) {
      recordJob({ ref, source: source.spec, outcome: "deadline-too-close" });
      return void res.status(410).json({ error: "The policy's deadline is less than 3 minutes away or has passed; only a refund is possible.", charged: false });
    }
    const fetched = await fetchSigned(source);
    ausdSpent = Math.round((ausdSpent + fetched.spentAusd) * 1e4) / 1e4;
    const { response } = fetched;
    const check = checkAgainst(policy, response);
    if (!check.sameRequest) {
      recordJob({ ref, source: source.spec, outcome: "wrong-request" });
      return void res.status(422).json({ error: "This source does not answer the request the policy pins.", pinned: `0x${policy.requestHashHex}`, got: response.requestHash, charged: false });
    }
    if (!check.met) {
      recordJob({ ref, source: source.spec, outcome: "rule-not-met", value: check.value, threshold: check.threshold });
      return void res.status(409).json({ verdict: "rule-not-met", rule: policySummary(utxo).rule, value: check.value, threshold: check.threshold, signedAt: new Date(check.signedMs).toISOString(), evidence: response, charged: false });
    }
    const window = submitWindow(policy, check.signedMs);
    await waitForTip(window.from + 2_000, 120_000);
    const submitted = await (await releaseTx(client, utxo, policy, response, window)).signAndSubmit();
    const tx = hexOf(submitted.hash);
    recordJob({ ref, source: source.spec, outcome: "released", tx, value: check.value, seconds: Math.round((Date.now() - started) / 1000) });
    return void res.json({
      verdict: "released",
      tx,
      explorer: `https://preprod.cardanoscan.io/transaction/${tx}`,
      value: check.value,
      threshold: check.threshold,
      responseAgeSeconds: Math.round((Date.now() - check.signedMs) / 1000),
      payoutTada: Number(policy.payout) / 1_000_000,
      note: "Submitted; it lands in the next block. The payout goes to the policy's beneficiary, never to this service.",
      evidence: response,
    });
  } catch (error) {
    const message = String((error as Error)?.message ?? error).replace(/\s+/g, " ").slice(0, 200);
    recordJob({ ref, source: source.spec, outcome: "failed", error: message });
    return void res.status(502).json({ error: `The job failed before anything was released: ${message}`, charged: false });
  } finally {
    inFlight.delete(ref);
  }
});

// ---------------------------------------------------------------------------
// The escrow route: the x402 payment itself is locked at the validator

/**
 * The requirements for this route depend on the buyer's request (their refund address, threshold and deadline are in the
 * datum), so the payment middleware is built per request from the body. The same body gives the same datum, which is what
 * the paid retry needs: the facilitator and the middleware compare the requirements of the retry with those of the 402.
 * The shared resource server is already initialised by the middleware above.
 */
const escrowGate = (req: Request, res: Response, next: (error?: unknown) => void) => {
  let extra;
  try {
    extra = offerExtra(parseOffer(req.body, Date.now()));
  } catch (error) {
    return void res.status(400).json({ error: (error as Error).message, charged: false });
  }
  const routes = {
    "POST /api/escrow": {
      accepts: [
        {
          scheme: "exact",
          network: NETWORK,
          price: { amount: ESCROW_LOVELACE.toString(), asset: "lovelace" },
          payTo: validatorAddressBech32,
          maxTimeoutSeconds: PAYMENT_WINDOW_SECONDS,
          extra,
        },
      ],
      description: "Escrow: this payment is locked in the Pay-on-Proof validator and reaches the seller only when a signed AirnodeHub response proves the rule; otherwise you can refund after the deadline.",
      mimeType: "application/json",
    },
  };
  return paymentMiddleware(routes, resourceServer, undefined, undefined, false)(req, res, next);
};

app.post("/api/escrow", escrowGate, (req: Request, res: Response) => {
  // Runs after the payment was verified and before it is settled: the facilitator submits the payment transaction next.
  const offer = parseOffer(req.body, Date.now()); // the gate above validated this same body a moment ago
  recordJob({ route: "escrow", refund: offer.refund.slice(0, 18), atLeast: offer.atLeast, deadline: new Date(offer.deadlineMs).toISOString(), outcome: "payment-verified" });
  res.json({
    status: "accepted",
    lockedAt: validatorAddressBech32,
    payoutTada: Number(ESCROW_LOVELACE) / 1_000_000,
    rule: `ETH/USD at least ${offer.atLeast}, signed by the Nodary Airnode, not older than ${ESCROW_MAX_AGE_MS / 1000} s`,
    seller: "SELLER_ADDRESS (the beneficiary)",
    refundTo: offer.refund,
    refundAfter: new Date(offer.deadlineMs).toISOString(),
    next: "When the payment settles, your 5 tADA sits at the validator under this policy. Anyone with a matching signed response can release it to the seller; you can refund it after the deadline. Find it with the payment transaction hash.",
  });
});

// ---------------------------------------------------------------------------
// The judge bench

app.get("/api/policies", async (_req, res) => {
  const client = operator();
  const rows = [];
  for (const s of standing) {
    try {
      const utxo = await findPolicyUtxo(client, s.ref);
      rows.push(utxo ? { ...s, status: "open", ...policySummary(utxo) } : { ...s, status: "spent" });
    } catch (error) {
      rows.push({ ...s, status: "unavailable", error: String((error as Error).message).slice(0, 80) });
    }
  }
  res.json({ validator: { hash: scriptHash, network: "Cardano preprod" }, policies: rows });
});

/** The five tamper cases of the API3 track plus a control before and after, in the order the page runs them. */
const CASES = [
  { id: "control-first", label: "Real response (control)", file: "valid.json", policy: "bench-48h", expect: "ACCEPTED" },
  { id: "edited", label: "One value edited after signing", file: "edited.json", policy: "bench-48h", expect: "REJECTED" },
  { id: "stale", label: "Real response, but the policy allows only 5 minutes", file: "valid.json", policy: "bench-5min", expect: "REJECTED" },
  { id: "other-request", label: "A real response to a different request", file: "other-request.json", policy: "bench-48h", expect: "REJECTED" },
  { id: "foreign-signer", label: "Same data, signed by a key that is not the Airnode", file: "foreign-signer.json", policy: "bench-48h", expect: "REJECTED" },
  { id: "control-last", label: "Real response (control again)", file: "valid.json", policy: "bench-48h", expect: "ACCEPTED" },
];

app.get("/api/cases", (_req, res) => {
  res.json(
    CASES.map((c) => ({
      ...c,
      ref: standingRef(c.policy),
      response: JSON.parse(readFileSync(new URL(c.file, vectorDir), "utf8")),
    })),
  );
});

app.post("/api/judge", async (req: Request, res: Response) => {
  if (tooMany(`judge:${req.ip}`, 30)) return void res.status(429).json({ error: "Slow down: at most 30 evaluations a minute." });
  if (evaluating >= 3) return void res.status(429).json({ error: "The bench is busy; try again in a few seconds." });
  evaluating += 1;
  const started = Date.now();
  try {
    const { ref, response: raw } = (req.body ?? {}) as { ref?: unknown; response?: unknown };
    let parsed: SignedResponse;
    try {
      parseRef(String(ref ?? ""));
      parsed = asSignedResponse(typeof raw === "string" ? JSON.parse(raw) : raw);
    } catch (error) {
      return void res.status(400).json({ error: (error as Error).message });
    }
    const client = operator();
    const utxo = await findPolicyUtxo(client, String(ref));
    if (!utxo) return void res.status(404).json({ error: "No such policy at the validator (spent, or a typo)." });
    const policy = policyViewOf(utxo);
    const now = Date.now();
    const check = checkAgainst(policy, parsed);
    const window = evaluationWindow(policy, check.signedMs, now);
    const verdict = await evaluateRelease(client, utxo, policy, parsed, now);
    // Hints are computed here, not by the contract. They only help read a rejection.
    const ageSeconds = Math.round((now - check.signedMs) / 1000);
    res.json({
      ...verdict,
      sentToChain: false,
      policy: policySummary(utxo),
      hints: {
        sameRequest: check.sameRequest,
        ageSeconds,
        maxAgeSeconds: policy.maxAgeMs / 1000,
        tooOld: ageSeconds * 1000 > policy.maxAgeMs,
        sum: check.value,
        threshold: check.threshold,
        ruleHolds: check.met,
      },
      validity: { from: new Date(window.from).toISOString(), to: new Date(window.to).toISOString() },
      tookMs: Date.now() - started,
    });
  } catch (error) {
    res.status(502).json({ verdict: "ERROR", detail: `Could not get a verdict: ${String((error as Error).message).replace(/\s+/g, " ").slice(0, 160)}` });
  } finally {
    evaluating -= 1;
  }
});

// ---------------------------------------------------------------------------
// Information for the page

app.get("/api/info", (_req, res) => {
  res.json({
    network: "Cardano preprod",
    validatorHash: scriptHash,
    validatorAddress: `70${scriptHash}`,
    paidRoute: { method: "POST", path: "/api/keep", priceTada: Number(PRICE_LOVELACE) / 1_000_000, payTo, chargedOnlyWhen: "the policy is released", sources: ALLOW_PAID_SOURCES ? "nodary:<feed>, tweet:<id>" : "nodary:<feed>" },
    escrowRoute: { method: "POST", path: "/api/escrow", priceTada: Number(ESCROW_LOVELACE) / 1_000_000, payTo: validatorAddressBech32, transferMethod: "script (locked into the validator)" },
    facilitator: facilitatorUrl,
  });
});
app.get("/api/jobs", (_req, res) => void res.json(jobs));
app.get("/health", (_req, res) => void res.json({ ok: true }));
app.use(express.static(webDir));

const port = Number(process.env.SERVICE_PORT ?? 4022);
app.listen(port, () => {
  console.log(`Pay-on-Proof service on http://localhost:${port}`);
  console.log(`  judge page   GET  /            (free; verdicts only, nothing is ever sent to the chain)`);
  console.log(`  paid job     POST /api/keep    ${Number(PRICE_LOVELACE) / 1_000_000} tADA on ${NETWORK}, charged only when the policy is released`);
  console.log(`  escrow       POST /api/escrow  ${Number(ESCROW_LOVELACE) / 1_000_000} tADA locked into the validator (x402 script transfer method)`);
  console.log(`  facilitator  ${facilitatorUrl}`);
});

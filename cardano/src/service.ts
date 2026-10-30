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
 *   (watcher)        optional, AUTO_RELEASE=1 (or "dry"): the seller's keeper (autorelease.ts) finds policies on the validator
 *                    that pay this service and releases them when the data proves the rule, with no request from anyone.
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
import { type SignedResponse, hexOf, loadVector, makeClient, paymentKeyHashHex, scriptAddress, scriptHash, sellerAddressBech32, waitForTip } from "./engine.js";
import { startAutoRelease, type WatchStatus } from "./autorelease.js";
import { type DemoParams, getRun, refusal, startDemoRun } from "./demo-run.js";
import { ESCROW_LOVELACE, describeOffer, offerExtra, parseOffer, validatorAddressBech32 } from "./escrow.js";
import { judgeRoutes, policySummary } from "./judge-routes.js";
import { TEMPLATE_IDS, allSpecs, registeredSources } from "./templates.js";
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
  withRetry,
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
const outDir = new URL("../out/", import.meta.url);
const jobsFile = new URL("service-jobs.jsonl", outDir);

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
    if (!check.ready) {
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
  recordJob({ route: "escrow", template: offer.template, rule: describeOffer(offer), refund: offer.refund.slice(0, 18), deadline: new Date(offer.deadlineMs).toISOString(), outcome: "payment-verified" });
  res.json({
    status: "accepted",
    lockedAt: validatorAddressBech32,
    payoutTada: Number(ESCROW_LOVELACE) / 1_000_000,
    template: offer.template,
    rule: `${describeOffer(offer)} (a signed AirnodeHub response at most 5 minutes old proves it)`,
    seller: "SELLER_ADDRESS (the beneficiary)",
    refundTo: offer.refund,
    refundAfter: new Date(offer.deadlineMs).toISOString(),
    next: "When the payment settles, your 5 tADA sits at the validator under this policy. Anyone with a matching signed response can release it to the seller; you can refund it after the deadline. Find it with the payment transaction hash.",
  });
});

// ---------------------------------------------------------------------------
// The judge bench and the live board (judge-routes.ts, shared with the public judge site)

app.use(judgeRoutes(operator));

// ---------------------------------------------------------------------------
// Information for the page

app.get("/api/info", (_req, res) => {
  res.json({
    network: "Cardano preprod",
    validatorHash: scriptHash,
    validatorAddress: `70${scriptHash}`,
    paidRoute: { method: "POST", path: "/api/keep", priceTada: Number(PRICE_LOVELACE) / 1_000_000, payTo, chargedOnlyWhen: "the policy is released", sources: ALLOW_PAID_SOURCES ? "nodary:<feed>, tweet:<id>" : "nodary:<feed>" },
    escrowRoute: { method: "POST", path: "/api/escrow", priceTada: Number(ESCROW_LOVELACE) / 1_000_000, payTo: validatorAddressBech32, transferMethod: "script (locked into the validator)", templates: TEMPLATE_IDS, sources: registeredSources().map((r) => ({ id: r.id, label: r.label, rule: r.cmp === "Below" ? "below" : "at least", kind: r.kind, costAusd: r.costAusd })) },
    demoBuyer: process.env.DEMO_BUYER === "1",
    facilitator: facilitatorUrl,
  });
});
app.get("/api/jobs", (_req, res) => void res.json(jobs));

// ---------------------------------------------------------------------------
// Live demo runs (DEMO_BUYER=1 only): the buyer's side of the story with real preprod transactions, for the console

const demoDeps = () => ({
  serviceUrl: `http://127.0.0.1:${Number(process.env.SERVICE_PORT ?? 4022)}`,
  watch: () => watcher?.status(),
  jobs: () => jobs,
});
app.post("/api/demo/run", (req: Request, res: Response) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const params: DemoParams = {
    mode: b.mode === "refund" ? "refund" : "release",
    template: typeof b.template === "string" ? b.template : "eth-usd",
    value: Number(b.value),
    ...(typeof b.tweetId === "string" ? { tweetId: b.tweetId } : {}),
  };
  const why = refusal(params, demoDeps());
  if (why) return void res.status(409).json({ error: why });
  if (params.mode === "release" && !(Number.isFinite(params.value) && params.value > 0)) return void res.status(400).json({ error: "value must be a positive number" });
  res.json(startDemoRun(params, demoDeps()));
});
app.get("/api/demo/run/:id", (req: Request, res: Response) => {
  const run = getRun(String(req.params.id));
  if (!run) return void res.status(404).json({ error: "No such run" });
  res.json(run);
});

app.get("/api/watch", (_req, res) => void res.json(watcher?.status() ?? { enabled: false }));
app.get("/health", (_req, res) => void res.json({ ok: true }));
app.use(express.static(webDir));

let watcher: { status: () => WatchStatus } | undefined;
const port = Number(process.env.SERVICE_PORT ?? 4022);
// Live demo runs spend the demo buyer's test funds, so with DEMO_BUYER=1 the service answers this computer only.
const listenArgs: [number, string?] = process.env.DEMO_BUYER === "1" ? [port, "127.0.0.1"] : [port];
app.listen(...(listenArgs as [number]), () => {
  if (process.env.AUTO_RELEASE === "1" || process.env.AUTO_RELEASE === "dry") {
    watcher = startAutoRelease({
      client: operator(),
      dry: process.env.AUTO_RELEASE === "dry",
      intervalMs: Number(process.env.AUTO_RELEASE_INTERVAL_S ?? "20") * 1000,
      onJob: recordJob,
      allowPaid: process.env.AUTO_RELEASE_PAID === "1", // tweet and rainfall sources cost aUSD per fetch
      fast: process.env.AUTO_RELEASE_FAST === "1", // booth mode: paid counters every cycle (set AUTO_RELEASE_INTERVAL_S=3 and a larger AUTO_RELEASE_AUSD_CAP)
      ausdCap: Number(process.env.AUTO_RELEASE_AUSD_CAP ?? "0.3"),
    });
  }
  console.log(`Pay-on-Proof service on http://localhost:${port}`);
  console.log(`  judge page   GET  /            (free; verdicts only, nothing is ever sent to the chain)`);
  console.log(`  paid job     POST /api/keep    ${Number(PRICE_LOVELACE) / 1_000_000} tADA on ${NETWORK}, charged only when the policy is released`);
  console.log(`  escrow       POST /api/escrow  ${Number(ESCROW_LOVELACE) / 1_000_000} tADA locked into the validator (x402 script transfer method)`);
  console.log(`  auto-release ${process.env.AUTO_RELEASE === "1" ? "ON: releases policies that pay this service" : process.env.AUTO_RELEASE === "dry" ? "dry run: logs what it would release" : "off (set AUTO_RELEASE=1)"}`);
  console.log(`  live runs    ${process.env.DEMO_BUYER === "1" ? "ON (DEMO_BUYER=1): the console can pay real test escrows; listening on localhost only" : "off (set DEMO_BUYER=1)"}`);
  console.log(`  facilitator  ${facilitatorUrl}`);
});

/**
 * The outcome keeper as a Masumi agent (MIP-003 Agentic Service API), so that Masumi buyers can hire it and pay it through
 * Masumi, while the conditional payment itself stays in our contract.
 *
 *   GET  /availability   {status: "available", type: "masumi-agent"}
 *   GET  /input_schema   one field: the reference of the escrow to watch (<tx hash>#<index>)
 *   POST /start_job      {identifier_from_purchaser, input_data: {policy}}: checks the escrow, asks the Masumi payment service (MPS)
 *                        for a payment request, answers with the payment fields the buyer needs
 *   GET  /status         ?job_id=...: awaiting_payment | running | completed | failed, and the result when completed
 *
 * The job: "watch this escrow until its deadline and release it if the signed data proves its rule". The seller's keeper
 * (autorelease.ts) does the watching; this module sells it as a job. Once the buyer's payment is locked in Masumi's escrow the job
 * runs; its result is a short JSON text (released with the transaction hash, or not released by the deadline), whose hash
 * sha256(nonce;result) is submitted to the MPS, which pays the keeper after the unlock time. That result is checkable by anyone:
 * the release transaction carries the signed response.
 *
 * The shapes follow Masumi's own TUM hackathon quickstart (github.com/masumi-network/tum-hackathon-quickstart): MPS calls are
 * POST {MPS_URL}/api/v1/... with the header `token`, answers are {status: "success", data}. Written from that code and the MIP-003
 * text; NOT run against a real payment service yet (it needs Docker, a database and funded wallets): tested against a stand-in
 * in scripts/masumi-test.ts.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import express, { Router, type Request, type Response } from "express";

export const USDM = "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d"; // tUSDM on preprod, as in the quickstart
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
export const inputHash = (input: { policy: string }, nonce: string) => sha256(`${nonce};${JSON.stringify({ policy: input.policy })}`);
export const resultHash = (result: string, nonce: string) => sha256(`${nonce};${result}`);

/** A client for the Masumi payment service. Throws unless the answer is HTTP ok with status "success"; returns its `data`. */
export type Mps = (path: string, body: Record<string, unknown>) => Promise<Record<string, unknown>>;
export const makeMps =
  (baseUrl: string, token: string, fetchFn: typeof fetch = fetch): Mps =>
  async (path, body) => {
    const response = await fetchFn(`${baseUrl.replace(/\/$/, "")}/api/v1${path}`, {
      method: "POST",
      headers: { token, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const answer = (await response.json().catch(() => ({}))) as { status?: string; data?: Record<string, unknown> };
    if (!response.ok || answer.status !== "success") throw new Error(`MPS ${path} answered HTTP ${response.status}`);
    return answer.data ?? {};
  };

export interface Registration {
  agentIdentifier: string;
  sellerVKey: string;
  supportedPaymentSourceIndex: number;
}

export type PolicyCheck = { ok: true; deadlineMs: number; rule: string } | { ok: false; reason: string };
export type Outcome = { state: "open" } | { state: "released"; tx: string } | { state: "gone" };

export interface MasumiDeps {
  /** The payment service client and the registration; without them /start_job answers 503. */
  mps?: Mps;
  registration?: Registration;
  priceAmount?: string; // in the smallest unit of tUSDM; the quickstart sells for "1000000"
  /** Is this escrow one the keeper can and will serve? */
  checkPolicy: (ref: string) => Promise<PolicyCheck>;
  /** What happened to the escrow so far. */
  outcomeOf: (ref: string) => Promise<Outcome>;
  storeFile?: string;
  pollMs?: number;
  now?: () => number;
}

type Status = "awaiting_payment" | "running" | "completed" | "failed";
interface Job {
  id: string;
  nonce: string;
  policy: string;
  inputHash: string;
  status: Status;
  phase: "waiting-payment" | "watching" | "submit-pending" | "awaiting-result" | "result-confirmed" | "failed";
  payment?: Record<string, unknown>;
  response?: Record<string, unknown>;
  deadlineMs: number;
  result?: string;
  resultHash?: string;
  error?: string;
  createdAt: number;
}

const NONCE = /^[0-9a-fA-F]{14,26}$/;
const REF = /^[0-9a-f]{64}#\d{1,4}$/;
const MINUTE = 60_000;
const confirmed = (payment: Record<string, unknown>, expected: string): boolean => {
  const current = payment.CurrentTransaction as { status?: string; newOnChainState?: string } | undefined;
  const history = (payment.TransactionHistory as { status?: string; newOnChainState?: string }[] | undefined) ?? [];
  return (current?.status === "Confirmed" && current.newOnChainState === expected) || history.some((t) => t.status === "Confirmed" && t.newOnChainState === expected);
};

export const masumiRoutes = (deps: MasumiDeps): { router: Router; stop: () => void; jobs: Map<string, Job> } => {
  const now = deps.now ?? Date.now;
  const router = Router();
  router.use(express.json({ limit: "20kb" }));

  const jobs = new Map<string, Job>();
  const byNonce = new Map<string, string>(); // sha256(nonce) -> job id: the same nonce must never create a second payment request
  const store = deps.storeFile;
  if (store && existsSync(store)) {
    for (const j of JSON.parse(readFileSync(store, "utf8")) as Job[]) {
      jobs.set(j.id, j);
      byNonce.set(sha256(j.nonce), j.id);
    }
  }
  const save = () => {
    if (!store) return;
    try {
      mkdirSync(dirname(store), { recursive: true });
      writeFileSync(store, JSON.stringify([...jobs.values()], null, 2));
    } catch {
      // the agent must keep working if the file cannot be written
    }
  };

  router.get("/availability", (_req, res) => void res.json({ status: deps.mps && deps.registration ? "available" : "unavailable", type: "masumi-agent", message: deps.mps && deps.registration ? undefined : "payment service not configured" }));

  router.get("/input_schema", (_req, res) =>
    void res.json({
      input_data: [
        {
          id: "policy",
          type: "string",
          name: "Escrow to watch and release (<transaction hash>#<output index>)",
          data: { description: "The Pay-on-Proof escrow whose rule the keeper should prove and whose funds it should release when the signed data holds.", placeholder: `${"0".repeat(64)}#0` },
        },
      ],
    }));

  const inflight = new Set<string>(); // a second request with the same identifier while the first is still being set up
  router.post("/start_job", async (req: Request, res: Response) => {
    let key = "";
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const nonce = String(body.identifier_from_purchaser ?? body.identifierFromPurchaser ?? "");
      const input = (body.input_data ?? {}) as Record<string, unknown>;
      if (!NONCE.test(nonce)) return void res.status(400).json({ error: "identifier_from_purchaser must be a hex string of 14 to 26 characters" });
      if (typeof input.policy !== "string" || !REF.test(input.policy) || Object.keys(input).some((k) => k !== "policy")) {
        return void res.status(400).json({ error: "input_data must be exactly { policy: '<64 hex characters>#<index>' }" });
      }
      if (!deps.mps || !deps.registration) return void res.status(503).json({ error: "The agent is not registered with a Masumi payment service yet" });

      key = sha256(nonce);
      const hash = inputHash({ policy: input.policy }, nonce);
      const known = byNonce.get(key);
      if (known) {
        const job = jobs.get(known)!;
        if (job.inputHash !== hash) return void res.status(409).json({ error: "This identifier_from_purchaser was used with a different input" });
        return void (job.response ? res.json(job.response) : res.status(409).json({ error: "This job needs inspection; it is not retried automatically" }));
      }

      if (inflight.has(key)) return void res.status(409).json({ error: "This identifier_from_purchaser is being processed" });
      inflight.add(key);
      const check = await deps.checkPolicy(input.policy);
      if (!check.ok) return void res.status(400).json({ error: check.reason });
      const t = now();
      const submitResultTime = Math.min(check.deadlineMs - 5 * MINUTE, t + 8 * 24 * 60 * MINUTE);
      if (submitResultTime < t + 25 * MINUTE) return void res.status(400).json({ error: "The escrow's deadline is too close for a job: it needs at least about 30 minutes" });

      const job: Job = { id: randomUUID(), nonce, policy: input.policy, inputHash: hash, status: "awaiting_payment", phase: "waiting-payment", deadlineMs: submitResultTime, createdAt: t };
      jobs.set(job.id, job); // saved before the payment service is called, so that an uncertain write is never repeated
      byNonce.set(key, job.id);
      save();
      const payByTime = t + 10 * MINUTE;
      const unlockTime = submitResultTime + 16 * MINUTE;
      const externalDisputeUnlockTime = unlockTime + 16 * MINUTE;
      let payment: Record<string, unknown>;
      try {
        payment = await deps.mps("/payment", {
          network: "Preprod",
          paymentSourceType: "Web3CardanoV2",
          supportedPaymentSourceIndex: deps.registration.supportedPaymentSourceIndex,
          inputHash: hash,
          agentIdentifier: deps.registration.agentIdentifier,
          identifierFromPurchaser: nonce,
          RequestedFunds: [{ unit: USDM, amount: deps.priceAmount ?? "1000000" }],
          payByTime: new Date(payByTime).toISOString(),
          submitResultTime: new Date(submitResultTime).toISOString(),
          unlockTime: new Date(unlockTime).toISOString(),
          externalDisputeUnlockTime: new Date(externalDisputeUnlockTime).toISOString(),
        });
      } catch (error) {
        job.status = "failed";
        job.phase = "failed";
        job.error = `payment request failed: ${(error as Error).message}`;
        save();
        return void res.status(502).json({ error: "The payment service did not answer; nothing was charged. Use a new identifier_from_purchaser to try again." });
      }
      job.payment = payment;
      job.response = {
        id: job.id,
        input_hash: hash,
        identifierFromPurchaser: nonce,
        blockchainIdentifier: payment.blockchainIdentifier,
        agentIdentifier: deps.registration.agentIdentifier,
        sellerVKey: deps.registration.sellerVKey,
        payByTime: Number(payment.payByTime ?? payByTime),
        submitResultTime: Number(payment.submitResultTime ?? submitResultTime),
        unlockTime: Number(payment.unlockTime ?? unlockTime),
        externalDisputeUnlockTime: Number(payment.externalDisputeUnlockTime ?? externalDisputeUnlockTime),
      };
      save();
      res.json(job.response);
    } catch {
      res.status(500).json({ error: "Request failed. Inspect the saved job state before retrying." });
    } finally {
      inflight.delete(key);
    }
  });

  router.get("/status", (req: Request, res: Response) => {
    const id = String(req.query.job_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return void res.status(400).json({ error: "job_id must be a job id" });
    const job = jobs.get(id);
    if (!job) return void res.status(404).json({ error: "No such job" });
    res.json({ id: job.id, status: job.status, ...(job.status === "completed" ? { result: job.result } : {}), ...(job.status === "failed" ? { message: job.error } : {}) });
  });

  // ---- the work: wait for the buyer's payment, let the keeper watch, report, and wait for Masumi to confirm
  let busy = false;
  const step = async (job: Job) => {
    const mps = deps.mps;
    if (!mps || !job.payment) return;
    const blockchainIdentifier = job.payment.blockchainIdentifier;
    if (job.phase === "waiting-payment") {
      const paid = await mps("/payment/resolve-blockchain-identifier", { network: "Preprod", blockchainIdentifier, includeHistory: "true" });
      if (paid.onChainState === "FundsLocked" && confirmed(paid, "FundsLocked")) {
        if (job.deadlineMs - now() < 2 * MINUTE) {
          job.status = "failed";
          job.phase = "failed";
          job.error = "the payment arrived too late to do the job";
        } else {
          job.status = "running";
          job.phase = "watching";
        }
      } else if (now() > Number(job.response?.payByTime ?? 0) + 5 * MINUTE) {
        job.status = "failed";
        job.phase = "failed";
        job.error = "no payment was made in time";
      }
      return;
    }
    if (job.phase === "watching") {
      const outcome = await deps.outcomeOf(job.policy);
      const late = now() >= job.deadlineMs - 2 * MINUTE;
      if (outcome.state === "open" && !late) return; // still watching: the keeper does the work
      job.result =
        outcome.state === "released"
          ? JSON.stringify({ policy: job.policy, outcome: "released", transaction: outcome.tx })
          : outcome.state === "gone"
            ? JSON.stringify({ policy: job.policy, outcome: "spent by someone else (released or refunded)" })
            : JSON.stringify({ policy: job.policy, outcome: "not released: the signed data did not prove the rule before the deadline" });
      job.resultHash = resultHash(job.result, job.nonce);
      job.phase = "submit-pending";
    }
    if (job.phase === "submit-pending") {
      await mps("/payment/submit-result", { network: "Preprod", blockchainIdentifier, submitResultHash: job.resultHash });
      job.phase = "awaiting-result";
      return;
    }
    if (job.phase === "awaiting-result") {
      const seen = await mps("/payment/resolve-blockchain-identifier", { network: "Preprod", blockchainIdentifier, includeHistory: "true" });
      if (seen.onChainState === "ResultSubmitted" && seen.resultHash === job.resultHash && confirmed(seen, "ResultSubmitted")) {
        job.phase = "result-confirmed";
        job.status = "completed";
      }
    }
  };
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      for (const job of jobs.values()) {
        if (job.status === "failed" || job.status === "completed") continue;
        try {
          await step(job);
        } catch (error) {
          console.error(`[masumi] job ${job.id} needs another try: ${String((error as Error).message).slice(0, 120)}`);
        }
      }
      save();
    } finally {
      busy = false;
    }
  }, deps.pollMs ?? 5_000);
  timer.unref();

  return { router, stop: () => clearInterval(timer), jobs };
};

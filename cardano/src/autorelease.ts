/**
 * The seller's keeper: watches the validator for policies that pay this service and releases them when the data proves the
 * rule. Nobody starts a cycle and nobody names a policy: it finds them.
 *
 * Each cycle it lists the UTxOs at the validator and keeps the policies that (1) name the service's seller key as beneficiary,
 * (2) pin the Nodary ETH/USD request and signer it knows how to fetch, and (3) still have at least 3 minutes to their
 * deadline. If there are any it fetches ONE fresh signed response (free), checks every candidate against it, and releases the
 * first one whose rule holds. Policies that someone else would be paid by are never touched, and a release can only pay the
 * beneficiary the policy names.
 *
 * Limits and failure handling:
 *   - no candidates, no fetch; one fetch per cycle however many candidates there are;
 *   - a failed fetch or provider read backs off (interval x 2^failures, at most 300 s) and the loop carries on;
 *   - at most one release per cycle, then it waits for that transaction to confirm before the next one (they share a wallet);
 *   - a release that the chain refuses is retried on later cycles, 3 times per policy, then given up on and logged
 *     (a freshly settled UTxO can be invisible to the node's script evaluation for about half a minute);
 *   - every cycle is appended to out/autorelease-log.jsonl.
 * dry mode does everything except submit.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { hexOf, loadVector, paymentKeyHashHex, scriptAddress, sellerAddressBech32, sleep, waitForTip, waitForTx } from "./engine.js";
import { type Client, checkAgainst, classify, fetchSigned, parseSource, policyViewOf, releaseTx, submitWindow, withRetry } from "./proof.js";

const outDir = new URL("../out/", import.meta.url);
const logFile = new URL("autorelease-log.jsonl", outDir);
const SOURCE = "nodary:ETH/USD";
const MIN_TIME_LEFT_MS = 3 * 60_000;
const MAX_RELEASE_ATTEMPTS = 3;

export interface Candidate {
  ref: string;
  rule: string;
  deadline: string;
  state: "watching" | "rule-not-met" | "releasing" | "released" | "expired" | "deadline-close" | "gave-up";
  value?: number;
}

export interface WatchStatus {
  enabled: true;
  dry: boolean;
  startedAt: string;
  lastCycleAt?: string;
  lastPrice?: number;
  candidates: Candidate[];
  released: number;
  consecutiveFailures: number;
}

export interface AutoReleaseOptions {
  client: Client;
  dry?: boolean;
  intervalMs?: number;
  onJob?: (entry: Record<string, unknown>) => void;
}

export const startAutoRelease = (options: AutoReleaseOptions) => {
  const { client, dry = false, intervalMs = 20_000, onJob } = options;
  const vec = loadVector("nodary-eth-usd");
  const sellerPkh = paymentKeyHashHex(sellerAddressBech32());
  const source = parseSource(SOURCE);
  const attempts = new Map<string, number>();
  const done = new Set<string>();
  let stopped = false;
  let failures = 0;
  const status: WatchStatus = { enabled: true, dry, startedAt: new Date().toISOString(), candidates: [], released: 0, consecutiveFailures: 0 };

  const log = (entry: Record<string, unknown>) => {
    try {
      mkdirSync(outDir, { recursive: true });
      appendFileSync(logFile, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
    } catch {
      // logging must never stop the loop
    }
    console.log(`[auto-release] ${Object.entries(entry).map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`).join("  ")}`);
  };

  const cycle = async () => {
    const utxos = await withRetry(() => client.getUtxos(scriptAddress), 3);
    const now = Date.now();
    const mine: { ref: string; utxo: (typeof utxos)[number]; policy: ReturnType<typeof policyViewOf> }[] = [];
    for (const utxo of utxos) {
      let policy;
      try {
        policy = policyViewOf(utxo);
      } catch {
        continue; // not a policy datum
      }
      if (policy.beneficiaryHex !== sellerPkh || policy.requestHashHex !== vec.requestHashHex || policy.signerHex !== vec.pubkeyHex) continue;
      mine.push({ ref: `${hexOf(utxo.transactionId.hash)}#${Number(utxo.index)}`, utxo, policy });
    }

    const describe = (m: (typeof mine)[number], state: Candidate["state"], value?: number): Candidate => ({
      ref: m.ref,
      rule: `ETH/USD ${m.policy.cmp === "Below" ? "below" : "at least"} ${m.policy.threshold / 10 ** m.policy.scale}`,
      deadline: new Date(m.policy.deadlineMs).toISOString(),
      state,
      ...(value === undefined ? {} : { value }),
    });
    const open = mine.filter((m) => m.policy.deadlineMs - now >= MIN_TIME_LEFT_MS && !done.has(m.ref) && (attempts.get(m.ref) ?? 0) < MAX_RELEASE_ATTEMPTS);
    status.lastCycleAt = new Date(now).toISOString();
    status.candidates = mine
      .filter((m) => m.policy.deadlineMs > now - 10 * 60_000) // keep recently expired ones visible for a while
      .map((m) => describe(m, done.has(m.ref) ? "released" : (attempts.get(m.ref) ?? 0) >= MAX_RELEASE_ATTEMPTS ? "gave-up" : m.policy.deadlineMs <= now ? "expired" : m.policy.deadlineMs - now < MIN_TIME_LEFT_MS ? "deadline-close" : "watching"));
    if (open.length === 0) return;

    const fetched = await fetchSigned(source);
    const response = fetched.response;
    const checks = open.map((m) => ({ m, check: checkAgainst(m.policy, response) }));
    const price = checks[0].check.value;
    status.lastPrice = price;
    status.candidates = status.candidates.map((c) => {
      const hit = checks.find((x) => x.m.ref === c.ref);
      return hit ? { ...c, state: hit.check.ready ? "releasing" : "rule-not-met", value: hit.check.value } : c;
    });
    const ready = checks.filter((x) => x.check.sameRequest && x.check.ready);
    log({ event: "scan", candidates: open.length, price, ready: ready.length, dry });
    if (ready.length === 0) return;

    const { m, check } = ready[0];
    if (dry) {
      log({ event: "would-release", ref: m.ref, value: check.value, threshold: check.threshold });
      return;
    }
    attempts.set(m.ref, (attempts.get(m.ref) ?? 0) + 1);
    try {
      const window = submitWindow(m.policy, check.signedMs);
      await waitForTip(window.from + 2_000, 120_000);
      if (Date.now() > window.to - 10_000) {
        log({ event: "too-slow", ref: m.ref, note: "the response got too old while waiting for the chain tip; the next cycle fetches a new one" });
        return;
      }
      const submitted = await (await releaseTx(client, m.utxo, m.policy, response, window)).signAndSubmit();
      const tx = hexOf(submitted.hash);
      done.add(m.ref);
      status.released += 1;
      log({ event: "released", ref: m.ref, tx, value: check.value, threshold: check.threshold, responseAgeS: Math.round((Date.now() - check.signedMs) / 1000) });
      onJob?.({ route: "auto-release", ref: m.ref, outcome: "released", tx, value: check.value });
      const confirmed = await waitForTx(tx, 120_000); // the next release shares this wallet's inputs
      log({ event: confirmed ? "confirmed" : "confirmation-not-seen-yet", tx });
    } catch (error) {
      const verdict = classify(error);
      log({ event: "release-failed", ref: m.ref, attempt: attempts.get(m.ref), kind: verdict.verdict, error: String((error as Error).message).replace(/\s+/g, " ").slice(0, 140) });
      if ((attempts.get(m.ref) ?? 0) >= MAX_RELEASE_ATTEMPTS) log({ event: "gave-up", ref: m.ref });
    }
  };

  const loop = async () => {
    log({ event: "start", dry, source: SOURCE, intervalS: intervalMs / 1000, beneficiary: `${sellerPkh.slice(0, 8)}…` });
    while (!stopped) {
      let wait = intervalMs;
      try {
        await cycle();
        failures = 0;
      } catch (error) {
        failures += 1;
        wait = Math.min(300_000, intervalMs * 2 ** failures);
        log({ event: "cycle-failed", failures, retryInS: wait / 1000, error: String((error as Error).message).replace(/\s+/g, " ").slice(0, 140) });
      }
      status.consecutiveFailures = failures;
      await sleep(wait);
    }
  };
  void loop();

  return { status: (): WatchStatus => status, stop: () => { stopped = true; } };
};

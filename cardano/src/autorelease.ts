/**
 * The seller's keeper: watches the validator for policies that pay this service and releases them when the data proves the
 * rule. Nobody starts a cycle and nobody names a policy: it finds them.
 *
 * Each cycle it lists the UTxOs at the validator and keeps the policies that (1) name the service's seller key as beneficiary,
 * (2) pin a request and signer of one of the templates it knows how to fetch (templates.ts: ETH/USD, the likes of a registered
 * tweet, Munich rainfall) and (3) still have at least 3 minutes to their deadline. For each source with candidates it fetches ONE
 * fresh signed response, checks every candidate of that source against it, and releases the first policy whose rule holds.
 * Policies that someone else would be paid by are never touched, and a release can only pay the beneficiary the policy names.
 *
 * Limits and failure handling:
 *   - no candidates, no fetch; one fetch per source per cycle however many candidates there are;
 *   - free sources are fetched every cycle; a source that costs aUSD (tweets, rainfall) only when AUTO_RELEASE_PAID is on,
 *     at most once a minute, and never beyond the aUSD cap for the life of the process;
 *   - a failed fetch or provider read backs off (interval x 2^failures, at most 300 s) and the loop carries on;
 *   - at most one release per cycle, then it waits for that transaction to confirm before the next one (they share a wallet);
 *   - a release that the chain refuses is retried on later cycles, 3 times per policy, then given up on and logged
 *     (a freshly settled UTxO can be invisible to the node's script evaluation for about half a minute);
 *   - every cycle is appended to out/autorelease-log.jsonl.
 * dry mode does everything except submit (and does not buy paid data).
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { hexOf, loadVector, paymentKeyHashHex, scriptAddress, sellerAddressBech32, sleep, waitForTip, waitForTx } from "./engine.js";
import { type Client, type Source, type Check, checkAgainst, classify, fetchSigned, parseSource, policyViewOf, releaseTx, submitWindow, withRetry } from "./proof.js";
import { allSpecs } from "./templates.js";

const outDir = new URL("../out/", import.meta.url);
const logFile = new URL("autorelease-log.jsonl", outDir);
const MIN_TIME_LEFT_MS = 3 * 60_000;
const MAX_RELEASE_ATTEMPTS = 3;
const MIN_PAID_FETCH_GAP_MS = 60_000;

export interface Candidate {
  ref: string;
  rule: string;
  deadline: string;
  state: "watching" | "rule-not-met" | "releasing" | "released" | "expired" | "deadline-close" | "gave-up" | "waiting-for-budget";
  value?: number;
}

export interface WatchStatus {
  enabled: true;
  dry: boolean;
  allowPaid: boolean;
  startedAt: string;
  lastCycleAt?: string;
  /** The latest value seen per source, for example "nodary:ETH/USD" or "tweet:20". */
  lastValues: Record<string, number>;
  candidates: Candidate[];
  released: number;
  ausdSpent: number;
  consecutiveFailures: number;
}

export interface AutoReleaseOptions {
  client: Client;
  dry?: boolean;
  intervalMs?: number;
  allowPaid?: boolean;
  ausdCap?: number;
  onJob?: (entry: Record<string, unknown>) => void;
}

interface Known {
  specId: string;
  describe: (value: number) => string;
  source: Source;
  signerHex: string;
}

export const startAutoRelease = (options: AutoReleaseOptions) => {
  const { client, dry = false, intervalMs = 20_000, allowPaid = false, ausdCap = 0.3, onJob } = options;
  const sellerPkh = paymentKeyHashHex(sellerAddressBech32());
  // What the keeper can prove, keyed by the request hash a policy pins. Rebuilt every cycle: tweets can be registered at run time.
  const knownRequests = (): Map<string, Known> => {
    const map = new Map<string, Known>();
    for (const spec of allSpecs()) {
      const vec = loadVector(spec.vectorName);
      map.set(vec.requestHashHex, { specId: spec.id, describe: spec.describe, source: parseSource(spec.sourceSpec), signerHex: vec.pubkeyHex });
    }
    return map;
  };
  const attempts = new Map<string, number>();
  const done = new Set<string>();
  const lastFetch = new Map<string, number>();
  let stopped = false;
  let failures = 0;
  let spent = 0;
  let cooldownUntil = 0;
  const status: WatchStatus = { enabled: true, dry, allowPaid, startedAt: new Date().toISOString(), lastValues: {}, candidates: [], released: 0, ausdSpent: 0, consecutiveFailures: 0 };

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
    const known = knownRequests();
    const mine: { ref: string; utxo: (typeof utxos)[number]; policy: ReturnType<typeof policyViewOf>; known: Known }[] = [];
    for (const utxo of utxos) {
      let policy;
      try {
        policy = policyViewOf(utxo);
      } catch {
        continue; // not a policy datum
      }
      const k = known.get(policy.requestHashHex);
      if (!k || policy.signerHex !== k.signerHex || policy.beneficiaryHex !== sellerPkh) continue;
      mine.push({ ref: `${hexOf(utxo.transactionId.hash)}#${Number(utxo.index)}`, utxo, policy, known: k });
    }

    const ruleOf = (m: (typeof mine)[number]) => m.known.describe(m.policy.threshold / 10 ** m.policy.scale);
    const describe = (m: (typeof mine)[number], state: Candidate["state"], value?: number): Candidate => ({
      ref: m.ref,
      rule: ruleOf(m),
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
    // The node's script evaluation can be blind to outputs that are seconds old, including this wallet's change from the release
    // before: a transaction built on it fails with the same generic "script evaluation failed" as a real refusal. Wait it out, and
    // do so before buying any data, so that a paid response is never fetched only to be discarded.
    if (Date.now() < cooldownUntil) {
      log({ event: "cooldown", waitS: Math.ceil((cooldownUntil - Date.now()) / 1000), note: "the previous release was confirmed moments ago; no data is fetched until it has passed" });
      return;
    }

    // one fetch per source with candidates
    const bySource = new Map<string, typeof open>();
    for (const m of open) bySource.set(m.known.source.spec, [...(bySource.get(m.known.source.spec) ?? []), m]);
    const results: { m: (typeof open)[number]; check: Check; response: Awaited<ReturnType<typeof fetchSigned>>["response"] }[] = [];
    const setState = (refs: string[], state: Candidate["state"], valueOf?: (ref: string) => number | undefined) => {
      status.candidates = status.candidates.map((c) => (refs.includes(c.ref) ? { ...c, state, ...(valueOf?.(c.ref) === undefined ? {} : { value: valueOf?.(c.ref) }) } : c));
    };
    for (const [spec, group] of bySource) {
      const source = group[0].known.source;
      if (source.costAusd > 0) {
        const wait = MIN_PAID_FETCH_GAP_MS - (now - (lastFetch.get(spec) ?? 0));
        if (dry || !allowPaid || spent + source.costAusd > ausdCap) {
          setState(group.map((g) => g.ref), "waiting-for-budget");
          log({ event: "paid-source-skipped", source: spec, why: dry ? "dry run" : !allowPaid ? "AUTO_RELEASE_PAID is off" : "aUSD cap reached", spentAusd: spent, capAusd: ausdCap });
          continue;
        }
        if (wait > 0) continue; // fetched less than a minute ago
      }
      const fetched = await fetchSigned(source);
      lastFetch.set(spec, Date.now());
      spent = Math.round((spent + fetched.spentAusd) * 1e4) / 1e4;
      status.ausdSpent = spent;
      let first: number | undefined;
      for (const m of group) {
        const check = checkAgainst(m.policy, fetched.response);
        first ??= check.value;
        results.push({ m, check, response: fetched.response });
      }
      if (first !== undefined) status.lastValues[spec] = first;
    }
    setState(results.map((r) => r.m.ref), "rule-not-met", (ref) => results.find((r) => r.m.ref === ref)?.check.value);
    const ready = results.filter((x) => x.check.sameRequest && x.check.ready);
    setState(ready.map((r) => r.m.ref), "releasing", (ref) => results.find((r) => r.m.ref === ref)?.check.value);
    log({ event: "scan", candidates: open.length, sources: [...bySource.keys()], values: status.lastValues, ready: ready.length, spentAusd: spent, dry });
    if (ready.length === 0) return;

    const { m, check, response } = ready[0];
    if (dry) {
      log({ event: "would-release", ref: m.ref, rule: ruleOf(m), value: check.value, threshold: check.threshold });
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
      log({ event: "released", ref: m.ref, rule: ruleOf(m), tx, value: check.value, threshold: check.threshold, responseAgeS: Math.round((Date.now() - check.signedMs) / 1000) });
      onJob?.({ route: "auto-release", ref: m.ref, outcome: "released", tx, value: check.value, rule: ruleOf(m) });
      const confirmed = await waitForTx(tx, 120_000); // the next release shares this wallet's inputs
      log({ event: confirmed ? "confirmed" : "confirmation-not-seen-yet", tx });
      cooldownUntil = Date.now() + 45_000;
    } catch (error) {
      const verdict = classify(error);
      log({ event: "release-failed", ref: m.ref, attempt: attempts.get(m.ref), kind: verdict.verdict, error: String((error as Error).message).replace(/\s+/g, " ").slice(0, 140) });
      if ((attempts.get(m.ref) ?? 0) >= MAX_RELEASE_ATTEMPTS) log({ event: "gave-up", ref: m.ref });
    }
  };

  const loop = async () => {
    log({ event: "start", dry, allowPaid, ausdCap, intervalS: intervalMs / 1000, beneficiary: `${sellerPkh.slice(0, 8)}…`, templates: allSpecs().map((s) => s.id) });
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

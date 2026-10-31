import { submitTracked, pendingFor, reconcile } from "./tx-tracking.js";
/**
 * The seller's keeper: watches the validator for policies that pay this service and releases them when the data proves the
 * rule. Nobody starts a cycle and nobody names a policy: it finds them.
 *
 * Each cycle it lists the UTxOs at the validator and keeps the policies that (1) name the service's seller key as beneficiary,
 * (2) pin a request and signer of one of the templates it knows how to fetch (templates.ts: ETH/USD, the likes of a registered
 * tweet, Munich rainfall) and (3) still have at least 3 minutes to their deadline. For each source with candidates it fetches ONE
 * fresh signed response, checks every candidate of that source against it, and releases the policy closest to its deadline whose
 * rule holds. Policies that someone else would be paid by are never touched, and a release can only pay the beneficiary the
 * policy names. It keeps no state that matters: after a restart it finds the same policies on chain again.
 *
 * Limits and failure handling (every failure ends in a logged, retried or given-up state; a policy it gives up on is still
 * refundable by the buyer after the deadline):
 *   - no candidates, no fetch; one fetch per source per cycle however many candidates there are;
 *   - free sources are fetched every cycle; a source that costs aUSD (tweets, rainfall) only when AUTO_RELEASE_PAID is on, on a
 *     schedule worked out from its cost (polling.ts): static data once, a trending counter by the predicted crossing, no trend
 *     with a ceiling of 5 minutes, never twice a minute, and never beyond the aUSD cap for the life of the process;
 *   - a source that fails backs off on its own (interval x 2^failures, at most 300 s) without stopping the other sources;
 *   - a provider read that fails backs the whole cycle off the same way, and every provider call times out instead of hanging;
 *   - at most one release per cycle, then it waits for that transaction to confirm and for 45 s more before the next one
 *     (the node's script evaluation can be blind to outputs that are seconds old, including its own change);
 *   - a release the chain refuses is retried on later cycles. Failures in the first 90 s after a policy was first seen, within
 *     2 minutes of the previous release, or that are errors in asking (not a verdict) do not count; 3 counted failures and it
 *     gives up on that policy and says so;
 *   - a release that was sent but never shows up as spent is tried again after 6 minutes;
 *   - every event is appended to out/autorelease-log.jsonl.
 * dry mode does everything except submit (and does not buy paid data).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { hexOf, loadVector, paymentKeyHashHex, scriptAddress, sellerAddressBech32, sleep, waitForTip, waitForTx } from "./engine.js";
import { type Client, type Source, type Check, bounded, checkAgainst, classify, fetchSigned, parseSource, policyViewOf, releaseTx, submitWindow, withRetry } from "./proof.js";
import { fault, faultsLeft } from "./faults.js";
import { FLOOR_MS, type Kind, type Sample, planNext } from "./polling.js";
import { allSpecs } from "./templates.js";

const outDir = new URL("../out/", import.meta.url);
const logFile = new URL("autorelease-log.jsonl", outDir);
const MIN_TIME_LEFT_MS = 3 * 60_000;
const MAX_RELEASE_ATTEMPTS = 3;
const GRACE_AFTER_FIRST_SEEN_MS = 90_000;
const GRACE_AFTER_RELEASE_MS = 120_000;
const COOLDOWN_AFTER_RELEASE_MS = 45_000;
const RESEND_AFTER_MS = 6 * 60_000;

export interface Candidate {
  ref: string;
  rule: string;
  deadline: string;
  state: "watching" | "rule-not-met" | "releasing" | "retrying" | "released" | "expired" | "deadline-close" | "gave-up" | "waiting-for-budget" | "settled-not-met" | "waiting-for-window";
  value?: number;
  /** When the next paid check is planned. */
  nextCheck?: string;
}

export interface WatchStatus {
  enabled: true;
  dry: boolean;
  allowPaid: boolean;
  startedAt: string;
  lastCycleAt?: string;
  /** The latest value seen per source, for example "nodary:ETH/USD" or "tweet:20". */
  lastValues: Record<string, number>;
  /** Per source: consecutive failures and until when it is backed off. */
  sources: Record<string, { failures: number; backoffUntil?: string }>;
  candidates: Candidate[];
  released: number;
  retries: number;
  ausdSpent: number;
  consecutiveFailures: number;
  faultsLeft: Record<string, number>;
}

export interface AutoReleaseOptions {
  client: Client;
  dry?: boolean;
  intervalMs?: number;
  allowPaid?: boolean;
  ausdCap?: number;
  /** Booth mode (AUTO_RELEASE_FAST=1): paid counters are checked every cycle instead of on the cost-derived schedule. */
  fast?: boolean;
  /** Extra addresses whose policies this keeper also releases (Creator Pay: the creators it serves). The seller's own are always served. */
  payees?: string[];
  onJob?: (entry: Record<string, unknown>) => void;
}

interface Known {
  specId: string;
  kind: Kind;
  describe: (value: number) => string;
  source: Source;
  signerHex: string;
}

const standingFile = new URL("../standing-policies.json", import.meta.url);

export const startAutoRelease = (options: AutoReleaseOptions) => {
  const { client, dry = false, intervalMs = 20_000, allowPaid = false, ausdCap = 0.3, fast = false, payees = [], onJob } = options;
  const sellerPkh = paymentKeyHashHex(sellerAddressBech32());
  const benchRefs = new Set<string>(
    existsSync(standingFile) ? (JSON.parse(readFileSync(standingFile, "utf8")) as { ref: string }[]).map((s) => s.ref) : [],
  );
  // Whose money this keeper releases: the seller, and the allow-listed payees. It spends its own fee either way, so the list is the limit.
  const served = new Set([sellerPkh, ...payees.map((a) => paymentKeyHashHex(a))]);
  // What the keeper can prove, keyed by the request hash a policy pins. Rebuilt every cycle: tweets can be registered at run time.
  const knownRequests = (): Map<string, Known> => {
    const map = new Map<string, Known>();
    for (const spec of allSpecs()) {
      const vec = loadVector(spec.vectorName);
      map.set(vec.requestHashHex, { specId: spec.id, kind: spec.kind, describe: spec.describe, source: parseSource(spec.sourceSpec), signerHex: vec.pubkeyHex });
    }
    return map;
  };
  const attempts = new Map<string, number>(); // counted failures only
  const firstSeen = new Map<string, number>();
  const submitted = new Map<string, { tx: string; at: number }>();
  const lastFetch = new Map<string, number>();
  const samples = new Map<string, Sample[]>(); // the last few checks per policy: the trend comes from these
  const nextCheckAt = new Map<string, number>();
  const stopChecking = new Set<string>(); // static data that did not satisfy the rule: asking again cannot help
  const health = new Map<string, { failures: number; until: number }>();
  let stopped = false;
  let failures = 0;
  let spent = 0;
  let cooldownUntil = 0;
  let lastReleaseAt = 0;
  const status: WatchStatus = { enabled: true, dry, allowPaid, startedAt: new Date().toISOString(), lastValues: {}, sources: {}, candidates: [], released: 0, retries: 0, ausdSpent: 0, consecutiveFailures: 0, faultsLeft: faultsLeft() };

  const log = (entry: Record<string, unknown>) => {
    try {
      mkdirSync(outDir, { recursive: true });
      appendFileSync(logFile, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
    } catch {
      // logging must never stop the loop
    }
    console.log(`[auto-release] ${Object.entries(entry).map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`).join("  ")}`);
  };
  const brief = (error: unknown) => String((error as Error)?.message ?? error).replace(/\s+/g, " ").slice(0, 140);

  const cycle = async () => {
    fault("cycle");
    const utxos = await bounded(withRetry(() => client.getUtxos(scriptAddress), 3), 45_000, "reading the validator's UTxOs");
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
      // The judge bench is a public fixture: never release it, whoever the keeper is configured to serve (it once was, twice).
      if (benchRefs.has(`${hexOf(utxo.transactionId.hash)}#${Number(utxo.index)}`)) continue;
      const k = known.get(policy.requestHashHex);
      if (!k || policy.signerHex !== k.signerHex || !served.has(policy.beneficiaryHex)) continue;
      mine.push({ ref: `${hexOf(utxo.transactionId.hash)}#${Number(utxo.index)}`, utxo, policy, known: k });
    }
    const onChain = new Set(mine.map((m) => m.ref));
    for (const m of mine) {
      if (!firstSeen.has(m.ref)) {
        firstSeen.set(m.ref, now);
        log({ event: "found", ref: m.ref, rule: m.known.describe(m.policy.threshold / 10 ** m.policy.scale), deadline: new Date(m.policy.deadlineMs).toISOString() });
        // A policy that counts only a measurement taken after some time: do not pay for data before then, it could not release.
        if (m.policy.settleAfterMs > now) {
          nextCheckAt.set(m.ref, m.policy.settleAfterMs + 2_000);
          log({ event: "waiting-for-window", ref: m.ref, measuresAfter: new Date(m.policy.settleAfterMs).toISOString(), note: "no paid check before then: an earlier response would be refused" });
        }
      }
    }
    for (const [ref, s] of submitted) {
      if (!onChain.has(ref)) {
        log({ event: "spent-on-chain", ref, tx: s.tx, note: "escrow absent from this scan; this alone does not identify its spending transaction" });
        await reconcile(s.tx);
        submitted.delete(ref);
        firstSeen.delete(ref);
        attempts.delete(ref);
      } else if (now - s.at > RESEND_AFTER_MS) {
        log({ event: "release-not-seen", ref, tx: s.tx, note: "sent more than 6 minutes ago and still unspent: trying again" });
        submitted.delete(ref);
      }
    }

    const ruleOf = (m: (typeof mine)[number]) => m.known.describe(m.policy.threshold / 10 ** m.policy.scale);
    const gaveUp = (ref: string) => (attempts.get(ref) ?? 0) >= MAX_RELEASE_ATTEMPTS;
    const pendingRefs = new Set<string>();
    for (const m of mine) if (await pendingFor(m.ref)) pendingRefs.add(m.ref);
    const open = mine.filter((m) => m.policy.deadlineMs - now >= MIN_TIME_LEFT_MS && !submitted.has(m.ref) && !pendingRefs.has(m.ref) && !gaveUp(m.ref) && !stopChecking.has(m.ref));
    status.lastCycleAt = new Date(now).toISOString();
    status.faultsLeft = faultsLeft();
    status.candidates = mine
      .filter((m) => m.policy.deadlineMs > now - 10 * 60_000) // keep recently expired ones visible for a while
      .map((m) => ({
        ref: m.ref,
        rule: ruleOf(m),
        deadline: new Date(m.policy.deadlineMs).toISOString(),
        state: submitted.has(m.ref) || pendingRefs.has(m.ref) ? "releasing" : gaveUp(m.ref) ? "gave-up" : stopChecking.has(m.ref) ? "settled-not-met" : m.policy.deadlineMs <= now ? "expired" : m.policy.deadlineMs - now < MIN_TIME_LEFT_MS ? "deadline-close" : m.policy.settleAfterMs > now ? "waiting-for-window" : "watching",
      }));
    if (open.length === 0) return;
    // The node's script evaluation can be blind to outputs that are seconds old, including this wallet's change from the release
    // before. Wait it out, and do so before buying any data, so that a paid response is never fetched only to be discarded.
    if (now < cooldownUntil) {
      log({ event: "cooldown", waitS: Math.ceil((cooldownUntil - now) / 1000), note: "the previous release was confirmed moments ago; no data is fetched until it has passed" });
      return;
    }

    // one fetch per source with candidates; a source that fails is isolated from the others
    const bySource = new Map<string, typeof open>();
    for (const m of open) bySource.set(m.known.source.spec, [...(bySource.get(m.known.source.spec) ?? []), m]);
    const results: { m: (typeof open)[number]; check: Check; response: Awaited<ReturnType<typeof fetchSigned>>["response"] }[] = [];
    const setState = (refs: string[], state: Candidate["state"], valueOf?: (ref: string) => number | undefined) => {
      status.candidates = status.candidates.map((c) => (refs.includes(c.ref) ? { ...c, state, ...(valueOf?.(c.ref) === undefined ? {} : { value: valueOf?.(c.ref) }) } : c));
    };
    for (const [spec, group] of bySource) {
      const source = group[0].known.source;
      const h = health.get(spec);
      if (h && h.until > now) {
        setState(group.map((g) => g.ref), "retrying");
        log({ event: "source-backoff", source: spec, failures: h.failures, retryInS: Math.ceil((h.until - now) / 1000) });
        continue;
      }
      // Candidates of this source whose planned check has come. A free source is checked every cycle; a paid one on its schedule.
      if (source.costAusd > 0 && !group.some((g) => (nextCheckAt.get(g.ref) ?? 0) <= now)) continue;
      if (source.costAusd > 0) {
        if (dry || !allowPaid || spent + source.costAusd > ausdCap) {
          setState(group.map((g) => g.ref), "waiting-for-budget");
          log({ event: "paid-source-skipped", source: spec, why: dry ? "dry run" : !allowPaid ? "AUTO_RELEASE_PAID is off" : "aUSD cap reached", spentAusd: spent, capAusd: ausdCap });
          continue;
        }
        if (now - (lastFetch.get(spec) ?? 0) < (fast ? 0 : FLOOR_MS)) continue; // never twice within a minute (booth mode: every cycle)
      }
      let fetched;
      try {
        fault("fetch");
        fetched = await fetchSigned(source);
      } catch (error) {
        const n = (h?.failures ?? 0) + 1;
        const wait = Math.min(300_000, intervalMs * 2 ** n);
        health.set(spec, { failures: n, until: Date.now() + wait });
        status.sources[spec] = { failures: n, backoffUntil: new Date(Date.now() + wait).toISOString() };
        setState(group.map((g) => g.ref), "retrying");
        log({ event: "source-failed", source: spec, failures: n, retryInS: Math.round(wait / 1000), error: brief(error) });
        continue;
      }
      if (h) health.delete(spec);
      status.sources[spec] = { failures: 0 };
      lastFetch.set(spec, Date.now());
      spent = Math.round((spent + fetched.spentAusd) * 1e4) / 1e4;
      status.ausdSpent = spent;
      let first: number | undefined;
      for (const m of group) {
        const check = checkAgainst(m.policy, fetched.response);
        first ??= check.value;
        results.push({ m, check, response: fetched.response });
        // plan the next paid check from what this one showed (polling.ts)
        const at = Date.now();
        const history = [...(samples.get(m.ref) ?? []), { at, value: check.value }].slice(-6);
        samples.set(m.ref, history);
        const plan = planNext({ now: at, deadlineMs: m.policy.deadlineMs, stopBeforeMs: MIN_TIME_LEFT_MS, costAusd: source.costAusd, budgetLeftAusd: ausdCap - spent, samples: history, threshold: m.policy.threshold / 10 ** m.policy.scale, cmp: m.policy.cmp, kind: m.known.kind, baseMs: intervalMs, fast });
        if (plan.delayMs === null) {
          stopChecking.add(m.ref);
          setState([m.ref], "settled-not-met");
          log({ event: "stop-checking", ref: m.ref, source: spec, why: plan.reason, note: "nothing is lost: the buyer can refund after the deadline" });
        } else if (source.costAusd > 0 && plan.delayMs > 0) {
          nextCheckAt.set(m.ref, at + plan.delayMs);
          status.candidates = status.candidates.map((c) => (c.ref === m.ref ? { ...c, nextCheck: new Date(at + plan.delayMs!).toISOString() } : c));
          log({ event: "next-check", ref: m.ref, source: spec, inS: Math.round(plan.delayMs / 1000), why: plan.reason });
        }
      }
      if (first !== undefined) status.lastValues[spec] = first;
    }
    setState(results.map((r) => r.m.ref), "rule-not-met", (ref) => results.find((r) => r.m.ref === ref)?.check.value);
    // the policy closest to its deadline first: it is the one that would run out of time
    const ready = results.filter((x) => x.check.sameRequest && x.check.ready).sort((a, b) => a.m.policy.deadlineMs - b.m.policy.deadlineMs);
    setState(ready.map((r) => r.m.ref), "releasing", (ref) => results.find((r) => r.m.ref === ref)?.check.value);
    // only a cycle that actually fetched something is worth a log line; a cycle that waits for a planned check says nothing
    if (results.length > 0) log({ event: "scan", candidates: open.length, fetched: [...new Set(results.map((r) => r.m.known.source.spec))], values: status.lastValues, ready: ready.length, spentAusd: spent, dry });
    if (ready.length === 0) return;

    const { m, check, response } = ready[0];
    if (dry) {
      log({ event: "would-release", ref: m.ref, rule: ruleOf(m), value: check.value, threshold: check.threshold });
      return;
    }
    try {
      const window = submitWindow(m.policy, check.signedMs);
      await waitForTip(window.from + 2_000, 120_000);
      if (Date.now() > window.to - 10_000) {
        log({ event: "too-slow", ref: m.ref, note: "the response got too old while waiting for the chain tip; the next cycle fetches a new one" });
        return;
      }
      fault("evaluate", "Script evaluation failed: injected fault (a blind evaluator looks just like this)");
      const tx = await bounded(
        (async () => hexOf((await submitTracked((await releaseTx(client, m.utxo, m.policy, response, window)), { source: "autorelease.ts" })).hash))(),
        90_000,
        "building and sending the release",
      );
      submitted.set(m.ref, { tx, at: Date.now() });
      status.released += 1;
      lastReleaseAt = Date.now();
      log({ event: "released", ref: m.ref, rule: ruleOf(m), tx, value: check.value, threshold: check.threshold, responseAgeS: Math.round((Date.now() - check.signedMs) / 1000) });
      onJob?.({ route: "auto-release", ref: m.ref, outcome: "released", tx, value: check.value, rule: ruleOf(m) });
      const confirmed = await waitForTx(tx, 120_000); // the next release shares this wallet's inputs
      log({ event: confirmed ? "confirmed" : "confirmation-not-seen-yet", tx });
      cooldownUntil = Date.now() + COOLDOWN_AFTER_RELEASE_MS;
    } catch (error) {
      const verdict = classify(error);
      // A failure does not count against the policy when it is an error in asking (not a verdict), when the policy is new, or
      // when the previous release was moments ago: in those cases the evaluator may simply not see the inputs yet.
      const young = Date.now() - (firstSeen.get(m.ref) ?? now) < GRACE_AFTER_FIRST_SEEN_MS;
      const afterRelease = Date.now() - lastReleaseAt < GRACE_AFTER_RELEASE_MS;
      const counted = verdict.verdict === "REJECTED" && !young && !afterRelease;
      if (counted) attempts.set(m.ref, (attempts.get(m.ref) ?? 0) + 1);
      else status.retries += 1;
      setState([m.ref], counted && gaveUp(m.ref) ? "gave-up" : "retrying");
      log({ event: counted ? "release-failed" : "release-retry", ref: m.ref, counted, attempt: attempts.get(m.ref) ?? 0, kind: verdict.verdict, why: counted ? "the validator refused it" : young ? "policy seen less than 90 s ago" : afterRelease ? "a release was confirmed less than 2 minutes ago" : "not a verdict", error: brief(error) });
      if (counted && gaveUp(m.ref)) log({ event: "gave-up", ref: m.ref, note: `${MAX_RELEASE_ATTEMPTS} counted failures. Nothing is lost: the buyer can refund after the deadline (${new Date(m.policy.deadlineMs).toISOString()})` });
    }
  };

  const loop = async () => {
    log({ event: "start", dry, allowPaid, ausdCap, intervalS: intervalMs / 1000, beneficiary: `${sellerPkh.slice(0, 8)}…`, templates: allSpecs().map((s) => s.id), faultsInjected: faultsLeft() });
    while (!stopped) {
      let wait = intervalMs;
      try {
        await cycle();
        failures = 0;
      } catch (error) {
        failures += 1;
        wait = Math.min(300_000, intervalMs * 2 ** failures);
        log({ event: "cycle-failed", failures, retryInS: wait / 1000, error: brief(error) });
      }
      status.consecutiveFailures = failures;
      await sleep(wait);
    }
  };
  void loop();

  return { status: (): WatchStatus => status, stop: () => { stopped = true; } };
};

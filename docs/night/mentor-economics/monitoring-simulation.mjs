/** Safe offline simulation: imports ONLY the audited, import-free pure polling module.
 * Run: node --experimental-strip-types monitoring-simulation.mjs
 * Synthetic paths are illustrations, not observed engagement or performance estimates.
 * No wallets/env, network, package install, provider calls or transactions.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const folder = new URL('./', import.meta.url);
const sourceUrl = new URL('../../../cardano/src/polling.ts', folder);
const sourceText = readFileSync(sourceUrl, 'utf8');
assert(!/^\s*import\s/m.test(sourceText), 'Pure source unexpectedly imports another module');
assert(!/process\.|fetch\(|require\(/.test(sourceText), 'Unexpected ambient access');
const {planNext} = await import(sourceUrl.href);
const M = 60_000;
const sourceSha256 = createHash('sha256').update(sourceText).digest('hex');

function underlying(path, t, duration) {
  if (t < 0) return 10;
  switch (path) {
    case 'never': return 10;
    case 'steady': return Math.min(130, 10 + 150 * t / duration);
    case 'late_persistent': return t >= duration - 90_000 ? 110 : 10;
    case 'short_burst': return t >= duration * .40 && t < duration * .40 + 45_000 ? 110 : 10;
    case 'rise_then_fall': return t >= duration * .40 && t < duration * .40 + 120_000 ? 110 : 10;
    case 'stale_burst': return underlying('rise_then_fall', t, duration);
    case 'outage_near_crossing': return underlying('steady', t, duration);
    default: throw new Error(path);
  }
}

function simulate(path, watchMinutes, lookCap, strategy) {
  const duration = watchMinutes * M;
  const unitCost = .01; // current test-token magnitude only, NOT USD/EUR
  let at = strategy === 'end_only' ? duration - M : 0;
  let attempts = 0, responses = 0, failed = 0, detectedAt = null, staleAtDetection = false;
  let lastAttemptAt = null, stopReason = '', maxScheduledOverrunMs = 0;
  const samples = [];
  while (at < duration && attempts < lookCap) {
    assert(at >= 0 && Number.isFinite(at));
    attempts++;
    lastAttemptAt = at;
    const inOutage = path === 'outage_near_crossing' && at >= duration * .55 && at < duration * .75;
    if (inOutage) {
      // Deliberately specified simulator retry, not a full autorelease.ts reproduction.
      failed++;
      if (strategy === 'end_only') { stopReason = 'single observation failed'; break; }
      at += M;
      continue;
    }
    responses++;
    const lag = path === 'stale_burst' ? 3 * M : 0;
    const value = underlying(path, at - lag, duration);
    samples.push({at, value});
    if (value >= 100) {
      detectedAt = at;
      staleAtDetection = underlying(path, at, duration) < 100;
      stopReason = 'reported condition observed';
      break;
    }
    if (strategy === 'end_only') {stopReason = 'one final-window observation'; break;}
    let delay;
    if (strategy === 'adaptive') {
      const plan = planNext({now:at, deadlineMs:duration + 3 * M, stopBeforeMs:3 * M,
        costAusd:unitCost, budgetLeftAusd:(lookCap-attempts)*unitCost,
        samples, threshold:100, cmp:'AtLeast', kind:'counter', baseMs:20_000});
      delay = plan.delayMs;
      if (delay === null) {stopReason = plan.reason; break;}
    } else delay = strategy === 'fixed5' ? 5 * M : 5_000;
    assert(delay > 0 && Number.isFinite(delay), 'Simulation cannot advance');
    // Watcher ticks are simplified to 20s; fast alternative has 5s ticks.
    const tick = strategy === 'fast5' ? 5_000 : 20_000;
    const next = Math.ceil((at + delay) / tick) * tick;
    maxScheduledOverrunMs = Math.max(maxScheduledOverrunMs, next - duration);
    at = next;
  }
  if (!stopReason) stopReason = attempts >= lookCap ? 'look cap reached' : 'monitoring stop reached';
  let firstTrue = null;
  for (let t=0;t<duration;t+=1_000) {if (underlying(path,t,duration)>=100) {firstTrue=t;break;}}
  return {path,watch_minutes:watchMinutes,look_cap:lookCap,strategy,
    attempts,responses,failed_attempts:failed,
    hypothetical_max_test_ausd:attempts*unitCost,
    detected_reported_condition:detectedAt!==null,
    detection_minute:detectedAt===null?'':detectedAt/M,
    first_underlying_crossing_minute:firstTrue===null?'':firstTrue/M,
    detection_delay_minutes:detectedAt===null||firstTrue===null?'':(detectedAt-firstTrue)/M,
    underlying_at_detection_below_threshold:staleAtDetection,
    last_attempt_minute:lastAttemptAt===null?'':lastAttemptAt/M,
    unused_look_allowance:lookCap-attempts,
    scheduled_past_stop_minutes:Math.max(0,maxScheduledOverrunMs)/M,
    stop_reason:stopReason};
}

const strategies=['adaptive','fixed5','end_only','fast5'];
const paths=['never','steady','late_persistent','short_burst','rise_then_fall','stale_burst','outage_near_crossing'];
const rows=[];
for(const duration of [20,60,1440]) for(const cap of [6,60,300]) for(const path of paths) for(const strategy of strategies) {
  const row=simulate(path,duration,cap,strategy);
  // Scenario invariants, not tests that mirror production implementation.
  assert(row.attempts<=cap);
  assert(row.last_attempt_minute<duration);
  assert(row.responses+row.failed_attempts===row.attempts);
  assert(row.attempts+row.unused_look_allowance===cap);
  rows.push(row);
}
assert.equal(rows.length,252);
const esc=x=>{const s=String(x);return /[,"\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
const columns=Object.keys(rows[0]);
writeFileSync(new URL('monitoring-simulation.csv',folder),[columns.join(','),...rows.map(r=>columns.map(c=>esc(r[c])).join(','))].join('\n')+'\n');
const receipt={classification:'Synthetic discrete-time simulation, not observed source histories or full-watcher runtime evidence',
  checked_date:'2026-10-31',source:'cardano/src/polling.ts',source_sha256:sourceSha256,
  node_version:process.version,rows:rows.length,
  assumptions:['One post and one isolated release opportunity; no actual release submitted.',
    'The monitoring stop is three minutes before a later deadline; watch_minutes means usable observation time.',
    'AtLeast100 is an anytime-in-window condition, not an end-only contractual KPI. Strategies are not semantically interchangeable.',
    'Adaptive imports current planNext;20s tick simplification. Alternative schedules are authored comparators, not built product modes.',
    'Fast5 checks every5s until cap; fixed5 every5min; end_only one look one minute before stop.',
    'Failed attempts are conservatively included in max test-token spend; provider actual error billing not verified.',
    'Outage retry1min is a simulator assumption, not an imported watcher failure loop.',
    'stale_burst delays the provider observation3min while current underlying count may already have fallen.',
    'No source caching, release cooldown, transaction concurrency, chain/RPC delays or tenant admission reproduced.'],
  representative_rows:rows.filter(r=>r.watch_minutes===60&&r.look_cap===60),
  invariant_checks:'252 rows passed attempt cap, pre-stop actual fetch time, response/error reconciliation and unused allowance reconciliation'};
writeFileSync(new URL('monitoring-simulation-receipt.json',folder),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({rows:rows.length,source_sha256:sourceSha256,
  selected:receipt.representative_rows.filter(r=>['never','steady','late_persistent'].includes(r.path))},null,2));

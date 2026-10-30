/**
 * Keeper agent: watches a Pay-on-Proof policy over time and releases it when AirnodeHub data satisfies the rule.
 * Nobody starts a cycle. Each cycle the agent decides whether it may spend, buys a signed response, checks it, and
 * either waits, stops, or acts on chain.
 *
 *   tsx src/keeper.ts lock --source nodary:ETH/USD --delta 0.30     lock a policy "ETH/USD at least (now + 0.30)"
 *   tsx src/keeper.ts run [--submit]                                 run the loop against the locked policy
 *
 * Sources: nodary:<feed> (free, Nodary runs its own Airnode) and tweet:<id> (0.01 aUSD per call over x402).
 *
 * Schedule:  one cycle every --interval seconds (default 20); the wait halves when the value is within 0.05% of the
 *            threshold and never goes outside 10 to 120 seconds.
 * Limits:    --budget aUSD for the whole run (default 0.05), --max-cycles (default 15), and it stops 3 minutes before
 *            the policy's deadline. Without --submit it only reports what it would do.
 * Failures:  a failed purchase or fetch backs off (interval x 2^failures, at most 300 s) and the agent stops after 3 in
 *            a row. An on-chain rejection after the local check passed stops it, so it cannot loop on a bad case.
 * Quotas:    one call per cycle, no retries inside a cycle, and a cycle never overlaps the next.
 * Each cycle is appended to out/keeper-log.jsonl.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Address } from "@evolution-sdk/evolution";
import {
  type Policy,
  hexOf,
  inlineDatum,
  loadVector,
  lovelace,
  makeClient,
  paymentKeyHashHex,
  policyData,
  scriptAddress,
  sellerAddressBech32,
  sleep,
  waitForTip,
  waitForTx,
} from "./engine.js";
import { checkAgainst, fetchSigned, findPolicyUtxo, parseSource, policyViewOf, releaseTx, repoRoot, submitWindow, withRetry } from "./proof.js";

const outDir = new URL("../out/", import.meta.url);
const logFile = new URL("keeper-log.jsonl", outDir);
const policyFile = new URL("keeper-policy.json", outDir);

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    source: { type: "string" },
    delta: { type: "string" },
    below: { type: "boolean", default: false },
    minutes: { type: "string", default: "40" },
    "max-age": { type: "string", default: "300" },
    utxo: { type: "string" },
    interval: { type: "string", default: "20" },
    budget: { type: "string", default: "0.05" },
    "max-cycles": { type: "string", default: "15" },
    submit: { type: "boolean", default: false },
  },
});

const log = (entry: Record<string, unknown>) => {
  mkdirSync(outDir, { recursive: true });
  appendFileSync(logFile, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
  console.log(Object.entries(entry).map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`).join("  "));
};

/** Provider reads drop on a bad connection; try a few times, logging each retry. */
const retry = <T>(label: string, fn: () => Promise<T>) =>
  withRetry(fn, 5, (attempt, error) => log({ event: "retry", label, attempt, error: String((error as Error).message).slice(0, 80) }));

const decimalsOf = (text: string) => (text.includes(".") ? text.split(".")[1].length : 0);

const client = makeClient("MNEMONIC");
const mode = positionals[0];

if (mode === "lock") {
  const source = parseSource(values.source ?? "nodary:ETH/USD");
  const { file, response } = await fetchSigned(source);
  const made = spawnSync(process.execPath, ["checks/05-make-vector.mjs", file, "keeper"], { cwd: repoRoot, encoding: "utf8" });
  if (made.status !== 0) throw new Error(`vector failed: ${made.stderr.slice(-300)}`);
  const vec = loadVector("keeper");
  const first = vec.slotsText[0];
  // Prices carry up to three decimals today and could carry more; the contract halts on more decimals than the scale.
  const scale = Math.max(decimalsOf(first), source.spec.startsWith("nodary") ? 6 : 0);
  const delta = Number(values.delta ?? (scale > 0 ? "0.30" : "2"));
  const target = Number(first) + (values.below ? -delta : delta);
  const threshold = Math.round(target * 10 ** scale);
  const nowMs = Date.now();
  const policy: Policy = {
    signerHex: vec.pubkeyHex,
    requestHashHex: vec.requestHashHex,
    prefixHex: vec.prefixHex,
    separatorsHex: vec.separatorsHex,
    suffixHex: vec.suffixHex,
    scale,
    slotFrom: 0,
    slotTo: 1,
    cmp: values.below ? "Below" : "AtLeast",
    threshold,
    settleAfterMs: Number(response.timestamp) * 1000 - 3_600_000,
    deadlineMs: nowMs + Number(values.minutes) * 60_000,
    maxAgeMs: Number(values["max-age"]) * 1000,
    beneficiaryHex: paymentKeyHashHex(sellerAddressBech32()),
    refundToHex: paymentKeyHashHex(Address.toBech32(await client.address())),
    payout: 5_000_000n,
  };
  const submitted = await (await client.newTx().payToAddress({ address: scriptAddress, assets: lovelace(5_000_000n), datum: inlineDatum(policyData(policy)) }).build()).signAndSubmit();
  const hash = hexOf(submitted.hash);
  console.log(`policy locked: ${hash}  (${source.spec} ${values.below ? "below" : "at least"} ${target}, now ${first}; deadline in ${values.minutes} min; accepts a response up to ${values["max-age"]} s old)`);
  await waitForTx(hash);
  await sleep(20_000);
  const utxo = (await retry("getUtxos", () => client.getUtxos(scriptAddress))).find((u) => hexOf(u.transactionId.hash) === hash);
  if (!utxo) throw new Error("The policy UTxO is not visible yet");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(policyFile, JSON.stringify({ utxo: `${hash}#${Number(utxo.index)}`, source: source.spec }, null, 2));
  console.log(`ready: ${hash}#${Number(utxo.index)}   next: tsx src/keeper.ts run --submit`);
} else if (mode === "run") {
  const saved = (() => {
    try {
      return JSON.parse(readFileSync(policyFile, "utf8")) as { utxo: string; source: string };
    } catch {
      return undefined;
    }
  })();
  const ref = values.utxo ?? saved?.utxo;
  const source = parseSource(values.source ?? saved?.source ?? "nodary:ETH/USD");
  if (!ref) throw new Error("No policy. Run `tsx src/keeper.ts lock` first, or pass --utxo <txHash>#<index>");
  const utxo = await retry("getUtxos", () => findPolicyUtxo(client, ref));
  if (!utxo) throw new Error(`Policy ${ref} not found at the validator (spent, or not visible yet)`);
  const policy = policyViewOf(utxo);

  const baseInterval = Number(values.interval);
  const budget = Number(values.budget);
  const maxCycles = Number(values["max-cycles"]);
  let spent = 0;
  let failures = 0;
  let outcome = "max cycles reached";
  log({ event: "start", policy: ref, source: source.spec, rule: `${policy.cmp} ${policy.threshold / 10 ** policy.scale}`, budgetAusd: budget, maxCycles, baseIntervalS: baseInterval, submit: values.submit });

  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    if (spent + source.costAusd > budget) { outcome = "budget exhausted"; break; }
    if (Date.now() > policy.deadlineMs - 3 * 60_000) { outcome = "policy deadline close"; break; }

    let fetched;
    try {
      fetched = await fetchSigned(source);
    } catch (error) {
      failures += 1;
      const wait = Math.min(300, baseInterval * 2 ** failures);
      log({ cycle, event: "fetch-failed", failures, retryInS: wait, error: String((error as Error).message) });
      if (failures >= 3) { outcome = "3 failures in a row"; break; }
      await sleep(wait * 1000);
      continue;
    }
    failures = 0;
    spent = Math.round((spent + fetched.spentAusd) * 1e4) / 1e4;
    const { response } = fetched;
    const check = checkAgainst(policy, response);
    if (!check.sameRequest) {
      log({ cycle, event: "wrong-request", got: response.requestHash.slice(0, 14) });
      outcome = "the response answers a different request than the policy pins";
      break;
    }
    const { met, signedMs } = check;
    const ratio = Math.abs(check.scaledThreshold - check.scaledValue) / Math.max(1, check.scaledThreshold);
    const wait = Math.max(10, Math.min(120, ratio < 0.0005 ? baseInterval / 2 : baseInterval));
    log({ cycle, value: check.value, threshold: check.threshold, met, ageS: Math.round((Date.now() - signedMs) / 1000), spentAusd: spent, ...(met ? {} : { nextInS: wait }) });

    if (!met) { await sleep(wait * 1000); continue; }
    if (!values.submit) { outcome = "rule met (dry run, nothing released)"; break; }

    try {
      const window = submitWindow(policy, signedMs);
      await waitForTip(window.from + 2_000);
      const built = await releaseTx(client, utxo, policy, response, window);
      const released = await built.signAndSubmit();
      const hash = hexOf(released.hash);
      log({ cycle, event: "released", tx: hash, responseAgeS: Math.round((Date.now() - signedMs) / 1000) });
      outcome = `released ${hash}`;
      const confirmed = await waitForTx(hash);
      log({ cycle, event: confirmed ? "confirmed" : "confirmation-not-seen-yet", tx: hash });
    } catch (error) {
      log({ cycle, event: "on-chain-rejected", error: String((error as Error).message).slice(0, 160) });
      outcome = "rejected on chain after the local check passed";
    }
    break;
  }
  log({ event: "stop", outcome, spentAusd: spent });
} else {
  console.log("usage: tsx src/keeper.ts lock [--source nodary:ETH/USD|tweet:<id>] [--delta n] [--below] | run [--submit] [--interval s] [--budget aUSD] [--max-cycles n]");
}

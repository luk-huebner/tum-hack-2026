import { submitTracked } from "./tx-tracking.js";
/**
 * Pay-on-Proof on Cardano preprod, end to end, with a REAL signed AirnodeHub response.
 *
 *   tsx src/engine-demo.ts lock            lock six policy UTxOs in one transaction (spends test ADA)
 *   tsx src/engine-demo.ts adopt <txHash>  rebuild out/lock.json from a lock transaction already on chain
 *   tsx src/engine-demo.ts attempts        try the tamper cases; each must fail at script evaluation (nothing is submitted)
 *   tsx src/engine-demo.ts release         release the valid case with the real signed response (submits)
 *   tsx src/engine-demo.ts refund          refund the short-deadline case after its deadline (submits)
 *
 * The vector is cardano/vectors/meteo.json: Open-Meteo rainfall for Munich, 10 to 23 Oct 2026, 14 daily values (26.20 mm),
 * signed by the Open-Meteo Airnode on 30 Oct 2026. Because the response is a few hours old when this runs, the demo
 * policies allow an age of 24 hours. A live policy would use minutes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Address, KeyHash } from "@evolution-sdk/evolution";
import {
  type Policy,
  hexOf,
  inlineDatum,
  loadVector,
  lovelace,
  makeClient,
  paymentKeyHashHex,
  policyData,
  refundData,
  releaseData,
  script,
  scriptAddress,
  sellerAddressBech32,
} from "./engine.js";

const HOUR = 3_600_000;
const PAYOUT = 5_000_000n;
const CASE_NAMES = ["valid", "stale-limit", "wrong-request", "wrong-signer", "rule-not-met", "refund"];
const vec = loadVector("meteo");
const signedMs = vec.timestamp * 1000;
const outDir = new URL("../out/", import.meta.url);
const lockFile = new URL("lock.json", outDir);

const client = makeClient("MNEMONIC");
const buyerAddress = await client.address();
const buyerPkh = paymentKeyHashHex(Address.toBech32(buyerAddress));
const sellerPkh = paymentKeyHashHex(sellerAddressBech32());

const basePolicy = (nowMs: number): Policy => ({
  signerHex: vec.pubkeyHex,
  requestHashHex: vec.requestHashHex,
  prefixHex: vec.prefixHex,
  separatorsHex: vec.separatorsHex,
  suffixHex: vec.suffixHex,
  scale: 2,
  slotFrom: 0,
  slotTo: 14,
  cmp: "Below",
  threshold: 3000, // below 30.00 mm
  settleAfterMs: signedMs - HOUR,
  deadlineMs: nowMs + 4 * HOUR,
  maxAgeMs: 24 * HOUR,
  beneficiaryHex: sellerPkh,
  refundToHex: buyerPkh,
  payout: PAYOUT,
});

const GENERATOR_POINT = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

const cases = (nowMs: number): { name: string; policy: Policy }[] => {
  const base = basePolicy(nowMs);
  return [
    { name: "valid", policy: base },
    { name: "stale-limit", policy: { ...base, maxAgeMs: 300_000 } },
    { name: "wrong-request", policy: { ...base, requestHashHex: "00".repeat(31) + "01" } },
    { name: "wrong-signer", policy: { ...base, signerHex: GENERATOR_POINT } },
    { name: "rule-not-met", policy: { ...base, threshold: 2000 } },
    { name: "refund", policy: { ...base, deadlineMs: nowMs + 10 * 60_000 } },
  ];
};

interface LockRecord {
  txHash: string;
  cases: { name: string; index: number; policy: { deadlineMs: number; maxAgeMs: number; threshold: number } }[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls Blockfrost until the transaction is in a block. A timer keeps the process alive while it waits. */
const waitForTx = async (txHash: string, timeoutMs = 180_000) => {
  const base = process.env.BLOCKFROST_BASE_URL ?? "https://cardano-preprod.blockfrost.io/api/v0";
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await fetch(`${base}/txs/${txHash}`, { headers: { project_id: process.env.BLOCKFROST_PROJECT_ID ?? "" } });
    if (response.ok) return true;
    await sleep(5000);
  }
  return false;
};

/** The node validates a transaction against its own latest slot, which trails the wall clock by up to a minute on preprod.
 *  A transaction that starts "in the past" can still be refused as OutsideValidityIntervalUTxO, so wait for the tip. */
const waitForTip = async (minMs: number, timeoutMs = 240_000) => {
  const base = process.env.BLOCKFROST_BASE_URL ?? "https://cardano-preprod.blockfrost.io/api/v0";
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await fetch(`${base}/blocks/latest`, { headers: { project_id: process.env.BLOCKFROST_PROJECT_ID ?? "" } });
    if (response.ok && ((await response.json()) as { time: number }).time * 1000 >= minMs) return;
    await sleep(5000);
  }
  throw new Error("The chain tip did not reach the start of the validity interval in time");
};

const findUtxo = async (txHash: string, index: number) => {
  const utxos = await client.getUtxos(scriptAddress);
  const found = utxos.find((u) => hexOf(u.transactionId.hash) === txHash && Number(u.index) === index);
  if (!found) throw new Error(`UTxO ${txHash}#${index} not found at the script address (already spent?)`);
  return found;
};

/** Reads the policies back from the chain, so the record always matches what was actually locked. */
const recordLock = async (txHash: string) => {
  const utxos = (await client.getUtxos(scriptAddress))
    .filter((u) => hexOf(u.transactionId.hash) === txHash)
    .sort((a, b) => Number(a.index) - Number(b.index));
  if (utxos.length === 0) throw new Error("No script outputs found for that transaction yet");
  const record: LockRecord = {
    txHash,
    cases: utxos.map((u, i) => {
      const data = (u.datumOption as unknown as { data?: { fields?: unknown[] } } | undefined)?.data;
      const f = data?.fields;
      if (!f) throw new Error(`Output ${u.index} has no readable inline datum`);
      return {
        name: CASE_NAMES[i] ?? `case-${i}`,
        index: Number(u.index),
        policy: { deadlineMs: Number(f[11]), maxAgeMs: Number(f[12]), threshold: Number(f[9]) },
      };
    }),
  };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(lockFile, JSON.stringify(record, null, 2));
  for (const c of record.cases) {
    console.log(`  output ${c.index}: ${c.name} (deadline ${new Date(c.policy.deadlineMs).toISOString()}, max age ${c.policy.maxAgeMs / 1000} s, threshold ${c.policy.threshold})`);
  }
};

const readLock = (): LockRecord => {
  if (!existsSync(lockFile)) throw new Error("No lock record yet. Run: tsx src/engine-demo.ts lock");
  return JSON.parse(readFileSync(lockFile, "utf8"));
};

const releaseTx = (utxo: Awaited<ReturnType<typeof findUtxo>>, opts: { slotsHex?: string[]; fromMs: number; toMs: number }) =>
  client
    .newTx()
    .collectFrom({ inputs: [utxo], redeemer: releaseData(vec.timestamp, opts.slotsHex ?? vec.slotsHex, vec.signatureHex) })
    .attachScript({ script })
    .payToAddress({ address: Address.fromBech32(sellerAddressBech32()), assets: lovelace(PAYOUT) })
    .setValidity({ from: BigInt(opts.fromMs), to: BigInt(opts.toMs) })
    .build();

const short = (e: unknown) => String((e as Error)?.message ?? e).replace(/\s+/g, " ").slice(0, 330);

const step = process.argv[2];

if (step === "lock") {
  const list = cases(Date.now());
  let tx = client.newTx();
  for (const c of list) tx = tx.payToAddress({ address: scriptAddress, assets: lovelace(5_000_000n), datum: inlineDatum(policyData(c.policy)) });
  const built = await tx.build();
  const submitted = await submitTracked(built, { source: "engine-demo.ts" });
  const hash = hexOf(submitted.hash);
  console.log(`lock transaction submitted: ${hash}`);
  console.log((await waitForTx(hash)) ? "confirmed in a block" : "not confirmed yet (check the explorer)");
  console.log(`Explorer: https://preprod.cardanoscan.io/transaction/${hash}`);
  console.log(`script address ${Address.toBech32(scriptAddress)}`);
  await recordLock(hash);
} else if (step === "bench") {
  // Two standing policies for the judges' tamper bench, both open until Sat 31 Oct 20:00 UTC (the judging is Sat 15:00 to 17:00 Munich time).
  const base = basePolicy(Date.now());
  const deadlineMs = Date.UTC(2026, 9, 31, 20, 0, 0);
  const benchCases = [
    // The beneficiary is the BUYER's key, not the seller's: the seller's keeper (autorelease.ts) releases every policy that pays the
    // seller key and whose rule it can prove, and it once released the standing bench that way. The bench is for evaluating, not paying.
    { name: "bench-48h", policy: { ...base, beneficiaryHex: buyerPkh, deadlineMs, maxAgeMs: 48 * HOUR } },
    { name: "bench-5min", policy: { ...base, beneficiaryHex: buyerPkh, deadlineMs, maxAgeMs: 300_000 } },
  ];
  let tx = client.newTx();
  for (const c of benchCases) tx = tx.payToAddress({ address: scriptAddress, assets: lovelace(5_000_000n), datum: inlineDatum(policyData(c.policy)) });
  const submitted = await submitTracked((await tx.build()), { source: "engine-demo.ts" });
  const hash = hexOf(submitted.hash);
  console.log(`bench lock submitted: ${hash}`);
  console.log((await waitForTx(hash)) ? "confirmed in a block" : "not confirmed yet (check the explorer)");
  const utxos = (await client.getUtxos(scriptAddress)).filter((u) => hexOf(u.transactionId.hash) === hash).sort((a, b) => Number(a.index) - Number(b.index));
  benchCases.forEach((c, i) => console.log(`  ${c.name}: ${hash}#${utxos[i] ? Number(utxos[i].index) : "?"}`));
} else if (step === "adopt") {
  const hash = process.argv[3];
  if (!hash) throw new Error("usage: tsx src/engine-demo.ts adopt <txHash>");
  await recordLock(hash);
} else if (step === "attempts") {
  const lock = readLock();
  const now = Date.now();
  const window = { fromMs: now - 60_000, toMs: now + 15 * 60_000 };
  const edited = ["0.90", ...vec.slotsText.slice(1)].map((s) => Buffer.from(s).toString("hex"));
  const tries: { label: string; caseName: string; opts: Parameters<typeof releaseTx>[1]; expectOk: boolean }[] = [
    { label: "edited value (d00 6.90 -> 0.90)", caseName: "valid", opts: { ...window, slotsHex: edited }, expectOk: false },
    { label: "too old (policy allows 5 minutes, response is hours old)", caseName: "stale-limit", opts: window, expectOk: false },
    { label: "different request (policy pinned to another request hash)", caseName: "wrong-request", opts: window, expectOk: false },
    { label: "wrong signer (policy pinned to another key)", caseName: "wrong-signer", opts: window, expectOk: false },
    { label: "rule not met (sum 26.20 mm is not below 20.00 mm)", caseName: "rule-not-met", opts: window, expectOk: false },
    { label: "attestation from the future (validity starts before it was signed)", caseName: "valid", opts: { fromMs: signedMs - 3_600_000, toMs: signedMs - 3_000_000 }, expectOk: false },
    { label: "valid response, valid policy (control: must build)", caseName: "valid", opts: window, expectOk: true },
  ];
  for (const t of tries) {
    const c = lock.cases.find((x) => x.name === t.caseName)!;
    try {
      const utxo = await findUtxo(lock.txHash, c.index);
      await releaseTx(utxo, t.opts);
      console.log(`${t.expectOk ? "OK           " : "NOT REJECTED!"} ${t.label}: transaction built (not submitted)`);
    } catch (e) {
      console.log(`${t.expectOk ? "UNEXPECTED FAILURE" : "REJECTED     "} ${t.label}\n    ${short(e)}`);
    }
  }
} else if (step === "release") {
  const lock = readLock();
  const c = lock.cases.find((x) => x.name === "valid")!;
  const utxo = await findUtxo(lock.txHash, c.index);
  const now = Date.now();
  const built = await releaseTx(utxo, { fromMs: now - 60_000, toMs: now + 15 * 60_000 });
  const submitted = await submitTracked(built, { source: "engine-demo.ts" });
  const hash = hexOf(submitted.hash);
  console.log(`release submitted: ${hash}`);
  console.log((await waitForTx(hash)) ? "confirmed in a block" : "not confirmed yet (check the explorer)");
  console.log(`Explorer: https://preprod.cardanoscan.io/transaction/${hash}`);
} else if (step === "refund") {
  const lock = readLock();
  const c = lock.cases.find((x) => x.name === "refund")!;
  const utxo = await findUtxo(lock.txHash, c.index);
  const now = Date.now();
  const deadline = c.policy.deadlineMs;
  if (now < deadline) console.log(`note: the deadline is in ${Math.round((deadline - now) / 1000)} s; a refund now must fail`);
  const fromMs = Math.max(now - 60_000, deadline + 1_000);
  await waitForTip(fromMs + 2_000);
  const built = await client
    .newTx()
    .collectFrom({ inputs: [utxo], redeemer: refundData() })
    .attachScript({ script })
    .addSigner({ keyHash: KeyHash.fromHex(buyerPkh) })
    // Slots are whole seconds and round down, so start one second after the deadline to satisfy lower >= deadline.
    .setValidity({ from: BigInt(fromMs), to: BigInt(now + 15 * 60_000) })
    .build();
  const submitted = await submitTracked(built, { source: "engine-demo.ts" });
  const hash = hexOf(submitted.hash);
  console.log(`refund submitted: ${hash}`);
  console.log((await waitForTx(hash)) ? "confirmed in a block" : "not confirmed yet (check the explorer)");
  console.log(`Explorer: https://preprod.cardanoscan.io/transaction/${hash}`);
} else {
  console.log("usage: tsx src/engine-demo.ts lock | adopt <txHash> | attempts | release | refund");
}

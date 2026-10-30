/**
 * Creator Pay shape on Cardano preprod, with a REAL signed AirnodeHub response about a tweet.
 *
 *   tsx src/creator-demo.ts lock       lock two policies on tweet 20 (spends 10 tADA of test ADA)
 *   tsx src/creator-demo.ts attempts   KPI not met; inflated likes; the real response against the met KPI (nothing is submitted)
 *   tsx src/creator-demo.ts release    release the policy whose KPI is met
 *
 * The vector is cardano/vectors/tweet.json: {"id":"20","likes":...,"replies":...,"retweets":...,"views":0} for tweet 20,
 * signed by the TwitterAPI.io Airnode. The tweet id is part of the signed text and of the request hash, so a response
 * about another tweet, or about a deleted one (an empty id), cannot satisfy the policy.
 * Policy "kpi-met": pay 5 tADA if the tweet has at least 300,000 likes. Policy "kpi-not-met": at least 400,000.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Address } from "@evolution-sdk/evolution";
import {
  type Policy,
  type SignedResponse,
  hexOf,
  inlineDatum,
  loadVector,
  lovelace,
  makeClient,
  paymentKeyHashHex,
  policyData,
  releaseDataFromResponse,
  script,
  scriptAddress,
  sellerAddressBech32,
  sleep,
  waitForTip,
  waitForTx,
} from "./engine.js";

const vec = loadVector("tweet");
const signedMs = vec.timestamp * 1000;
const outDir = new URL("../out/", import.meta.url);
const lockFile = new URL("creator-lock.json", outDir);
const response: SignedResponse = JSON.parse(readFileSync(new URL("../vectors/tweet-response.json", import.meta.url), "utf8"));

const client = makeClient("MNEMONIC");
const buyerPkh = paymentKeyHashHex(Address.toBech32(await client.address()));
const sellerPkh = paymentKeyHashHex(sellerAddressBech32());

const policyFor = (threshold: number, nowMs: number): Policy => ({
  signerHex: vec.pubkeyHex,
  requestHashHex: vec.requestHashHex,
  prefixHex: vec.prefixHex,
  separatorsHex: vec.separatorsHex,
  suffixHex: vec.suffixHex,
  scale: 0, // whole numbers
  slotFrom: 0, // slot 0 is "likes"; replies, retweets and views are signed but not summed
  slotTo: 1,
  cmp: "AtLeast",
  threshold,
  settleAfterMs: signedMs - 3_600_000,
  deadlineMs: nowMs + 3 * 3_600_000,
  maxAgeMs: 3_600_000, // a live policy would use minutes; the stored response is minutes old
  beneficiaryHex: sellerPkh,
  refundToHex: buyerPkh,
  payout: 5_000_000n,
});

const NAMES = ["kpi-met", "kpi-not-met"];
const found = async (txHash: string, index: number) => {
  const utxo = (await client.getUtxos(scriptAddress)).find((u) => hexOf(u.transactionId.hash) === txHash && Number(u.index) === index);
  if (!utxo) throw new Error(`UTxO ${txHash}#${index} not found (spent, or not visible yet)`);
  return utxo;
};
const readLock = (): { txHash: string; indexes: number[] } => {
  if (!existsSync(lockFile)) throw new Error("No lock record. Run: tsx src/creator-demo.ts lock");
  return JSON.parse(readFileSync(lockFile, "utf8"));
};

const tx = (utxo: Awaited<ReturnType<typeof found>>, resp: SignedResponse, fromMs: number, toMs: number) =>
  client
    .newTx()
    .collectFrom({ inputs: [utxo], redeemer: releaseDataFromResponse(resp) })
    .attachScript({ script })
    .payToAddress({ address: Address.fromBech32(sellerAddressBech32()), assets: lovelace(5_000_000n) })
    .setValidity({ from: BigInt(fromMs), to: BigInt(toMs) })
    .build();

const step = process.argv[2];

if (step === "lock") {
  const nowMs = Date.now();
  let builder = client.newTx();
  for (const threshold of [300_000, 400_000]) {
    builder = builder.payToAddress({ address: scriptAddress, assets: lovelace(5_000_000n), datum: inlineDatum(policyData(policyFor(threshold, nowMs))) });
  }
  const submitted = await (await builder.build()).signAndSubmit();
  const hash = hexOf(submitted.hash);
  console.log(`lock submitted: ${hash}`);
  console.log((await waitForTx(hash)) ? "confirmed in a block" : "not confirmed yet");
  await sleep(20_000); // the evaluator needs a moment to see fresh outputs
  const utxos = (await client.getUtxos(scriptAddress)).filter((u) => hexOf(u.transactionId.hash) === hash).sort((a, b) => Number(a.index) - Number(b.index));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(lockFile, JSON.stringify({ txHash: hash, indexes: utxos.map((u) => Number(u.index)) }, null, 2));
  utxos.forEach((u, i) => console.log(`  ${NAMES[i]}: ${hash}#${Number(u.index)}`));
} else if (step === "attempts") {
  const lock = readLock();
  const now = Date.now();
  const inflated = { ...response, data: response.data.replace(/"likes":\d+/, '"likes":999999') };
  const from = Math.max(signedMs + 2_000, now - 60_000);
  const to = from + 10 * 60_000;
  await waitForTip(from + 2_000);
  const tries = [
    { label: "real response, KPI met (>= 300,000 likes): control", index: lock.indexes[0], resp: response, expectOk: true },
    { label: "real response, KPI not met (needs 400,000 likes, tweet has about 309,000)", index: lock.indexes[1], resp: response, expectOk: false },
    { label: "likes inflated to 999,999 in the signed text, against the 400,000 policy (the forged screenshot)", index: lock.indexes[1], resp: inflated, expectOk: false },
    { label: "real response, KPI met: control again", index: lock.indexes[0], resp: response, expectOk: true },
  ];
  for (const t of tries) {
    try {
      await tx(await found(lock.txHash, t.index), t.resp, from, to);
      console.log(`${t.expectOk ? "ACCEPTED " : "NOT REJECTED!"} ${t.label}`);
    } catch (e) {
      console.log(`${t.expectOk ? "UNEXPECTED FAILURE" : "REJECTED "} ${t.label} | ${String((e as Error).message).slice(0, 90)}`);
    }
  }
} else if (step === "release") {
  const lock = readLock();
  const from = Math.max(signedMs + 2_000, Date.now() - 60_000);
  await waitForTip(from + 2_000);
  const submitted = await (await tx(await found(lock.txHash, lock.indexes[0]), response, from, from + 10 * 60_000)).signAndSubmit();
  const hash = hexOf(submitted.hash);
  console.log(`release submitted: ${hash}`);
  console.log((await waitForTx(hash)) ? "confirmed in a block" : "not confirmed yet");
  console.log(`https://preprod.cardanoscan.io/transaction/${hash}`);
} else {
  console.log("usage: tsx src/creator-demo.ts lock | attempts | release");
}

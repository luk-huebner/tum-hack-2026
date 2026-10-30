/**
 * Live Pay-on-Proof run on Cardano preprod: a FRESH signed AirnodeHub response releases a policy that only accepts
 * responses up to 5 minutes old.
 *
 *   tsx src/live.ts          prints the plan and the cost, does nothing
 *   tsx src/live.ts --pay    locks a 5-minute policy (5 tADA), pays 0.1 aUSD for a fresh Open-Meteo response,
 *                            verifies it, and releases the policy within the policy's age limit
 *
 * The request is the one the policy pins: Open-Meteo rainfall for Munich, 10 to 23 Oct 2026 (a settled window), 14 daily
 * values projected as d00..d13. The response is new (new timestamp, new signature), the rainfall is history.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const vec = loadVector("meteo"); // supplies the pinned key, request hash and template; its signature is NOT used here
const PAYOUT = 5_000_000n;
const MAX_AGE_MS = 300_000;

if (!process.argv.includes("--pay")) {
  console.log("Plan: lock one 5 tADA policy (accepts a response up to 5 minutes old), pay 0.1 aUSD to AirnodeHub for a fresh");
  console.log("signed Open-Meteo response, verify its signer and request hash, then release the policy with it.");
  console.log("Run again with --pay to do it. Needs PAYER_PRIVATE_KEY (Base Sepolia, aUSD) in ../.env and a funded preprod wallet in .env.");
  process.exit(0);
}

const client = makeClient("MNEMONIC");
const buyerPkh = paymentKeyHashHex(Address.toBech32(await client.address()));
const sellerPkh = paymentKeyHashHex(sellerAddressBech32());
const nowMs = Date.now();

const policy: Policy = {
  signerHex: vec.pubkeyHex,
  requestHashHex: vec.requestHashHex,
  prefixHex: vec.prefixHex,
  separatorsHex: vec.separatorsHex,
  suffixHex: vec.suffixHex,
  scale: 2,
  slotFrom: 0,
  slotTo: 14,
  cmp: "Below",
  threshold: 3000,
  // ERA5 data arrives with a 5-day delay, so the window that ended on 23 Oct is settled from 28 Oct.
  settleAfterMs: Date.UTC(2026, 9, 28, 23, 59, 59),
  deadlineMs: nowMs + 30 * 60_000,
  maxAgeMs: MAX_AGE_MS,
  beneficiaryHex: sellerPkh,
  refundToHex: buyerPkh,
  payout: PAYOUT,
};

// 1. Lock
const lockBuilt = await client.newTx().payToAddress({ address: scriptAddress, assets: lovelace(5_000_000n), datum: inlineDatum(policyData(policy)) }).build();
const lockSubmitted = await lockBuilt.signAndSubmit();
const lockHash = hexOf(lockSubmitted.hash);
console.log(`1. policy locked: ${lockHash} (5 tADA, accepts a response up to ${MAX_AGE_MS / 1000} s old)`);
await waitForTx(lockHash);
await sleep(20_000); // the evaluator needs a moment to see a fresh output

// 2. Fresh signed response from AirnodeHub, paid in aUSD on Base Sepolia
const paid = spawnSync(
  process.execPath,
  ["--env-file=.env", "checks/10-paid-call.ts", "meteo-rain", "48.14", "11.58", "2026-10-10", "2026-10-23"],
  { cwd: repoRoot, encoding: "utf8" },
);
const saved = /saved (\S+\.json)/.exec(paid.stderr)?.[1];
if (paid.status !== 0 || !saved) throw new Error(`The paid AirnodeHub call failed: ${paid.stderr.slice(-400)}`);
console.log(`2. fresh signed response: ${(/payment settled: (\S+)/.exec(paid.stderr) ?? [])[1] ?? "(payment receipt not shown)"}`);
const response = JSON.parse(readFileSync(saved.replace(/^\/(\w:)/, "$1"), "utf8")) as SignedResponse;
if (response.requestHash.replace(/^0x/, "") !== vec.requestHashHex) throw new Error("The fresh response answers a different request than the policy pins");

// 3. Release inside the policy's age limit
const signedMs = Number(response.timestamp) * 1000;
const fromMs = signedMs + 2_000; // slots round down to whole seconds; the validity must start after the signing time
const toMs = signedMs + MAX_AGE_MS - 20_000; // and end before the response becomes too old
await waitForTip(fromMs + 2_000);
const utxo = (await client.getUtxos(scriptAddress)).find((u) => hexOf(u.transactionId.hash) === lockHash);
if (!utxo) throw new Error("The locked policy UTxO is not visible yet");
const released = await (
  await client
    .newTx()
    .collectFrom({ inputs: [utxo], redeemer: releaseDataFromResponse(response) })
    .attachScript({ script })
    .payToAddress({ address: Address.fromBech32(sellerAddressBech32()), assets: lovelace(PAYOUT) })
    .setValidity({ from: BigInt(fromMs), to: BigInt(toMs) })
    .build()
).signAndSubmit();
const releaseHash = hexOf(released.hash);
console.log(`3. released: ${releaseHash} (response was ${Math.round((Date.now() - signedMs) / 1000)} s old when submitted)`);
await waitForTx(releaseHash);
console.log(`   https://preprod.cardanoscan.io/transaction/${releaseHash}`);

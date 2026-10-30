/**
 * Judge tamper bench: try a signed AirnodeHub response against a locked policy on Cardano preprod.
 *
 *   tsx src/judge.ts --utxo <txHash>#<index> --response <file.json> [--submit]
 *
 * The response file holds {airnode, requestHash, timestamp, data, signature} exactly as an Airnode returns it
 * (POST / form). Edit any field, swap the file, or sign your own: the CONTRACT decides, this script does no checks.
 * It builds the release transaction and the node's script evaluation runs the validator:
 *   ACCEPTED  the validator ran to completion; without --submit nothing is sent
 *   REJECTED  the validator refused it (or the policy's own time rules did); nothing is sent
 * Needs a funded preprod wallet (MNEMONIC) and a Blockfrost key in .env, only for fees and collateral.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Address } from "@evolution-sdk/evolution";
import {
  type SignedResponse,
  hexOf,
  lovelace,
  makeClient,
  policyViewOf,
  releaseDataFromResponse,
  script,
  scriptAddress,
} from "./engine.js";

const { values } = parseArgs({ options: { utxo: { type: "string" }, response: { type: "string" }, submit: { type: "boolean", default: false } } });
if (!values.utxo || !values.response) {
  console.log("usage: tsx src/judge.ts --utxo <txHash>#<index> --response <file.json> [--submit]");
  process.exit(1);
}

const [txHash, indexText] = values.utxo.split("#");
const response = JSON.parse(readFileSync(values.response, "utf8")) as SignedResponse;
const client = makeClient("MNEMONIC");

const utxos = await client.getUtxos(scriptAddress);
const utxo = utxos.find((u) => hexOf(u.transactionId.hash) === txHash && Number(u.index) === Number(indexText));
if (!utxo) {
  console.log(`No policy UTxO ${values.utxo} at the validator address (spent, or a typo).`);
  process.exit(1);
}

const policy = policyViewOf(utxo);
const now = Date.now();
const ageSeconds = Math.round(now / 1000 - Number(response.timestamp));
console.log(`policy: pays ${policy.payout} lovelace if the sum is ${policy.cmp === "Below" ? "below" : "at least"} ${policy.threshold / 10 ** policy.scale}; max response age ${policy.maxAgeMs / 1000} s; release before ${new Date(policy.deadlineMs).toISOString()}`);
console.log(`response: signed by ${response.airnode} for request ${response.requestHash.slice(0, 12)}..., ${ageSeconds} s old`);

try {
  const built = await client
    .newTx()
    .collectFrom({ inputs: [utxo], redeemer: releaseDataFromResponse(response) })
    .attachScript({ script })
    // The contract only checks the beneficiary's payment key hash, so an enterprise address (header 0x60) is enough.
    .payToAddress({ address: Address.fromHex(`60${policy.beneficiaryHex}`), assets: lovelace(policy.payout) })
    .setValidity({ from: BigInt(now - 60_000), to: BigInt(Math.min(now + 15 * 60_000, policy.deadlineMs - 1_000)) })
    .build();
  if (!values.submit) {
    console.log("ACCEPTED: the validator ran to completion on this response. Nothing was sent (add --submit to release the funds).");
  } else {
    const submitted = await built.signAndSubmit();
    console.log(`ACCEPTED and released: https://preprod.cardanoscan.io/transaction/${hexOf(submitted.hash)}`);
  }
} catch (error) {
  const message = String((error as Error)?.message ?? error).replace(/\s+/g, " ").slice(0, 200);
  console.log(`REJECTED: ${message}`);
  if (process.env.JUDGE_DEBUG) console.log(JSON.stringify(error, Object.getOwnPropertyNames(error as object), 1).replace(/\s+/g, " ").slice(0, 2500));
}

import { submitTracked } from "./tx-tracking.js";
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
import { type SignedResponse, hexOf, makeClient } from "./engine.js";
import { checkAgainst, evaluateRelease, evaluationWindow, findPolicyUtxo, policyViewOf, releaseTx } from "./proof.js";

const { values } = parseArgs({ options: { utxo: { type: "string" }, response: { type: "string" }, submit: { type: "boolean", default: false } } });
if (!values.utxo || !values.response) {
  console.log("usage: tsx src/judge.ts --utxo <txHash>#<index> --response <file.json> [--submit]");
  process.exit(1);
}

const response = JSON.parse(readFileSync(values.response, "utf8")) as SignedResponse;
const client = makeClient("MNEMONIC");

const utxo = await findPolicyUtxo(client, values.utxo);
if (!utxo) {
  console.log(`No policy UTxO ${values.utxo} at the validator address (spent, or a typo).`);
  process.exit(1);
}

const policy = policyViewOf(utxo);
const now = Date.now();
const check = checkAgainst(policy, response);
console.log(`policy: pays ${policy.payout} lovelace if the sum is ${policy.cmp === "Below" ? "below" : "at least"} ${policy.threshold / 10 ** policy.scale}; max response age ${policy.maxAgeMs / 1000} s; release before ${new Date(policy.deadlineMs).toISOString()}`);
console.log(`response: signed by ${response.airnode} for request ${response.requestHash.slice(0, 12)}..., ${Math.round((now - check.signedMs) / 1000)} s old`);

// The interval starts after the response was signed and ends where the policy's age rule allows (see evaluationWindow).
if (!values.submit) {
  const result = await evaluateRelease(client, utxo, policy, response, now);
  if (result.verdict === "ACCEPTED") console.log("ACCEPTED: the validator ran to completion on this response. Nothing was sent (add --submit to release the funds).");
  else console.log(`${result.verdict}: ${result.detail}`);
  if (result.verdict !== "ACCEPTED" && process.env.JUDGE_DEBUG) console.log(JSON.stringify(result));
} else {
  try {
    const built = await releaseTx(client, utxo, policy, response, evaluationWindow(policy, check.signedMs, now));
    const submitted = await submitTracked(built, { source: "judge.ts" });
    console.log(`ACCEPTED and released: https://preprod.cardanoscan.io/transaction/${hexOf(submitted.hash)}`);
  } catch (error) {
    console.log(`NOT RELEASED: ${String((error as Error)?.message ?? error).replace(/\s+/g, " ").slice(0, 200)}`);
  }
}

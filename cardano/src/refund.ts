import { withMetadata } from "./tx-metadata.js";
import { submitTracked } from "./tx-tracking.js";
/**
 * Refund a Pay-on-Proof policy to its refund party after the deadline.
 *
 *   tsx src/refund.ts --utxo <txHash>#<index>                 evaluate only: would the validator accept the refund now?
 *   tsx src/refund.ts --utxo <txHash>#<index> --early          evaluate a refund that starts BEFORE the deadline; the validator must refuse it
 *   tsx src/refund.ts --utxo <txHash>#<index> --submit [--wait]   submit the refund (--wait sleeps until the deadline has passed)
 *
 * The refund party signs (this wallet, MNEMONIC, must be the key named in the policy) and the whole locked amount comes back
 * as change. The validity interval starts one second after the deadline: slots are whole seconds and round down, and the
 * validator needs `lower >= deadline`. The node validates against its own latest slot, so the script waits for the chain tip.
 */
import { parseArgs } from "node:util";
import { Address, KeyHash } from "@evolution-sdk/evolution";
import { hexOf, makeClient, paymentKeyHashHex, refundData, script, scriptHash, sleep, waitForTip, waitForTx } from "./engine.js";
import { classify, findPolicyUtxo, policyViewOf } from "./proof.js";

const { values } = parseArgs({ options: { utxo: { type: "string" }, submit: { type: "boolean", default: false }, wait: { type: "boolean", default: false }, early: { type: "boolean", default: false } } });
if (!values.utxo) {
  console.log("usage: tsx src/refund.ts --utxo <txHash>#<index> [--early] [--submit [--wait]]");
  process.exit(1);
}
if (values.early && values.submit) throw new Error("--early is an evaluation-only test and cannot be combined with --submit");

const client = makeClient("MNEMONIC");
const wallet = paymentKeyHashHex(Address.toBech32(await client.address()));
const utxo = await findPolicyUtxo(client, values.utxo);
if (!utxo) throw new Error(`No policy ${values.utxo} at the validator (already spent, or not visible yet)`);
const policy = policyViewOf(utxo);
if (policy.refundToHex !== wallet) throw new Error("This wallet is not the policy's refund party; the validator would refuse the refund");

const untilDeadline = policy.deadlineMs - Date.now();
console.log(`policy refunds ${Number(utxo.assets.lovelace) / 1_000_000} tADA to its refund party after ${new Date(policy.deadlineMs).toISOString()} (${untilDeadline > 0 ? `in ${Math.round(untilDeadline / 1000)} s` : "passed"})`);
if (values.submit && untilDeadline > 0) {
  if (!values.wait) throw new Error("The deadline has not passed. Add --wait to sleep until it has, or wait and run again.");
  await sleep(untilDeadline + 2_000);
}

const now = Date.now();
const fromMs = values.early ? now - 60_000 : Math.max(now - 60_000, policy.deadlineMs + 1_000);
if (!values.early) await waitForTip(fromMs + 2_000);

try {
  const built = await withMetadata(client.newTx(), "Refund", scriptHash)
    .collectFrom({ inputs: [utxo], redeemer: refundData() })
    .attachScript({ script })
    .addSigner({ keyHash: KeyHash.fromHex(policy.refundToHex) })
    .setValidity({ from: BigInt(fromMs), to: BigInt(fromMs + 15 * 60_000) })
    .build();
  if (!values.submit) {
    console.log(`ACCEPTED: the validator would allow this refund (validity starts ${new Date(fromMs).toISOString()}). Nothing was sent.`);
  } else {
    const submitted = await submitTracked(built, { source: "refund.ts" });
    const hash = hexOf(submitted.hash);
    console.log(`refund submitted: ${hash}`);
    console.log((await waitForTx(hash)) ? "confirmed in a block" : "not confirmed yet (check the explorer)");
    console.log(`https://preprod.cardanoscan.io/transaction/${hash}`);
  }
} catch (error) {
  const verdict = classify(error);
  const detail = verdict.verdict === "REJECTED" ? "the validator refused this refund (script evaluation failed)." : "detail" in verdict ? verdict.detail : "";
  console.log(`${verdict.verdict}: ${detail}${values.early && verdict.verdict === "REJECTED" ? " That is the expected result for a refund before the deadline." : ""}`);
}

/**
 * Who can do what with a locked policy? Release attacks, tried against the validator through the node provider's script
 * evaluation. NOTHING IS SENT: every case is built and evaluated, never signed or submitted.
 *
 *   tsx src/attacks.ts                              redirect, underpay and permissionless cases on the standing bench policy, stored response
 *   tsx src/attacks.ts --expired <txHash>#<index>   adds refund attacks on a policy whose deadline has passed and whose refund party is the MNEMONIC wallet
 *   --standing <file>                               which standing bench list to attack (default standing-policies.json, the current validator;
 *                                                   standing-policies-v1.json with VALIDATOR_BLUEPRINT=../aiken/blueprint/plutus-v1-a9e4420c.json attacks the first version)
 *   tsx src/attacks.ts --fresh <response.json>      adds the double-satisfaction case, which needs a response fresh enough for both
 *                                                   bench policies (one is limited to 5 minutes): buy one with checks/10-paid-call.ts meteo-rain
 *
 * Each attack differs from its control in one thing only, and the control runs first and last.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Address, KeyHash } from "@evolution-sdk/evolution";
import { type SignedResponse, loadVector, lovelace, makeClient, paymentKeyHashHex, refundData, releaseDataFromResponse, script, sellerAddressBech32 } from "./engine.js";
import { type Utxo, classify, evaluationWindow, findPolicyUtxo, policyViewOf } from "./proof.js";

const { values } = parseArgs({ options: { fresh: { type: "string" }, expired: { type: "string" }, standing: { type: "string", default: "standing-policies.json" } } });
const standing = JSON.parse(readFileSync(new URL(`../${values.standing}`, import.meta.url), "utf8")) as { name: string; ref: string }[];
const refOf = (name: string) => standing.find((s) => s.name === name)?.ref ?? (() => { throw new Error(`${name} is not in ${values.standing}`); })();
const buyer = makeClient("MNEMONIC");
const seller = makeClient("SELLER_MNEMONIC");
const sellerPkh = paymentKeyHashHex(sellerAddressBech32());
const toKey = (pkh: string) => Address.fromHex(`60${pkh}`); // enterprise address: the contract only looks at the key hash
const attackerPkh = "ab".repeat(28);

type Output = { pkh: string; ada: number };
type Verdict = "ACCEPTED" | "REJECTED" | "ERROR";

const evaluate = async (client: typeof buyer, inputs: Utxo[], response: SignedResponse, outputs: Output[], window: { from: number; to: number }): Promise<Verdict> => {
  try {
    let tx = client.newTx().collectFrom({ inputs, redeemer: releaseDataFromResponse(response) }).attachScript({ script });
    for (const o of outputs) tx = tx.payToAddress({ address: toKey(o.pkh), assets: lovelace(BigInt(Math.round(o.ada * 1_000_000))) });
    await tx.setValidity({ from: BigInt(window.from), to: BigInt(window.to) }).build();
    return "ACCEPTED";
  } catch (error) {
    return classify(error).verdict === "REJECTED" ? "REJECTED" : "ERROR";
  }
};

const rows: { name: string; expect: Verdict; got: Verdict }[] = [];
const run = async (name: string, expect: Verdict, go: () => Promise<Verdict>) => {
  const got = await go();
  rows.push({ name, expect, got });
  console.log(`${got === expect ? "as expected " : "UNEXPECTED   "} ${got.padEnd(8)} ${name}`);
};

const stored = JSON.parse(readFileSync(new URL("../vectors/tamper/valid.json", import.meta.url), "utf8")) as SignedResponse;
const stored48 = await findPolicyUtxo(buyer, refOf("bench-48h"));
if (!stored48) throw new Error("bench-48h is spent or not visible");
const policy48 = policyViewOf(stored48);
const signedStored = loadVector("meteo").timestamp * 1000;
const now = Date.now();
const window48 = evaluationWindow(policy48, signedStored, now);

console.log("== release attacks on bench-48h with the stored real response (nothing is sent) ==");
await run("control: pay the beneficiary 5 tADA", "ACCEPTED", () => evaluate(buyer, [stored48], stored, [{ pkh: sellerPkh, ada: 5 }], window48));
await run("redirect: release but pay nobody (the 5 tADA goes to the submitter's change)", "REJECTED", () => evaluate(buyer, [stored48], stored, [], window48));
await run("redirect: pay the 5 tADA to an attacker's key instead", "REJECTED", () => evaluate(buyer, [stored48], stored, [{ pkh: attackerPkh, ada: 5 }], window48));
await run("underpay: pay the beneficiary 4.9 tADA", "REJECTED", () => evaluate(buyer, [stored48], stored, [{ pkh: sellerPkh, ada: 4.9 }], window48));
await run("underpay: pay the beneficiary 5 tADA minus one lovelace", "REJECTED", () => evaluate(seller, [stored48], stored, [{ pkh: sellerPkh, ada: 4.999999 }], window48));
await run("anyone may submit: the buyer's wallet releases correctly", "ACCEPTED", () => evaluate(buyer, [stored48], stored, [{ pkh: sellerPkh, ada: 5 }], window48));
await run("anyone may submit: a third wallet (the seller's own) releases correctly", "ACCEPTED", () => evaluate(seller, [stored48], stored, [{ pkh: sellerPkh, ada: 5 }], window48));
await run("pay more than required (6 tADA)", "ACCEPTED", () => evaluate(buyer, [stored48], stored, [{ pkh: sellerPkh, ada: 6 }], window48));

if (values.fresh) {
  const fresh = JSON.parse(readFileSync(values.fresh, "utf8")) as SignedResponse;
  const stored5 = await findPolicyUtxo(buyer, refOf("bench-5min"));
  if (!stored5) throw new Error("bench-5min is spent or not visible");
  const policy5 = policyViewOf(stored5);
  const signedFresh = Number(fresh.timestamp) * 1000;
  const window = evaluationWindow(policy5, signedFresh, Date.now());
  console.log(`\n== two policies with the same beneficiary in ONE transaction, one fresh response (${Math.round((Date.now() - signedFresh) / 1000)} s old) ==`);
  await run("control: each policy alone, paid 5 tADA (bench-5min)", "ACCEPTED", () => evaluate(buyer, [stored5], fresh, [{ pkh: sellerPkh, ada: 5 }], window));
  await run("batch: both policies, the beneficiary paid 10 tADA (an honest batch; the current validator allows one policy per release, the first version allowed this)", "REJECTED", () => evaluate(buyer, [stored48, stored5], fresh, [{ pkh: sellerPkh, ada: 10 }], window));
  await run("double satisfaction: both policies, the beneficiary paid 5 tADA once (the other 5 stays with the submitter)", "REJECTED", () => evaluate(buyer, [stored48, stored5], fresh, [{ pkh: sellerPkh, ada: 5 }], window));
  await run("control again: each policy alone, paid 5 tADA (bench-5min)", "ACCEPTED", () => evaluate(buyer, [stored5], fresh, [{ pkh: sellerPkh, ada: 5 }], window));
} else {
  console.log("\n(pass --fresh <response.json> to add the two-policies-in-one-transaction case)");
}

await run("control again: pay the beneficiary 5 tADA (bench-48h)", "ACCEPTED", () => evaluate(buyer, [stored48], stored, [{ pkh: sellerPkh, ada: 5 }], window48));

if (values.expired) {
  const expired = await findPolicyUtxo(buyer, values.expired);
  if (!expired) throw new Error(`${values.expired} is spent or not visible`);
  const policy = policyViewOf(expired);
  if (policy.deadlineMs > Date.now() - 120_000) throw new Error("This policy's deadline has not passed yet");
  const from = Date.now() - 60_000;
  const refundWindow = { from: BigInt(from), to: BigInt(from + 15 * 60_000) };
  const refund = async (client: typeof buyer, signer?: string): Promise<Verdict> => {
    try {
      let tx = client.newTx().collectFrom({ inputs: [expired], redeemer: refundData() }).attachScript({ script });
      if (signer) tx = tx.addSigner({ keyHash: KeyHash.fromHex(signer) });
      await tx.setValidity({ from: refundWindow.from, to: refundWindow.to }).build();
      return "ACCEPTED";
    } catch (error) {
      return classify(error).verdict === "REJECTED" ? "REJECTED" : "ERROR";
    }
  };
  console.log(`
== refund attacks on ${values.expired.slice(0, 12)}…, deadline ${new Date(policy.deadlineMs).toISOString()} (passed); the refund party is the MNEMONIC wallet ==`);
  console.log("(the evaluation reads the transaction's list of required signers; it does not check that they signed. The ledger does that when a transaction is submitted, so a wrong signer listed here would still fail there.)");
  await run("control: the refund party is listed as signer", "ACCEPTED", () => refund(buyer, policy.refundToHex));
  await run("attack: nobody is listed as signer", "REJECTED", () => refund(seller));
  await run("attack: the attacker's key is the signer", "REJECTED", () => refund(seller, attackerPkh));
  await run("attack: the beneficiary (the seller) is the signer", "REJECTED", () => refund(seller, sellerPkh));
  await run("control again: the refund party is listed as signer", "ACCEPTED", () => refund(buyer, policy.refundToHex));
}

const unexpected = rows.filter((r) => r.got !== r.expect);
console.log(`\n${rows.length} cases, ${unexpected.length === 0 ? "all as expected" : `${unexpected.length} UNEXPECTED (see above)`}. Nothing was signed or submitted.`);
process.exitCode = unexpected.length === 0 ? 0 : 1;

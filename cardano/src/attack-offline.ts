/**
 * What if the seller lies in the price list? The facilitator checks only that payTo is the declared script, never the datum,
 * so the buyer's client is the last line of defence. This builds the honest price list for an offer, then one dishonest variant
 * per field, and shows that checkRequirement() refuses every one. Nothing touches a network or a wallet.
 *
 *   tsx src/attack-offline.ts
 */
import { Address } from "@evolution-sdk/evolution";
import { cborHexOf, loadVector, paymentKeyHashHex, policyData, scriptHash } from "./engine.js";
import { type EscrowOffer, type RequirementLike, ESCROW_LOVELACE, checkRequirement, offerExtra, offerPolicy, validatorAddressBech32 } from "./escrow.js";

const buyer = "addr_test1qqf6wl8rev5q2zwslk95eqz0tgymshadz26gs70ygr593jwkmysa3xpenqsmsw29qwe6zpqkdqt7mu5wlx8ln8crz9csuqjxxp";
const attackerPkh = "ab".repeat(28);
const attacker = Address.toBech32(Address.fromHex(`60${attackerPkh}`));
const offer: EscrowOffer = { refund: buyer, atLeast: 2000, deadlineMs: Date.now() + 40 * 60_000 };
const base = offerPolicy(offer);
const meteo = loadVector("meteo");

const honest: RequirementLike = { scheme: "exact", network: "cardano:preprod", amount: ESCROW_LOVELACE.toString(), asset: "lovelace", payTo: validatorAddressBech32, extra: offerExtra(offer) };
const withPolicy = (change: Partial<typeof base>): RequirementLike => ({ ...honest, extra: { ...honest.extra, datum: cborHexOf(policyData({ ...base, ...change })) } });
const withExtra = (extra: Record<string, unknown>): RequirementLike => ({ ...honest, extra: { ...honest.extra, ...extra } });

const cases: { name: string; requirement: RequirementLike }[] = [
  { name: "refund party swapped for the attacker", requirement: withPolicy({ refundToHex: attackerPkh }) },
  { name: "beneficiary swapped for the attacker", requirement: withPolicy({ beneficiaryHex: attackerPkh }) },
  { name: "rule made trivial (threshold 1)", requirement: withPolicy({ threshold: 1_000_000 }) },
  { name: "rule made impossible (threshold 99,999)", requirement: withPolicy({ threshold: 99_999_000_000 }) },
  { name: "deadline pushed out by a day", requirement: withPolicy({ deadlineMs: base.deadlineMs + 86_400_000 }) },
  { name: "deadline moved to 1 minute from now", requirement: withPolicy({ deadlineMs: Date.now() + 60_000 }) },
  { name: "payout lowered to 1 tADA", requirement: withPolicy({ payout: 1_000_000n }) },
  { name: "response age limit stretched to 10 years", requirement: withPolicy({ maxAgeMs: 315_360_000_000 }) },
  { name: "request pinned to a different question", requirement: withPolicy({ requestHashHex: meteo.requestHashHex }) },
  { name: "signer pinned to a different key", requirement: withPolicy({ signerHex: meteo.pubkeyHex }) },
  { name: "payTo is the attacker's address", requirement: { ...honest, payTo: attacker } },
  { name: "payTo is the attacker's address and the method is a plain payment", requirement: { ...honest, payTo: attacker, extra: { assetTransferMethod: "default" } } },
  { name: "script hash is another script", requirement: withExtra({ scriptHash: "00".repeat(28) }) },
  { name: "amount raised to 50 tADA", requirement: { ...honest, amount: "50000000" } },
  { name: "asset is not lovelace", requirement: { ...honest, asset: "c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad.0014df105553444d" } },
  { name: "network is mainnet", requirement: { ...honest, network: "cardano:mainnet" } },
  { name: "no datum at all (funds would be stranded)", requirement: withExtra({ datum: undefined }) },
];

let failed = 0;
const control = checkRequirement(honest, offer);
console.log(`control (the honest price list, script ${scriptHash.slice(0, 8)}…): ${control.length === 0 ? "ACCEPTED, no problems" : `UNEXPECTED: ${control.join("; ")}`}`);
if (control.length !== 0) failed += 1;
for (const c of cases) {
  const refused = checkRequirement(c.requirement, offer).length > 0;
  if (!refused) failed += 1;
  console.log(`${refused ? "REFUSED     " : "NOT REFUSED!"}  ${c.name}`);
}
console.log(`\n${cases.length} dishonest price lists: ${failed === 0 ? "all refused, and the control passed" : `${failed} problem(s)`}.`);
console.log(`(the attacker address used is ${attacker.slice(0, 18)}… with key ${paymentKeyHashHex(attacker).slice(0, 8)}…)`);
process.exitCode = failed === 0 ? 0 : 1;

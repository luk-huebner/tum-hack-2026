/**
 * What if the seller lies in the price list? The facilitator checks only that payTo is the declared script, never the datum,
 * so the buyer's client is the last line of defence. For each template this builds the honest price list for an offer, then one
 * dishonest variant per field, and shows that checkRequirement() refuses every one. Nothing touches a network or a wallet.
 *
 *   tsx src/attack-offline.ts
 */
import { Address } from "@evolution-sdk/evolution";
import { cborHexOf, loadVector, paymentKeyHashHex, policyData } from "./engine.js";
import { type EscrowOffer, type RequirementLike, ESCROW_LOVELACE, checkRequirement, offerExtra, offerPolicy, validatorAddressBech32 } from "./escrow.js";

const buyer = "addr_test1qqf6wl8rev5q2zwslk95eqz0tgymshadz26gs70ygr593jwkmysa3xpenqsmsw29qwe6zpqkdqt7mu5wlx8ln8crz9csuqjxxp";
const attackerPkh = "ab".repeat(28);
const attacker = Address.toBech32(Address.fromHex(`60${attackerPkh}`));
const deadlineMs = Date.now() + 40 * 60_000;

const offers: { label: string; offer: EscrowOffer; otherVector: string }[] = [
  { label: "eth-usd", offer: { template: "eth-usd", refund: buyer, deadlineMs, value: 2000 }, otherVector: "meteo" },
  { label: "tweet-likes (tweet 20)", offer: { template: "tweet-likes", refund: buyer, deadlineMs, value: 300_000, tweetId: "20" }, otherVector: "meteo" },
  { label: "rain-below (Munich)", offer: { template: "rain-below", refund: buyer, deadlineMs, value: 30 }, otherVector: "nodary-eth-usd" },
];

let failed = 0;
let total = 0;
for (const { label, offer, otherVector } of offers) {
  const base = offerPolicy(offer);
  const other = loadVector(otherVector);
  const honest: RequirementLike = { scheme: "exact", network: "cardano:preprod", amount: ESCROW_LOVELACE.toString(), asset: "lovelace", payTo: validatorAddressBech32, extra: offerExtra(offer) };
  const withPolicy = (change: Partial<typeof base>): RequirementLike => ({ ...honest, extra: { ...honest.extra, datum: cborHexOf(policyData({ ...base, ...change })) } });
  const withExtra = (extra: Record<string, unknown>): RequirementLike => ({ ...honest, extra: { ...honest.extra, ...extra } });

  const cases: { name: string; requirement: RequirementLike }[] = [
    { name: "refund party swapped for the attacker", requirement: withPolicy({ refundToHex: attackerPkh }) },
    { name: "beneficiary swapped for the attacker", requirement: withPolicy({ beneficiaryHex: attackerPkh }) },
    { name: "rule made trivial (threshold 1 unit)", requirement: withPolicy({ threshold: 1 }) },
    { name: "rule made impossible (threshold far too large)", requirement: withPolicy({ threshold: 99_999_000_000_000 }) },
    { name: "deadline pushed out by a day", requirement: withPolicy({ deadlineMs: base.deadlineMs + 86_400_000 }) },
    { name: "deadline moved to 1 minute from now", requirement: withPolicy({ deadlineMs: Date.now() + 60_000 }) },
    { name: "payout lowered to 1 tADA", requirement: withPolicy({ payout: 1_000_000n }) },
    { name: "response age limit stretched to 10 years", requirement: withPolicy({ maxAgeMs: 315_360_000_000 }) },
    { name: "request pinned to a different question", requirement: withPolicy({ requestHashHex: other.requestHashHex }) },
    { name: "signer pinned to a different key", requirement: withPolicy({ signerHex: other.pubkeyHex }) },
    { name: "observation check switched off or loosened", requirement: withPolicy({ obsSlot: base.obsSlot === -1 ? 1 : -1, obsMaxAgeMs: 10 ** 12 }) },
    { name: "payTo is the attacker's address", requirement: { ...honest, payTo: attacker } },
    { name: "payTo is the attacker's address and the method is a plain payment", requirement: { ...honest, payTo: attacker, extra: { assetTransferMethod: "default" } } },
    { name: "script hash is another script", requirement: withExtra({ scriptHash: "00".repeat(28) }) },
    { name: "amount raised to 50 tADA", requirement: { ...honest, amount: "50000000" } },
    { name: "asset is not lovelace", requirement: { ...honest, asset: "c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad.0014df105553444d" } },
    { name: "network is mainnet", requirement: { ...honest, network: "cardano:mainnet" } },
    { name: "no datum at all (funds would be stranded)", requirement: withExtra({ datum: undefined }) },
  ];

  const control = checkRequirement(honest, offer);
  total += cases.length;
  if (control.length !== 0) failed += 1;
  const refusedCount = cases.filter((c) => checkRequirement(c.requirement, offer).length > 0).length;
  failed += cases.length - refusedCount;
  console.log(`${label}: control ${control.length === 0 ? "accepted" : `UNEXPECTEDLY REFUSED (${control.join("; ")})`}; ${refusedCount} of ${cases.length} dishonest price lists refused`);
  for (const c of cases) if (checkRequirement(c.requirement, offer).length === 0) console.log(`   NOT REFUSED!  ${c.name}`);
}
console.log(`\n${total} dishonest price lists over ${offers.length} templates (attacker key ${paymentKeyHashHex(attacker).slice(0, 8)}…): ${failed === 0 ? "all refused, every control accepted" : `${failed} problem(s)`}.`);
process.exitCode = failed === 0 ? 0 : 1;

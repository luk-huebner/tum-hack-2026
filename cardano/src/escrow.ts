/**
 * Escrow offers: an x402 payment that is locked straight into the Pay-on-Proof validator.
 *
 * The Cardano x402 scheme has an `assetTransferMethod` called `script`: instead of paying an address, the buyer's payment
 * output goes to a script address the seller declares, with an inline datum the seller supplies (`extra.datum`, CBOR hex).
 * Here the script is our validator and the datum is a policy: the seller is the beneficiary, the buyer is the refund party,
 * and the money reaches the seller only when a signed AirnodeHub response satisfies the rule (or goes back to the buyer after
 * the deadline).
 *
 * The facilitator checks that `payTo` is the script address derived from `scriptHash`. It does NOT check the datum, so the
 * datum built here is the only thing standing between a buyer and stranded funds. Keep it deterministic: the 402 and the
 * paid retry must carry the same datum, so nothing in it may depend on the clock, only on the buyer's request.
 */
import { Address } from "@evolution-sdk/evolution";
import { type Policy, cborHexOf, loadVector, paymentKeyHashHex, policyData, scriptAddress, scriptHash, sellerAddressBech32 } from "./engine.js";

export const ESCROW_LOVELACE = 5_000_000n; // the price of the route, and the amount the policy pays out
export const ESCROW_MAX_AGE_MS = 300_000; // a release must use a response signed in the last 5 minutes
const MIN_LEAD_MS = 5 * 60_000; // the deadline must be at least this far away when the offer is made
const MAX_LEAD_MS = 72 * 3_600_000;

/** What a buyer asks for: pay the seller if ETH/USD is at least `atLeast` before `deadlineMs`; refund `refund` otherwise. */
export interface EscrowOffer {
  refund: string;
  atLeast: number;
  deadlineMs: number;
}

export const parseOffer = (body: unknown, nowMs: number): EscrowOffer => {
  const b = (body ?? {}) as Record<string, unknown>;
  const refund = typeof b.refund === "string" ? b.refund.trim() : "";
  const atLeast = Number(b.atLeast);
  const deadlineMs = Number(b.deadlineMs);
  let credential: string | undefined;
  try {
    credential = Address.fromBech32(refund).paymentCredential?._tag;
  } catch {
    // reported below
  }
  if (!refund.startsWith("addr_test1") || credential !== "KeyHash") throw new Error("refund must be a preprod address (addr_test1...) controlled by a key, not a script");
  if (!Number.isFinite(atLeast) || atLeast <= 0 || atLeast >= 1_000_000) throw new Error("atLeast must be a positive ETH/USD price below 1,000,000");
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < nowMs + MIN_LEAD_MS || deadlineMs > nowMs + MAX_LEAD_MS) {
    throw new Error("deadlineMs must be a unix time in milliseconds between 5 minutes and 72 hours from now");
  }
  return { refund, atLeast, deadlineMs };
};

/** The policy datum for an offer. The seller (SELLER_ADDRESS) is paid; the buyer's address is the refund party. */
export const offerPolicy = (offer: EscrowOffer): Policy => {
  const vec = loadVector("nodary-eth-usd");
  return {
    signerHex: vec.pubkeyHex,
    requestHashHex: vec.requestHashHex,
    prefixHex: vec.prefixHex,
    separatorsHex: vec.separatorsHex,
    suffixHex: vec.suffixHex,
    scale: 6,
    slotFrom: 0,
    slotTo: 1,
    cmp: "AtLeast",
    threshold: Math.round(offer.atLeast * 1e6),
    settleAfterMs: vec.timestamp * 1000 - 3_600_000,
    deadlineMs: offer.deadlineMs,
    maxAgeMs: ESCROW_MAX_AGE_MS,
    beneficiaryHex: paymentKeyHashHex(sellerAddressBech32()),
    refundToHex: paymentKeyHashHex(offer.refund),
    payout: ESCROW_LOVELACE,
  };
};

/** The `extra` block of the payment requirements: declares the script and attaches the policy as inline datum. */
export const offerExtra = (offer: EscrowOffer) => ({
  assetTransferMethod: "script" as const,
  scriptHash,
  datum: cborHexOf(policyData(offerPolicy(offer))),
});

/** The validator's bech32 address, which is what the buyer pays to. */
export const validatorAddressBech32 = Address.toBech32(scriptAddress);

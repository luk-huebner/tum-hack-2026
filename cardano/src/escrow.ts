/**
 * Escrow offers: an x402 payment that is locked straight into the Pay-on-Proof validator.
 *
 * The Cardano x402 scheme has an `assetTransferMethod` called `script`: instead of paying an address, the buyer's payment
 * output goes to a script address the seller declares, with an inline datum the seller supplies (`extra.datum`, CBOR hex).
 * Here the script is our validator and the datum is a policy: the seller is the beneficiary, the buyer is the refund party,
 * and the money reaches the seller only when a signed AirnodeHub response satisfies the rule (or goes back to the buyer after
 * the deadline). What the rule is about (a price, a tweet's likes, rainfall) is a template, see templates.ts.
 *
 * The facilitator checks that `payTo` is the script address derived from `scriptHash`. It does NOT check the datum, so the
 * datum built here is the only thing standing between a buyer and stranded funds. Keep it deterministic: the 402 and the
 * paid retry must carry the same datum, so nothing in it may depend on the clock, only on the buyer's request.
 */
import { Address } from "@evolution-sdk/evolution";
import { type Policy, cborHexOf, loadVector, paymentKeyHashHex, policyData, scriptAddress, scriptHash, sellerAddressBech32 } from "./engine.js";
import { TEMPLATE_IDS, type TemplateId, specFor } from "./templates.js";

export const ESCROW_LOVELACE = 5_000_000n; // the price of the route, and the amount the policy pays out
export const ESCROW_MAX_AGE_MS = 300_000; // a release must use a response signed in the last 5 minutes
const MIN_LEAD_MS = 5 * 60_000; // the deadline must be at least this far away when the offer is made
const MAX_LEAD_MS = 72 * 3_600_000;
const MIN_WINDOW_MS = 10 * 60_000; // a measurement window (measureAfter to deadline) shorter than this cannot be used

/**
 * What a buyer asks for: pay the seller when the template's rule holds (`value` is its threshold in the template's own unit:
 * a price, a number of likes, millimetres of rain) before `deadlineMs`; refund `refund` otherwise.
 */
export interface EscrowOffer {
  template: TemplateId;
  refund: string;
  deadlineMs: number;
  value: number;
  tweetId?: string; // template tweet-likes
  sourceId?: string; // template source
  /** Count only a measurement signed after this time (POSIX ms): "the likes at the end of the campaign", not a boost in the middle of it. */
  measureAfterMs?: number;
  /** Who is paid when the rule holds (a key-controlled preprod address). Default: the seller (SELLER_ADDRESS). In Creator Pay it is the creator. */
  payee?: string;
}

/** The tweet id or source id that the template needs to find its spec. */
const instanceOf = (offer: { tweetId?: string; sourceId?: string }) => offer.tweetId ?? offer.sourceId;

export const parseOffer = (body: unknown, nowMs: number): EscrowOffer => {
  const b = (body ?? {}) as Record<string, unknown>;
  const template = (b.template === undefined ? "eth-usd" : b.template) as TemplateId;
  if (!TEMPLATE_IDS.includes(template)) throw new Error(`template must be one of: ${TEMPLATE_IDS.join(", ")}`);
  const refund = typeof b.refund === "string" ? b.refund.trim() : "";
  const deadlineMs = Number(b.deadlineMs);
  const tweetId = template === "tweet-likes" ? String(b.tweetId ?? "") : undefined;
  const sourceId = template === "source" ? String(b.sourceId ?? "") : undefined;
  let credential: string | undefined;
  try {
    credential = Address.fromBech32(refund).paymentCredential?._tag;
  } catch {
    // reported below
  }
  if (!refund.startsWith("addr_test1") || credential !== "KeyHash") throw new Error("refund must be a preprod address (addr_test1...) controlled by a key, not a script");
  const spec = specFor(template, tweetId ?? sourceId);
  // the threshold is called atLeast for a rule "at least" (prices, likes, views) and below for a rule "below" (rain)
  const key = spec.cmp === "Below" ? "below" : "atLeast";
  const value = Number(b[key]);
  if (!Number.isFinite(value) || value <= 0 || value > spec.max) throw new Error(`${key} must be a positive number up to ${spec.max}`);
  if (template !== "eth-usd" && Math.abs(value * 10 ** spec.scale - Math.round(value * 10 ** spec.scale)) > 1e-9) {
    throw new Error(`the threshold may have at most ${spec.scale} decimals`);
  }
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < nowMs + MIN_LEAD_MS || deadlineMs > nowMs + MAX_LEAD_MS) {
    throw new Error("deadlineMs must be a unix time in milliseconds between 5 minutes and 72 hours from now");
  }
  let payee: string | undefined;
  if (b.payee !== undefined) {
    payee = String(b.payee).trim();
    let payeeCredential: string | undefined;
    try {
      payeeCredential = Address.fromBech32(payee).paymentCredential?._tag;
    } catch {
      // reported below
    }
    if (!payee.startsWith("addr_test1") || payeeCredential !== "KeyHash") throw new Error("payee must be a preprod address (addr_test1...) controlled by a key, not a script");
  }
  let measureAfterMs: number | undefined;
  if (b.measureAfterMs !== undefined) {
    measureAfterMs = Number(b.measureAfterMs);
    // the keeper stops 3 minutes before the deadline and a release waits for the chain, so the window must be wide enough to use
    if (!Number.isSafeInteger(measureAfterMs) || measureAfterMs < nowMs - 60_000 || measureAfterMs > deadlineMs - MIN_WINDOW_MS) {
      throw new Error("measureAfterMs must be a unix time in milliseconds, not in the past and at least 10 minutes before the deadline");
    }
  }
  return {
    template,
    refund,
    deadlineMs,
    value,
    ...(tweetId === undefined ? {} : { tweetId }),
    ...(sourceId === undefined ? {} : { sourceId }),
    ...(measureAfterMs === undefined ? {} : { measureAfterMs }),
    ...(payee === undefined ? {} : { payee }),
  };
};

/** A sentence for the offer's rule. */
export const describeOffer = (offer: EscrowOffer): string =>
  specFor(offer.template, instanceOf(offer)).describe(offer.value) +
  (offer.measureAfterMs === undefined ? "" : `, counting only data signed after ${new Date(offer.measureAfterMs).toISOString()}`) +
  (offer.payee === undefined ? "" : `, paid to ${offer.payee.slice(0, 18)}...`);

/** The policy datum for an offer. The seller (SELLER_ADDRESS) is paid; the buyer's address is the refund party. */
export const offerPolicy = (offer: EscrowOffer): Policy => {
  const spec = specFor(offer.template, instanceOf(offer));
  const vec = loadVector(spec.vectorName);
  return {
    signerHex: vec.pubkeyHex,
    requestHashHex: vec.requestHashHex,
    prefixHex: vec.prefixHex,
    separatorsHex: vec.separatorsHex,
    suffixHex: vec.suffixHex,
    scale: spec.scale,
    slotFrom: spec.slotFrom,
    slotTo: spec.slotTo,
    cmp: spec.cmp,
    threshold: spec.toThreshold(offer.value),
    settleAfterMs: offer.measureAfterMs ?? vec.timestamp * 1000 - 3_600_000,
    deadlineMs: offer.deadlineMs,
    maxAgeMs: ESCROW_MAX_AGE_MS,
    beneficiaryHex: paymentKeyHashHex(offer.payee ?? sellerAddressBech32()),
    refundToHex: paymentKeyHashHex(offer.refund),
    payout: ESCROW_LOVELACE,
    obsSlot: spec.obs?.slot ?? -1,
    obsMaxAgeMs: spec.obs?.maxAgeMs ?? 0,
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

export interface RequirementLike {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  extra?: Record<string, unknown>;
}

/**
 * What a buyer's client must check before it signs a payment: everything in the price list that it can recompute from its own
 * request. The facilitator does not look at the datum, so a seller that lies in it (another beneficiary or refund party, an easier
 * rule, a longer deadline, a different signer or request, a larger payout) would not be caught by anyone else. An empty list means
 * the price list is exactly the escrow this client asked for.
 */
export const checkRequirement = (r: RequirementLike, offer: EscrowOffer): string[] => {
  const problems: string[] = [];
  const expected = offerExtra(offer);
  const extra = r.extra ?? {};
  if (r.scheme !== "exact") problems.push("scheme is not exact");
  if (r.network !== "cardano:preprod") problems.push("network is not Cardano preprod");
  if (r.asset !== "lovelace") problems.push("asset is not lovelace");
  if (r.amount !== ESCROW_LOVELACE.toString()) problems.push(`amount is ${r.amount}, expected ${ESCROW_LOVELACE}`);
  if (r.payTo !== validatorAddressBech32) problems.push("payTo is not the validator address");
  if (extra.assetTransferMethod !== expected.assetTransferMethod) problems.push("the transfer method is not script");
  if (extra.scriptHash !== expected.scriptHash) problems.push("the script hash is not our validator");
  if (extra.datum !== expected.datum) problems.push("the datum is not the policy this wallet asked for (refund party, beneficiary, rule, deadline, request, signer, payout or age limit differs)");
  return problems;
};

/**
 * Templates: what a buyer may ask an escrow to wait for. The contract is the same for every template; a template only fixes
 * which signed request and signer the policy pins, how the signed text is cut into slots, the unit of the threshold and the
 * source the seller's keeper fetches to prove the rule.
 *
 *   eth-usd      the Nodary ETH/USD price is at least X (free data, signs an observation time that the policy checks)
 *   tweet-likes  the likes of a REGISTERED tweet are at least N (TwitterAPI.io, 0.01 aUSD per fetch)
 *   rain-below   Munich rainfall from 10 to 23 Oct 2026 is below X mm (Open-Meteo, 0.1 aUSD per fetch)
 *
 * Only requests whose signed shape is known can be offered, because the contract rebuilds the signed text from fixed fragments.
 * Tweets are registered one by one (vectors/tweets.json maps a tweet id to a saved vector, see src/register-tweet.ts).
 */
import { existsSync, readFileSync } from "node:fs";
import type { Cmp } from "./engine.js";

export type TemplateId = "eth-usd" | "tweet-likes" | "rain-below";
export const TEMPLATE_IDS: TemplateId[] = ["eth-usd", "tweet-likes", "rain-below"];

export interface Spec {
  id: string; // template id, plus the tweet id for tweets
  template: TemplateId;
  vectorName: string;
  sourceSpec: string; // for parseSource(): what the keeper fetches
  costAusd: number;
  scale: number;
  slotFrom: number;
  slotTo: number;
  cmp: Cmp;
  obs?: { slot: number; maxAgeMs: number };
  /** Converts the buyer's number into the policy threshold (already multiplied by 10^scale). */
  toThreshold: (value: number) => number;
  /** A sentence for the rule, for logs and pages. */
  describe: (value: number) => string;
  /** Largest number a buyer may ask for. */
  max: number;
}

const tweetsFile = new URL("../vectors/tweets.json", import.meta.url);

/** The tweets that can be offered: tweet id to vector name. */
export const registeredTweets = (): Record<string, string> => (existsSync(tweetsFile) ? JSON.parse(readFileSync(tweetsFile, "utf8")) : {});

const ethUsd: Spec = {
  id: "eth-usd",
  template: "eth-usd",
  vectorName: "nodary-eth-usd",
  sourceSpec: "nodary:ETH/USD",
  costAusd: 0,
  scale: 6,
  slotFrom: 0,
  slotTo: 1,
  cmp: "AtLeast",
  // the Nodary feed signs the time it observed the price (slot 1, "updatedAt", POSIX ms): at most 2 minutes old when signed
  obs: { slot: 1, maxAgeMs: 120_000 },
  toThreshold: (v) => Math.round(v * 1e6),
  describe: (v) => `ETH/USD at least ${v}`,
  max: 999_999,
};

const rainBelow: Spec = {
  id: "rain-below",
  template: "rain-below",
  vectorName: "meteo",
  sourceSpec: "meteo:munich",
  costAusd: 0.1,
  scale: 2,
  slotFrom: 0,
  slotTo: 14,
  cmp: "Below",
  toThreshold: (v) => Math.round(v * 100),
  describe: (v) => `Munich rainfall, 10 to 23 Oct 2026, below ${v} mm`,
  max: 1000,
};

const tweetLikes = (tweetId: string, vectorName: string): Spec => ({
  id: `tweet-likes:${tweetId}`,
  template: "tweet-likes",
  vectorName,
  sourceSpec: `tweet:${tweetId}`,
  costAusd: 0.01,
  scale: 0,
  slotFrom: 0, // slot 0 is "likes"; replies, retweets and views are signed but not summed
  slotTo: 1,
  cmp: "AtLeast",
  toThreshold: (v) => Math.round(v),
  describe: (v) => `likes of tweet ${tweetId} at least ${v}`,
  max: 2_000_000_000,
});

/** The spec behind an offer. Throws when the template needs a tweet that is not registered. */
export const specFor = (template: TemplateId, tweetId?: string): Spec => {
  if (template === "eth-usd") return ethUsd;
  if (template === "rain-below") return rainBelow;
  const tweets = registeredTweets();
  if (!tweetId || !Object.prototype.hasOwnProperty.call(tweets, tweetId)) {
    throw new Error(`tweetId must be one of the registered tweets: ${Object.keys(tweets).join(", ") || "none yet"}`);
  }
  return tweetLikes(tweetId, tweets[tweetId]);
};

/** Every offer the service can make and the keeper can prove: the fixed templates and each registered tweet. */
export const allSpecs = (): Spec[] => [ethUsd, rainBelow, ...Object.entries(registeredTweets()).map(([id, vector]) => tweetLikes(id, vector))];

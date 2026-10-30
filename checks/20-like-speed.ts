// How fast does a signed like count follow a like? Buys one signed tweet response (0.01 aUSD) every few seconds, verifies
// it like a contract would, and logs when it was signed and what it said, so a person can like and unlike the tweet and
// the two timelines can be laid side by side.
//   node --env-file=.env checks/20-like-speed.ts <tweetId> [--max 30] [--gap 2]
// Spends at most max x 0.01 aUSD (default 0.30). The key stays in .env (PAYER_PRIVATE_KEY, Base Sepolia, aUSD only).
import { appendFileSync, mkdirSync } from 'node:fs';
import { isHex } from 'viem';
import { deriveRequestHash, fetchSignedResponse, verifySignedResponse, type AirnodeV2Request } from '../lib/airnode-v2.ts';
import { createPayingFetch } from '../lib/x402.ts';

const args = process.argv.slice(2);
const tweetId = args.find((a) => /^\d{1,20}$/.test(a));
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const max = flag('--max', 30);
const gapSeconds = flag('--gap', 2);
if (!tweetId) throw new Error('Usage: node --env-file=.env checks/20-like-speed.ts <tweetId> [--max 30] [--gap 2]');
if (!(max >= 1 && max <= 60)) throw new Error('--max must be between 1 and 60 (0.01 aUSD each)');
const key = process.env.PAYER_PRIVATE_KEY;
if (!key || !isHex(key)) throw new Error('PAYER_PRIVATE_KEY (a 0x testnet key) must be set in .env');

const request: AirnodeV2Request = {
  operation: 'tweetsByIds',
  parameters: { tweet_ids: tweetId },
  responseProjection: {
    id: '/tweets/0/id',
    likes: '/tweets/0/likeCount',
    replies: '/tweets/0/replyCount',
    retweets: '/tweets/0/retweetCount',
    views: '/tweets/0/viewCount',
  },
};
const url = 'https://airnode-twitterapi.fly.dev/';
const requestHash = deriveRequestHash(request);
const doc = (await (await fetch(url)).json()) as { 'x-airnode': { address: `0x${string}` } };
const airnode = doc['x-airnode'].address;
const paying = createPayingFetch(key);

mkdirSync(new URL('../cardano/out/', import.meta.url), { recursive: true });
const file = new URL(`../cardano/out/like-speed-${tweetId}.jsonl`, import.meta.url);
console.error(`tweet ${tweetId}: up to ${max} fetches, ${gapSeconds}s between them, log ${file.pathname}`);

for (let i = 1; i <= max; i++) {
  const startedAt = Date.now();
  try {
    const signed = await fetchSignedResponse(url, request, paying);
    await verifySignedResponse(signed, airnode, requestHash);
    const row = { n: i, requestedAt: startedAt, receivedAt: Date.now(), signedAt: Number(signed.timestamp) * 1000, data: JSON.parse(signed.data) };
    appendFileSync(file, `${JSON.stringify(row)}\n`);
    console.error(`${i}/${max} signed ${new Date(row.signedAt).toISOString().slice(11, 19)}Z likes ${row.data.likes} views ${row.data.views} (took ${row.receivedAt - startedAt} ms)`);
  } catch (error) {
    console.error(`${i}/${max} failed: ${String((error as Error).message).slice(0, 120)}`);
  }
  await new Promise((resolve) => setTimeout(resolve, gapSeconds * 1000));
}
console.error('done');

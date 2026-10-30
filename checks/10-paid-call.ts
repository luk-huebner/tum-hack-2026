// One AirnodeHub call through POST /, verified like a contract would verify it (signer, request hash).
// Run by a person who holds a TESTNET key: the key stays in .env (PAYER_PRIVATE_KEY, Base Sepolia, aUSD only).
//   node --env-file=.env checks/10-paid-call.ts tweet <tweetId>
//   node --env-file=.env checks/10-paid-call.ts lunar-post <tweet|youtube-video|tiktok-video|reddit-post|instagram-post> <postId>
//   node --env-file=.env checks/10-paid-call.ts meteo-rain  <lat> <lon> <startDate> <endDate>   (max 20 days)
//   node --env-file=.env checks/10-paid-call.ts meteo-solar <lat> <lon> <startDate> <endDate>   (max 20 days)
// Add --dry to print the request and the price without paying. Without PAYER_PRIVATE_KEY the call stops at the 402 and
// prints the price; nothing is ever paid unless the key is set and --dry is absent.
import { mkdirSync, writeFileSync } from 'node:fs';
import { isHex, type Hex } from 'viem';
import { deriveRequestHash, fetchSignedResponse, verifySignedResponse, type AirnodeV2Request } from '../lib/airnode-v2.ts';
import { createPayingFetch, readPaymentSettlement } from '../lib/x402.ts';

const [preset, ...rest] = process.argv.slice(2).filter((a) => a !== '--dry');
const dry = process.argv.includes('--dry');

const days = (start: string, end: string) => Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
const dailyProjection = (variable: string, n: number) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`d${String(i).padStart(2, '0')}`, `/daily/${variable}/${i}`]));

const build = (): { slug: string; request: AirnodeV2Request } => {
  switch (preset) {
    case 'tweet':
      // No projection on the first call: the listing does not document the tweet's field names.
      return { slug: 'twitterapi', request: { operation: 'tweetsByIds', parameters: { tweet_ids: rest[0] } } };
    case 'lunar-post':
      return { slug: 'lunarcrush', request: { operation: 'post', parameters: { post_type: rest[0], post_id: rest[1] } } };
    case 'meteo-rain':
    case 'meteo-solar': {
      const [lat, lon, start, end] = rest;
      const n = days(start, end);
      if (n < 1 || n > 20) throw new Error('A projection allows at most 20 fields, so use a window of 1 to 20 days');
      const rain = preset === 'meteo-rain';
      const variable = rain ? 'precipitation_sum' : 'shortwave_radiation_sum';
      return {
        slug: 'open-meteo',
        request: {
          operation: rain ? 'historicalWeather' : 'satelliteRadiation',
          parameters: { latitude: lat, longitude: lon, daily: variable, start_date: start, end_date: end, timezone: 'UTC' },
          responseProjection: dailyProjection(variable, n),
        },
      };
    }
    default:
      throw new Error('Unknown preset. Use tweet, lunar-post, meteo-rain or meteo-solar (see the header of this file).');
  }
};

const { slug, request } = build();
const url = `https://airnode-${slug}.fly.dev/`;
const requestHash = deriveRequestHash(request);
const doc = (await (await fetch(url)).json()) as { 'x-airnode': { address: Hex } };
const airnode = doc['x-airnode'].address;
console.error(`listing ${slug}, signer ${airnode}\nrequest hash ${requestHash}`);

const key = process.env.PAYER_PRIVATE_KEY;
if (dry || !key) {
  const probe = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  if (probe.status === 402) {
    const requirements = JSON.parse(Buffer.from(probe.headers.get('payment-required') ?? '', 'base64').toString() || '{}');
    const units = requirements.accepts?.[0]?.amount;
    console.error(`402 Payment required: ${units} units of aUSD (6 decimals) = ${Number(units) / 1e6} aUSD. Nothing was paid.`);
  } else {
    console.error(`HTTP ${probe.status} without payment (operation is free or the request was refused).`);
    console.log((await probe.text()).slice(0, 600));
  }
  if (!key && !dry) console.error('Set PAYER_PRIVATE_KEY in .env (testnet key) to make the paid call.');
  process.exit(0);
}
if (!isHex(key)) throw new Error('PAYER_PRIVATE_KEY is not a 0x-prefixed hex string');

const paying = createPayingFetch(key);
const settled: typeof fetch = async (input, init) => {
  const response = await paying(input, init);
  const settlement = readPaymentSettlement(response);
  if (settlement) console.error(settlement.success ? `payment settled: https://sepolia.basescan.org/tx/${settlement.transaction}` : `payment failed: ${settlement.errorReason}`);
  return response;
};
const signed = await fetchSignedResponse(url, request, settled);
await verifySignedResponse(signed, airnode, requestHash);
const ageSeconds = Math.round(Date.now() / 1000) - Number(signed.timestamp);
console.error(`signature OK (signer and request hash match), signed ${ageSeconds}s ago`);

mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
const file = new URL(`./out/${preset}-${signed.timestamp}.json`, import.meta.url);
writeFileSync(file, JSON.stringify({ request, requestHash, ...signed }, null, 2));
console.error(`saved ${file.pathname}`);
console.log(signed.data.length > 3000 ? `${signed.data.slice(0, 3000)} ...[truncated, ${signed.data.length} chars]` : signed.data);

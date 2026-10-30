// Free check, no keys, no payment. Reads each AirnodeHub listing's root document (a plain GET) and prints the signer
// address and the per-operation price, so nothing relies on the stale local catalogue.
// Run: node checks/00-prices.mjs            (default shortlist)
//      node checks/00-prices.mjs open-meteo (one listing, all operations)
const SHORTLIST = {
  twitterapi: ['tweetsByIds', 'userInfo'],
  lunarcrush: ['post', 'postTimeSeries', 'creatorTimeSeries'],
  'open-meteo': ['historicalWeather', 'satelliteRadiation', 'flood'],
  customweather: ['dailyClimateHistory'],
  frankfurter: ['getRates'],
  gleif: ['getLegalEntity'],
  'companies-house': ['getCompanyProfile'],
  usgs: ['queryEvents'],
  nodary: ['latestFeeds'],
};

const walk = (node, found) => {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, found));
  if (node === null || typeof node !== 'object') return;
  const op = node.operation;
  if (op && typeof op === 'object' && op.const) found.set(op.const, op['x-airnode-price'] ?? 'free / not listed');
  for (const value of Object.values(node)) walk(value, found);
};

const only = process.argv[2];
const slugs = only ? { [only]: null } : SHORTLIST;
for (const [slug, wanted] of Object.entries(slugs)) {
  const url = `https://airnode-${slug}.fly.dev/`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const doc = await response.json();
    const found = new Map();
    walk(doc, found);
    console.log(`\n${slug}  signer ${doc['x-airnode']?.address ?? '?'}  (${found.size} operations)`);
    for (const [name, price] of found) {
      if (wanted && !wanted.includes(name)) continue;
      console.log(`  ${name.padEnd(24)} ${price}`);
    }
  } catch (error) {
    console.log(`\n${slug}  FAILED: ${error.message}`);
  }
}

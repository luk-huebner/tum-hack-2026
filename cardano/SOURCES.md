# Register any AirnodeHub request as a source

"Any API in your contract", one command per API. The contract rebuilds the signed text from fixed pieces and the numbers between them, so any signed response whose text is a flat run of `"name":number` members can be waited for, without changing the validator.

```bash
cd cardano
npx tsx src/register-source.ts --spec specs/meme-tweet-likes.json --dry     # price and nothing else
npx tsx src/register-source.ts --spec specs/meme-tweet-likes.json --twice   # buys two signed responses and compares their fixed text
```

What happens, in order:

1. The listing's price is read from its 402 answer (nothing is paid in a dry run).
2. One signed response is bought through `checks/10-paid-call.ts` (signer and request hash are verified like a contract would), or taken from `--from <saved response>`.
3. The signed text is cut into **prefix, separators, suffix and number slots** (the numbers after a colon). The fields named in `use` must sit next to each other; the rule sums them.
4. It refuses a text whose fixed part is over 4,000 bytes and warns about over 1,200 bytes, non-ASCII characters (a creator editing a title would break every policy) and a request without a `responseProjection`. With `--twice` it buys a second response and refuses if the fixed text differs.
5. It writes `vectors/src-<id>.json` (a public signed response and the key that signed it) and an entry in `vectors/sources.json`.

After that, with no other change:

- the escrow route offers it: template `source`, `sourceId`, `atLeast` (or `below`);
- the seller's keeper recognises policies that pin its request and can prove them (source string `reg:<id>`);
- the console's board reads it, and the escrow client builds it: `npx tsx src/escrow-client.ts --template source --source meme-tweet-likes --at-least 1`.

## The spec file

```json
{
  "id": "meme-tweet-likes",
  "label": "likes of the Cardano and API3 meme post 2116232087808205089",
  "slug": "twitterapi",
  "request": { "operation": "tweetsByIds", "parameters": { "tweet_ids": "2116232087808205089" },
               "responseProjection": { "id": "/tweets/0/id", "likes": "/tweets/0/likeCount" } },
  "use": ["likes"],
  "cmp": "AtLeast",
  "kind": "counter",
  "scale": 0
}
```

`slug` is the listing name (`https://airnode-<slug>.fly.dev/`). `kind` is `static` (a finished period: checked once), `counter` (moves: the schedule in `POLLING.md`) or `feed` (a price). `responseProjection` asks the Airnode for only the pointers listed (RFC 6901, at most 20), which keeps the signed text small and removes text a creator could edit.

## Registered so far

| Source | Request | Registered |
|---|---|---|
| `meme-tweet-likes` | likes of the team's Cardano and API3 meme post on X (any tweet works through TwitterAPI.io) | 30 Oct, two paid fetches (0.02 aUSD); an escrow on it was paid and released on chain (`PROOFS.md`) |
| `yt-views-brian-cohen` | views of a YouTube video through LunarCrush | 30 Oct, from a response already bought; eight contract tests with the same shape pass in CI; no escrow run on chain |

## Limits

- Only numbers that follow a colon in an object are readable (not numbers inside arrays). A response with arrays needs a projection that picks single elements.
- The signed text must be the same shape on every fetch. A response whose fixed part changes (a changing title, a list that grows) cannot be waited for; `--twice` catches the common cases but not a change that happens later.
- A source that returns an empty record for an unknown id (the tweet API does) is safe only because the id is part of the signed text and so of every policy.
- The tool buys data, so it runs on a machine with the payer key. It is not part of the public judge site, which holds no key.
- Not every listing was tried. Instagram and TikTok posts are untested (`PROOFS.md`, LunarCrush section).

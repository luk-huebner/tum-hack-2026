# Hosting the public judge site

The judge site is the tamper bench and the live board on a public URL, so that a judge can paste a signed response and see the validator's own verdict without our laptops being on. It is the same page and the same routes as the local console (`src/judge-routes.ts`), run by `src/judge-site.ts`.

## What the host holds, and what it does not

| Holds | Does not hold |
|---|---|
| `BLOCKFROST_PROJECT_ID`: a free preprod key, read access to the chain and script evaluation | any seed phrase or payment key |
| `SELLER_ADDRESS`: a public preprod address (the evaluation reads its UTxOs for fee and collateral) | any aUSD key |
| the compiled validator, public test vectors, the standing bench refs, the web page | the paid routes (`/api/keep`, `/api/escrow`), the keeper, the live runs |

The client is address-only: it can build and evaluate a transaction but cannot sign one. A verdict is the node's script evaluation of an unsigned release transaction; nothing is ever sent to the chain. Visitors are rate-limited to 30 evaluations a minute each, and at most 3 run at once.

## Deploy (Vercel CLI)

```bash
cd cardano
node scripts/bundle-judge-site.mjs        # writes ../deploy/judge, a clean folder (git-ignored)
cd ../deploy/judge
npx vercel login                          # once, in the browser
npx vercel deploy --prod --yes            # first run creates the project
```

Then set the two variables in the project (Vercel dashboard, Settings, Environment Variables), or with `npx vercel env add NAME production`, and deploy once more so the function sees them.

To update the site after a change: bundle again and run `npx vercel deploy --prod --yes` from `deploy/judge`.

## Check a deployment

Open the URL, go to "Tamper bench" and press Run. It must show six results: the control accepted, the four tampered cases rejected, the control accepted again. `GET /health` answers `{"ok":true}`.

## Limits

- Verdicts depend on Blockfrost being up and within its free-tier limits.
- The standing bench policies (`standing-policies.json`) must still be unspent at the validator; if they are spent the page says so, and `src/attacks.ts` re-locks them.
- The in-memory rate limit is per server instance, so it is a courtesy, not a guarantee.

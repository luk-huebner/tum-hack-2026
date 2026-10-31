# CreatorPay web app

The brand, creator and verifier screens for Pay-on-Proof. A brand states the deal (creator, disclosure tag, like milestones, campaign length); the creator posts on X and submits the link with a payout address; the service checks the post with one API3-signed look, registers it, and pays one 5 tADA escrow per milestone by x402 straight into the validator. The keeper fetches the signed like count every few seconds and the contract pays the creator when a milestone is proven. Every lock and payout links to Cardanoscan.

| Page | For | What it does |
|---|---|---|
| `/brand` | the brand | create a campaign, get the creator invite link and QR code, follow every campaign |
| `/c/:id` | the creator, and anyone watching | the offer, the post submission, then the live signed like count, milestone progress, activity log and proof (contract, pinned request and signer, lock and payout transactions, the signed response) |
| `/creator` | the creator | open an invite link or pick an open campaign |
| `/verify` | judges | the six-step tamper bench against the live contract, and everything locked at the contract right now |

The app is a static Vite + React build. All chain work happens in the Pay-on-Proof service (`cardano/src/service.ts`, routes in `cardano/src/campaigns.ts`).

## Run it locally

Needs Node 24 and the two `.env` files described in the main README: `cardano/.env` (`MNEMONIC` = the brand wallet, `SELLER_MNEMONIC`, `SELLER_ADDRESS`, `BLOCKFROST_PROJECT_ID`, `FACILITATOR_URL`) and the root `.env` (`PAYER_PRIVATE_KEY`, Base Sepolia with test aUSD).

```bash
# terminal 1: the service with live submissions and the keeper in booth mode (a signed check every 5 s)
cd cardano && npm install && npm run creatorpay      # http://localhost:4022

# terminal 2: the web app
cd webapp && npm install && npm run dev              # http://localhost:5173 (proxies /api to the service)
```

On Windows `npm run creatorpay` fails (the script uses a POSIX `VAR=1 command` prefix): run it from Git Bash, or set the variables first and use `npm run service`. `npm run creatorpay` sets `CREATORPAY_LIVE=1 AUTO_RELEASE=1 AUTO_RELEASE_PAID=1 AUTO_RELEASE_FAST=1 AUTO_RELEASE_INTERVAL_S=5` and an aUSD cap of 2 (`AUTO_RELEASE_AUSD_CAP` overrides it). Booth mode pays 0.01 aUSD per check, about 0.12 aUSD a minute while an escrow is open. On Windows, set those variables yourself and run `npm run service`.

Without `CREATORPAY_LIVE=1` the server is read-only: campaigns can be created and viewed, the bench works, and a submission is refused with the reason shown on the page.

## Live demo runbook

1. **Brand** (`/brand`): brand name, campaign, the creator's X handle, milestones such as +1 and +3 new likes, 60 minutes. Create. Copy the invite link or show the QR code.
2. **Creator posts on X**, with `#ad` in the text, then Share → Copy link.
3. **Creator** opens the invite link, pastes the post link and a preprod payout address (`addr_test1…`), presses *Verify my post and lock the payout*. The activity log shows the signed look, the checks, the registration and each x402 payment with its Cardanoscan link. Expect about 1 minute per milestone.
4. **Like the post.** The heart counter updates from the keeper's next signed response; the milestone turns *Releasing*, then *Paid* with the payout transaction (about a minute: the release waits for the chain's clock to pass the signing time).
5. **Proof**: open the payout transaction on Cardanoscan. It spends the escrow at the contract address, pays 5 tADA to the creator's address, and carries the signed response in its redeemer. `/verify` runs the tamper bench: one valid, four tampered rejected, one valid.

Rehearse once before the pitch: the brand wallet needs about 6 tADA per milestone plus fees, the seller wallet pays release fees and collateral, and the payer key needs aUSD.

## Deploying the frontend (Vercel)

`vercel.json` builds the static app and rewrites every route to `index.html`. Set `VITE_API_BASE` to the public URL of a running service and start the service with `CORS_ORIGIN=<the Vercel URL>`. The service holds keys and spends test funds, so it is not part of the Vercel deployment; the existing public judge site (`cardano/HOSTING.md`) remains the keyless option for the bench.

## API for many creators, the posting payment and the engine view (added 31 Oct)

All on the service, same origin as the rest of `/api/cp/*`. Nothing here changes the old fields.

| Route | What it does |
|---|---|
| `POST /api/cp/campaigns` | now also takes `posting` (`true`, or `{ "units": 1, "label": "Post goes live" }`) and `units` on each milestone. A campaign needs a posting payment or at least one like milestone; at most 3 milestones, at most 8 escrows in all (`units` is 1 to 3). |
| `POST /api/cp/campaigns/bulk` | the same body plus `creators`: a list of X handles (or `{ "handle": "..." }`), at most 50. One campaign per creator, all with the same `groupId`. Answers `{ groupId, campaigns, skipped: [{ row, handle, reason }] }`; duplicates and invalid handles are skipped and listed (this is what a CSV import shows the brand). |
| `GET /api/cp/groups/:id` | every campaign of one import. |
| `GET /api/cp/creator?wallet=&handle=&post=` | the creator's view. `wallet` is the payout address, `handle` the X handle (before the post is submitted), `post` a link or id that narrows it to one post. At least one is needed. |
| `GET /api/cp/engine` | everything behind the screens: keeper status and what it watches, every journalled transaction (state, block, Cardanoscan link), the activity log and the signed data per post. Read only. |

An escrow now has `kind` (`"posting"` pays as soon as the post is live, threshold 0; `"likes"` pays at `threshold`), `label`, and `unit` / `units` when a milestone is split over several 5 tADA escrows. The posting payment is `milestone: -1`. A campaign view has `budgetTada`.

The budget is counted in 5 tADA units (the escrow route's fixed amount): for one creator, a posting payment plus likes 1, 2 and 3 is 4 units, 20 tADA. Percentages other than multiples of one unit are not possible yet.

## Limits

- One 5 tADA escrow per milestone (the escrow route's fixed amount), each a separate x402 payment, locked one after the other.
- The escrow is locked after the post exists, because the policy pins the post id. The brand's terms are stored by the service until then; nothing is locked when the campaign is created.
- Campaigns are stored in `cardano/out/campaigns.json` on the server that runs the service.
- The live like count shown is the latest value from the keeper's signed responses, or the signed look at submission until the keeper's first check.
- The full flow through the web app has not been run on chain yet. The pieces it calls (intake checks, `register-source.ts`, the x402 escrow route, the keeper) were each run on chain before (`PROOFS.md`).

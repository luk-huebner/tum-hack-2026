# Pay-on-Proof (CreatorPay)

**Outcome-based payments for agents on Cardano, verified by API3 data.** To our knowledge the first contract on Cardano that checks an API3 AirnodeHub signature itself, so a job (a Masumi agent's, a creator's) can be paid only when a signed fact proves the result. [What we changed because someone challenged us](ITERATIONS.md). [How it becomes a service, and what it costs us today](SERVICE.md).

Money moves on Cardano only when signed real-world data proves a condition agreed in advance. One Aiken validator checks an [AirnodeHub](https://airnodehub.api3.org) (API3) response itself: who signed it, which request it answers, how old it is, and whether it satisfies a rule. Then it pays, or after a deadline refunds.

Built at the TUM Blockchain & AI Hackathon 2026 (30 to 31 Oct, Munich). Testnets only: Cardano preprod and Base Sepolia. A prototype, not audited; a signature proves what the data provider said, not that it is true.

**Try it without installing anything:** the [public judge console](https://pay-on-proof-judge.vercel.app) runs a six-step tamper test against the live validator. It sends no transaction and costs nothing. Running the service yourself needs keys and a wallet: start in `cardano/` ([cardano/JUDGES.md](cardano/JUDGES.md)).

## At a glance (for judges)

**What it does.** A brand states a deal for a creator's post: a posting payment and like milestones. After the creator posts and submits the link, the money is locked in a Cardano contract. The contract pays the creator when a signed API3 response proves a milestone, and refunds the brand after the deadline. **Pay-on-Proof** is the contract and the keeper; **CreatorPay** is the website for brands and creators.

| | |
|---|---|
| **Live site (CreatorPay)** | https://creatorpay-five.vercel.app. The pages are on Vercel, the service (keys, keeper) runs on our demo laptop, so it works only while that laptop is online. The judge site and the video do not depend on it |
| **Judge site (API3: send your own responses, tamper test)** | https://pay-on-proof-judge.vercel.app. Always on, holds no wallet key. Six-step bench: one valid, four tampered rejected by the validator, one valid. Paste a signed response and read the validator's own verdict |
| **Contract** | Aiken, Plutus V3, script hash `58fb7eefb61d968668106385cf7a7dc8e8591004162a81c6b50562ea`, address `addr_test1wpv0klh0kcwedpngzp3ctnm60hywskgsqstz4qwxk5zk96smxaale`, **Cardano preprod** |
| **A paid job through the website, start to finish** | a real post by `@abelix_app`: posting payment locked [`f81837cc…b7ad`](https://preprod.cardanoscan.io/transaction/f81837cc924a9ae222c049f5b33f0fdd5d39c406a53c06aba341a4cb2644b7ad), paid out [`d31271fe…462c`](https://preprod.cardanoscan.io/transaction/d31271fe203b298d272e6a9075b86350bc6774bd776c34fd6e514a2f221d462c); like milestone locked [`3bd1d0a4…323a`](https://preprod.cardanoscan.io/transaction/3bd1d0a411e73a8fa3fa71229520b382200190b72d13792a673cd1be8b9d323a), paid out [`5f13803b…8a8e`](https://preprod.cardanoscan.io/transaction/5f13803b80d7e4ea716698e301c4a1bbc67e00c516e54062b7c4deeb9eac8a8e). A second run and the details: [PROOFS.md](PROOFS.md#creatorpay-through-the-website-real-campaigns-with-a-real-x-account-31-oct-2026-1251-to-1335-utc) |
| **Tests** | `cd cardano && npx tsc --noEmit && node test/run-offline.mjs` (91 offline tests: 88 pass, 3 known todo, listed in `cardano/test/README.md`); 78 Aiken tests run in CI |
| **Security and trust** | [TRUST.md](TRUST.md) (what the contract proves and what it does not, the web layer), [AUDIT.md](AUDIT.md) (threat model, findings, questions for a reviewer), [docs/night/SECRET_SCAN_MORNING_CHECK.md](docs/night/SECRET_SCAN_MORNING_CHECK.md) |
| **Tracks** | Cardano (agentic commerce), API3, TUM Blockchain Track (audit) |

**Run it yourself.** Node 24, a free Blockfrost preprod key and two test wallets. Keys go only in the git-ignored `cardano/.env` and `.env` (names in `cardano/.env.example`), never in the repository.

```bash
cd cardano && npm install && npm run creatorpay    # the service, the keeper and live submissions on http://localhost:4022
cd webapp && npm install && npm run dev            # the website on http://localhost:5173
```

More: [webapp/README.md](webapp/README.md) (runbook, API, who sees what), [cardano/JUDGES.md](cardano/JUDGES.md) (the tamper bench).

**Honest limits.** Testnets only (Cardano preprod, Base Sepolia); not externally audited. A signature proves what the data provider said, not that likes are real. There are no accounts: a shared team access code gates creating campaigns, and a creator opens an offer from its invite link. The website can show "Paid" when the keeper submits the payout; the chain confirms it a few seconds to a minute later (the Engine page shows the confirmed state). A lock can fail after a network error and be retried (it happened in 2 of the 3 website runs). The first version of the contract had a double-satisfaction flaw, fixed and kept as evidence in [TRUST.md](TRUST.md).

## What works today

Every item below links to its evidence in [PROOFS.md](PROOFS.md): a transaction hash where the item is on chain, test output or a stand-in check where it is not (the Masumi layer and the MCP server are checked off chain).

- **The validator verifies an Airnode attestation on Cardano.** Plutus V3, 2,317 bytes, script hash `58fb7eef...62ea`. 78 Aiken tests pass in CI, including API3's four required tamper cases. An attack matrix found a double-satisfaction flaw in the first version (`a9e4420c...`); it is fixed and the same attack is now refused ([TRUST.md](TRUST.md)). An audit-preparation document with the threat model, a flaw checklist, measured execution cost and questions for a reviewer is in [AUDIT.md](AUDIT.md).
- **Release, refund and live flow on preprod.** A real signed Open-Meteo response released a policy; a response signed 16 seconds earlier released a policy that accepts only 5 minutes; a refund after the deadline needs the funder's signature.
- **Two industries, one contract.** Rainfall (Open-Meteo, 14 values summed) and tweet likes (TwitterAPI.io, a KPI) run on the same unchanged validator. An edited count (the forged screenshot) and an unmet KPI are rejected.
- **A judge tamper bench, as a web page and a command.** Send any signed response to a locked policy and get ACCEPTED or REJECTED from the validator's own evaluation; the page runs the six-step bench (two controls, four tampered cases) in one click and never sends a transaction: [cardano/JUDGES.md](cardano/JUDGES.md).
- **A keeper agent.** It runs on a schedule with a spending cap, adapts its waiting time, backs off on failures, logs every cycle, and releases a policy when the data satisfies it: [cardano/src/keeper.ts](cardano/src/keeper.ts).
- **A paid keeper job on Cardano (x402, 2 tADA).** `POST /api/keep` in `cardano/src/service.ts` fetches a fresh signed response for a locked policy and releases it if the rule holds. The buyer is charged only when it releases: one paid run released 5 tADA (payment `51188ed4…6ffb`, release `1678080a…9d84`), and a refused request left both balances unchanged. See PROOFS.md.
- **An x402 payment locked straight into the validator.** `POST /api/escrow` uses the Cardano x402 `script` transfer method: the buyer's 5 tADA payment output goes to the validator with a policy datum (seller paid if ETH/USD reaches a price, buyer refunded after the deadline). One run on preprod: payment `d903edc3…b292`, then released by the keeper (`076de3e1…6430`), 5 tADA to the seller. The same route also refunded the buyer after the deadline (`1057e1d9…0d1d`), and refused a refund before it. See PROOFS.md.
- **A seller's keeper that finds and releases policies on its own.** With `AUTO_RELEASE=1` (and `AUTO_RELEASE_PAID=1` for the tweet and rainfall templates, capped by `AUTO_RELEASE_AUSD_CAP`) the service scans the validator for policies that name its seller key as beneficiary, fetches a fresh signed response for the sources it needs, and releases the first policy whose rule holds (`cardano/src/autorelease.ts`). Paid sources are not polled on a fixed timer: `cardano/src/polling.ts` plans each check from its cost, the kind of data (static data once, a counter by its predicted crossing, no trend at most 5 minutes apart) and an aUSD budget, derived and simulated in [POLLING.md](POLLING.md), and checked live on two escrows (0.13 aUSD in total). It fails safely: a failing data source backs off on its own, provider calls time out, a failed release is retried without counting when it may only be an evaluator that cannot see fresh outputs, it gives up on a policy only after three real refusals (the buyer can still refund), it handles several escrows in deadline order, and after a crash it finds the open escrows again from the chain. Tested on chain with injected faults, a lost response and a restart (PROOFS.md). One run on preprod: the buyer paid 5 tADA by x402 into the validator (`576696ed…99ef`) and the watcher released it about 40 s later with no further command (`d4d63369…41db`). See PROOFS.md.
- **A public judge site: https://pay-on-proof-judge.vercel.app** The tamper bench and the live board on a public URL, for judges who want to paste their own signed response and see the validator's own verdict. It holds no wallet signing key (an address-only client with a free Blockfrost access key and a public address) and never sends a transaction. How it is built and deployed: [cardano/HOSTING.md](cardano/HOSTING.md).
- **A console** (from `cardano/`: `npm run service`, then http://localhost:4022): an overview with the flow diagram, a live board of everything locked at the contract, the tamper bench, and an evidence tab linking every receipt. With `DEMO_BUYER=1` it also has a "Run it live" panel that pays a real escrow and shows each step: price list, the client's field-by-field check, the payment, the policy appearing at the contract, the seller's keeper releasing it (or an early refund being refused and then a real refund).
- **Three templates on the same contract, through the paid route:** the likes of a registered tweet at least N (0.01 aUSD per check), Munich rainfall below X mm (0.1 aUSD per check), and a price feed that is only a free **test fixture** (a price threshold is a bet, not a use case; it exists so that the machinery can be tested without paying for data). Each ran end to end: x402 payment into the validator, release by the seller's keeper. See PROOFS.md.
- **Other platforms.** A real signed LunarCrush `post` response for a YouTube video (projected to id, views, likes and comments) passes 8 engine tests with no contract change; it is not a service template yet, and LunarCrush only serves posts it indexes ([PROOFS.md](PROOFS.md)).
- **Any AirnodeHub request as a source** ([cardano/SOURCES.md](cardano/SOURCES.md)): `register-source.ts` buys one signed response, cuts it into the contract's fixed text and number slots and registers it, with no validator change. A live Creator Pay payout ran through it on 30 Oct: a like on a post, the keeper in booth mode, 5 tADA released 53 s later ([PROOFS.md](PROOFS.md)).
- **Creator Pay** ([cardano/CREATOR_PAY.md](cardano/CREATOR_PAY.md)): from the link to a creator's post to an escrow that pays the creator. The intake tool checks that the author is the agreed creator, that the post is new, not a reply and carries a disclosure tag, and pins the author, the creation time and the id into what the Airnode signs; offers can count only a measurement signed after a given time (this fixes when the count is taken; it does not show when the likes were earned, so likes bought earlier still count) and pay a named payee. A planner pays a creator in tranches (one third after the campaign, two thirds only if the post is still there a week later), and `--pin-text` pins the exact post text so an edit stops the payout. Run on chain on a test post (a payout to a named payee, and a retention part that was refunded); a real deletion was simulated by an unlike. The split is a plan file per creator type (a post that stays up, a post that lives 24 hours, a delivery fee plus bonus).
- **The hired keeper as a Masumi agent** ([cardano/MASUMI.md](cardano/MASUMI.md)): the four MIP-003 routes (`/availability`, `/input_schema`, `/start_job`, `/status`) that let a Masumi buyer hire the keeper and pay it through Masumi, while the conditional payment stays in our contract. This makes outcome-based jobs possible for Masumi agents. Tested with 23 checks against a stand-in for the Masumi payment service; **not yet run against a real one** (it needs Docker and funded wallets).
- **The contract as tools for an AI agent (MCP)** ([cardano/MCP.md](cardano/MCP.md)): seven tools (list sources and escrows, check one, preview a conditional payment, ask the validator for a verdict on a signed response, and, only when the operator turns spending on, lock a 5 tADA escrow by x402 and refund it). Spending is off by default and needs `confirm: true`. A 14-check test client passes. For an agent without our keys, the public site publishes `/llms.txt`.
- **A paid x402 request on Cardano preprod** (the Cardano gate), from the official template with a fix for a TTL rejection.

## How it works

A policy is an inline datum at the validator: the Airnode's public key, the request hash, the shape of the signed text (fixed fragments around numeric slots), a rule (the sum of some slots is below, or at least, a threshold), time limits, a beneficiary and a refund party.

To release, anyone (a user, a keeper, an agent) submits the signature, the timestamp and the slot values. The validator:

1. rebuilds the signed text byte for byte from the slot values and the fixed fragments,
2. verifies the secp256k1 signature over `keccak256(requestHash, timestamp, data)` against the pinned key,
3. checks the clock: not signed in the future, not older than the policy's maximum age, after the data window settled, before the deadline,
4. parses the slot values as decimals and applies the rule,
5. requires the payout to the beneficiary. Spending the UTxO is what prevents a second payout.

## Layout

| Path | What |
|---|---|
| `aiken/airnode_spike/` | the validator, the engine library and the tests (real signed responses as vectors) |
| `aiken/blueprint/plutus.json` | the compiled validator, built by CI |
| `cardano/src/engine.ts` | datum and redeemer encoding, script address, helpers |
| `cardano/src/autorelease.ts` | the seller's keeper: finds policies that pay the service and releases them |
| `cardano/src/proof.ts` | shared helpers: buy a signed response, check it against a policy, release window, verdict classification |
| `cardano/src/service.ts`, `keep-client.ts`, `escrow.ts`, `escrow-client.ts`, `web/index.html` | the service (judge page, paid keeper route, escrow route), its x402 clients, the page |
| `cardano/src/engine-demo.ts`, `live.ts`, `creator-demo.ts`, `judge.ts`, `keeper.ts`, `refund.ts` | the on-chain demos; `refund.ts` refunds any policy to its refund party after the deadline |
| `cardano/vectors/` | real signed responses and the tamper files |
| `checks/` | scripts for prices, signed vectors, paid AirnodeHub calls, wallets, aUSD minting |
| `lib/` | helper files copied from the API3 starter (MIT) |

## Running it

Needs Node 24. Aiken's tests run in CI (`.github/workflows/aiken.yml`); the Windows ARM build of Aiken crashes on test execution.

- Judges: [cardano/JUDGES.md](cardano/JUDGES.md).
- The keeper: `tsx src/keeper.ts lock --source nodary:ETH/USD --delta 4` locks a policy (5 tADA, "ETH/USD at least now + 4"), then `tsx src/keeper.ts run --submit --interval 20 --max-cycles 30 --budget 0.05` polls the signed price, waits, backs off after failures and releases once the rule holds. Without `--submit` it only reports. Every cycle is written to `cardano/out/keeper-log.jsonl`. Sources: `nodary:<feed>` (free) and `tweet:<id>` (0.01 aUSD per cycle, counted against `--budget`).
- Everything else needs a funded Cardano preprod wallet and a Blockfrost key in `cardano/.env`, and for paid calls a Base Sepolia test key with aUSD in `.env` (`checks/02-new-wallet.mjs`, `checks/04-mint-ausd.mjs`). Never use a key that holds real money.

## Limits, stated plainly

What the contract proves, who can do what, which trust assumptions disappear and which remain, and the gaps we know of are in [TRUST.md](TRUST.md).


- A signature proves what the API returned, not that it is true. Likes can be bought, and the upstream APIs can be wrong. For most listings the Airnode is run by API3 over a provider's API.
- The contract checks the data's own observation time (for example a price feed's `updatedAt`) only when the policy asks for it, and only for feeds that sign one: the ETH/USD escrow uses it with a 120 s limit, the rainfall and tweet templates do not. For those it checks only when the Airnode signed.
- The rule is deliberately small: a sum of numeric slots compared with a threshold.
- Rejections shown in the demos are failed script evaluations reported by the node provider before submission, not failed transactions.
- Not audited. Test funds only.

Built from the [API3 AirnodeHub starter](https://github.com/api3dao/airnodehub-hackathon-starter), the Cardano Foundation's x402 Express template and the Aiken standard library.

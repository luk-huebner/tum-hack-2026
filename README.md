# Pay-on-Proof

Money moves on Cardano only when signed real-world data proves a condition agreed in advance. One Aiken validator checks an [AirnodeHub](https://airnodehub.api3.org) (API3) response itself: who signed it, which request it answers, how old it is, and whether it satisfies a rule. Then it pays, or after a deadline refunds.

Built at the TUM Blockchain & AI Hackathon 2026 (30 to 31 Oct, Munich). Testnets only: Cardano preprod and Base Sepolia.

## What works today

Every item below has a transaction hash in [PROOFS.md](PROOFS.md).

- **The validator verifies an Airnode attestation on Cardano.** Plutus V3, 1,832 bytes. 39 Aiken tests pass in CI, including API3's four required tamper cases.
- **Release, refund and live flow on preprod.** A real signed Open-Meteo response released a policy; a response signed 16 seconds earlier released a policy that accepts only 5 minutes; a refund after the deadline needs the funder's signature.
- **Two industries, one contract.** Rainfall (Open-Meteo, 14 values summed) and tweet likes (TwitterAPI.io, a KPI) run on the same unchanged validator. An edited count (the forged screenshot) and an unmet KPI are rejected.
- **A judge tamper bench, as a web page and a command.** Send any signed response to a locked policy and get ACCEPTED or REJECTED from the validator's own evaluation; the page runs the six-step bench (two controls, four tampered cases) in one click and never sends a transaction: [cardano/JUDGES.md](cardano/JUDGES.md).
- **A keeper agent.** It runs on a schedule with a spending cap, adapts its waiting time, backs off on failures, logs every cycle, and releases a policy when the data satisfies it: [cardano/src/keeper.ts](cardano/src/keeper.ts).
- **A paid keeper job (x402, 2 tADA) is built but not yet run end to end.** `POST /api/keep` in `cardano/src/service.ts` fetches a fresh signed response for a policy and releases it if the rule holds; the payment is settled only when it releases. The 402 price list works; a paid run is still to be done and recorded in PROOFS.md.
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
| `cardano/src/proof.ts` | shared helpers: buy a signed response, check it against a policy, release window, verdict classification |
| `cardano/src/service.ts`, `keep-client.ts`, `web/index.html` | the service (judge page and paid keeper route), its x402 client, the page |
| `cardano/src/engine-demo.ts`, `live.ts`, `creator-demo.ts`, `judge.ts`, `keeper.ts` | the on-chain demos |
| `cardano/vectors/` | real signed responses and the tamper files |
| `checks/` | scripts for prices, signed vectors, paid AirnodeHub calls, wallets, aUSD minting |
| `lib/` | helper files copied from the API3 starter (MIT) |

## Running it

Needs Node 24. Aiken's tests run in CI (`.github/workflows/aiken.yml`); the Windows ARM build of Aiken crashes on test execution.

- Judges: [cardano/JUDGES.md](cardano/JUDGES.md).
- The keeper: `tsx src/keeper.ts lock --source nodary:ETH/USD --delta 4` locks a policy (5 tADA, "ETH/USD at least now + 4"), then `tsx src/keeper.ts run --submit --interval 20 --max-cycles 30 --budget 0.05` polls the signed price, waits, backs off after failures and releases once the rule holds. Without `--submit` it only reports. Every cycle is written to `cardano/out/keeper-log.jsonl`. Sources: `nodary:<feed>` (free) and `tweet:<id>` (0.01 aUSD per cycle, counted against `--budget`).
- Everything else needs a funded Cardano preprod wallet and a Blockfrost key in `cardano/.env`, and for paid calls a Base Sepolia test key with aUSD in `.env` (`checks/02-new-wallet.mjs`, `checks/04-mint-ausd.mjs`). Never use a key that holds real money.

## Limits, stated plainly

- A signature proves what the API returned, not that it is true. Likes can be bought, and the upstream APIs can be wrong. For most listings the Airnode is run by API3 over a provider's API.
- The contract does not check the data's own observation time (for example a price feed's `updatedAt`), only when the Airnode signed.
- The rule is deliberately small: a sum of numeric slots compared with a threshold.
- Rejections shown in the demos are failed script evaluations reported by the node provider before submission, not failed transactions.
- Not audited. Test funds only.

Built from the [API3 AirnodeHub starter](https://github.com/api3dao/airnodehub-hackathon-starter), the Cardano Foundation's x402 Express template and the Aiken standard library.

# Judge tamper bench (Cardano preprod)

Two policies are locked at the validator and stay open until Sat 31 Oct 2026, 20:00 UTC. Each pays 5 tADA to the beneficiary if an AirnodeHub response, signed by the **Open-Meteo Airnode** `0xee510FFb986299529fE987bfD163D6c89067D767` for the pinned request (Munich rainfall, 10 to 23 Oct 2026, 14 daily values), sums to **less than 30.00 mm**.

| Policy | UTxO | Accepts a response up to |
|---|---|---|
| bench-48h | `4ec3a5dd555f794d3f8ea4ad730282701bc71a6e6e94518ddea875bc6d1d973e#0` | 48 hours old (so the stored real response works until Sun 1 Nov 10:22 UTC) |
| bench-5min | `4ec3a5dd555f794d3f8ea4ad730282701bc71a6e6e94518ddea875bc6d1d973e#1` | 5 minutes old |

The contract does all the checking: pinned signer key, pinned request hash, the signed text rebuilt byte for byte from the submitted values, the clock (not signed in the future, not older than the policy allows, after the data window settled, before the deadline), then the rule. The script here checks nothing.

## Setup

```bash
cd cardano
npm install
cp .env.example .env     # then set MNEMONIC (a funded Cardano PREPROD test wallet) and BLOCKFROST_PROJECT_ID
```

The wallet only pays fees and collateral. Test ADA: https://docs.cardano.org/cardano-testnets/tools/faucet

## The five cases

```bash
B=4ec3a5dd555f794d3f8ea4ad730282701bc71a6e6e94518ddea875bc6d1d973e
npx tsx src/judge.ts --utxo $B#0 --response vectors/tamper/valid.json           # real response            -> ACCEPTED
npx tsx src/judge.ts --utxo $B#0 --response vectors/tamper/edited.json          # one value edited         -> REJECTED
npx tsx src/judge.ts --utxo $B#1 --response vectors/tamper/valid.json           # too old (5-minute policy) -> REJECTED
npx tsx src/judge.ts --utxo $B#0 --response vectors/tamper/other-request.json   # real answer to another request -> REJECTED
npx tsx src/judge.ts --utxo $B#0 --response vectors/tamper/foreign-signer.json  # signed by a key that is not the Airnode -> REJECTED
```

`ACCEPTED` means the validator ran to completion on that response; nothing is sent unless you add `--submit`, which releases the 5 tADA (and spends the policy). `REJECTED` means the validator refused it, and nothing is sent.

Edit any field of `vectors/tamper/valid.json` (data, timestamp, requestHash, signature) or write your own response file and run it the same way.

## Getting your own fresh response

From the repository root, with a Base Sepolia test key holding aUSD in `.env` (`PAYER_PRIVATE_KEY`):

```bash
node --env-file=.env checks/10-paid-call.ts meteo-rain 48.14 11.58 2026-10-10 2026-10-23   # 0.1 aUSD
```

It prints the file it saved; pass that file to `judge.ts` with `--utxo $B#1` while it is under 5 minutes old. The mint script for aUSD is `checks/04-mint-ausd.mjs`.

## Notes

- A policy locked a few seconds ago may not be visible to the evaluator yet. If the control case is rejected, wait half a minute and run it again before drawing conclusions.
- A rejection is a failed script evaluation reported by the provider, before any transaction is sent. The provider's message is generic.
- A fresh response is signed "now". The contract needs the transaction to start after the signing time, and the node validates against its own latest slot, which can trail the clock by up to a minute. `live.ts` handles this; by hand, wait a minute.

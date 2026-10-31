# Judge tamper bench (Cardano preprod)

**Public page: https://pay-on-proof-judge.vercel.app** (tab "Tamper bench"). Paste a signed response into the box, or press "Run the whole bench (6 steps)". Nothing is ever sent to the chain; a verdict is the node's script evaluation of an unsigned release transaction.

Two policies are locked at the validator (script hash `58fb7eef...62ea`, Cardano preprod) and stay open until Sat 31 Oct 2026, 20:00 UTC. The first version of the validator (`a9e4420c...`, which had the double-satisfaction flaw in TRUST.md) has its own pair of bench policies, listed in `standing-policies-v1.json`; run the attacks against both with `attacks.ts` to see the difference. Each pays 5 tADA to the beneficiary (the buyer wallet's key: not the seller's, so the seller's keeper never releases the bench) if an AirnodeHub response, signed by the **Open-Meteo Airnode** `0xee510FFb986299529fE987bfD163D6c89067D767` for the pinned request (Munich rainfall, 10 to 23 Oct 2026, 14 daily values), sums to **less than 30.00 mm**.

| Policy | UTxO | Accepts a response up to |
|---|---|---|
| bench-48h | `403517841e2a925bffa38a50069a03449193b88402511b82088a77fdb6ff15bc#0` | 48 hours old (so the stored real response works until Sun 1 Nov 10:22 UTC) |
| bench-5min | `403517841e2a925bffa38a50069a03449193b88402511b82088a77fdb6ff15bc#1` | 5 minutes old |

The contract does all the checking: pinned signer key, pinned request hash, the signed text rebuilt byte for byte from the submitted values, the clock (not signed in the future, not older than the policy allows, after the data window settled, before the deadline), then the rule. The script here checks nothing.

## The quickest way: the bench page

```bash
cd cardano
npm install
cp .env.example .env     # set SELLER_ADDRESS, FACILITATOR_URL, MNEMONIC, SELLER_MNEMONIC, BLOCKFROST_PROJECT_ID
npm run service          # then open http://localhost:4022
```

Choose a policy, paste or edit a signed response (or load one of the examples), and press **Send to the contract**. **Run the whole bench** runs the six steps below in order (control, four tampered cases, control) and prints a table. The page never sends a transaction: it asks the node provider to evaluate the release, and reports the validator's verdict. The operator wallet in `.env` only provides fee and collateral inputs for that evaluation. At the booth, use the page on our laptop; to run it yourself you need a funded preprod test wallet and a Blockfrost key.

The page also shows "hint" lines under a rejection (wrong request, too old, rule not met). Those are worked out by the page, not by the contract; the verdict is the contract's.

## Setup for the command line

```bash
cd cardano
npm install
cp .env.example .env     # then set MNEMONIC (a funded Cardano PREPROD test wallet) and BLOCKFROST_PROJECT_ID
```

The wallet only pays fees and collateral. Test ADA: https://docs.cardano.org/cardano-testnets/tools/faucet

## The five cases

```bash
B=403517841e2a925bffa38a50069a03449193b88402511b82088a77fdb6ff15bc
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

It prints the file it saved; pass that file to `judge.ts` with `--utxo $B#1` (or paste it into the page) while it is under 5 minutes old. The mint script for aUSD is `checks/04-mint-ausd.mjs`.

## Notes

- A policy locked a few seconds ago may not be visible to the evaluator yet. If the control case is rejected, wait half a minute and run it again before drawing conclusions.
- A rejection is a failed script evaluation reported by the provider, before any transaction is sent. The provider's message is generic.
- A fresh response is signed "now". The contract needs the transaction's validity to start after the signing time and to end before the response gets too old for the policy; both `judge.ts` and the page set the interval that way (`evaluationWindow` in `src/proof.ts`). A response that is already too old gets a long interval instead, so that the validator, not an empty interval, refuses it.
- **Editing text that is not a number can still give ACCEPTED, and that is correct.** The page and `judge.ts` read only the numbers out of the `data` text (`slotsFromData` in `src/engine.ts`); the contract then rebuilds the signed text from the policy's prefix, separators and suffix and checks the signature over that. A changed field name or extra characters around the numbers never reach the contract, and a real release would carry the same numbers. To see a rejection, change a number, the signing time, the request hash or the signature.
- A verdict of ERROR means the question could not be asked (a dropped connection, a missing key). It is never a rejection by the contract.

# CreatorPay judge demonstration

## Demonstrate existing confirmed transactions without spending

Open these two real Preprod transactions in a browser:

1. [Lock 5 tADA for the live meme-post likes policy](https://preprod.cardanoscan.io/transaction/8c9ac1de176e74b90c0d43b68c2c972e7c93075166b9f1364997f3a7e4a05427), block 5354113, escrow output `#0`.
2. [Release to the beneficiary](https://preprod.cardanoscan.io/transaction/e3d03ef789985374587412cb459b0db441623ff770bd03006583da302ece5e67), block 5354119.

Verify that the release input references that exact lock/output; inspect current script hash `58fb7eefb61d968668106385cf7a7dc8e8591004162a81c6b50562ea`, decoded policy and release redeemer. Compare the beneficiary payment credential with the output holding 5,000,000 lovelace. The keeper log provides the seven preceding zero-like checks and first one-like check; those monitoring events are local evidence, not chain facts.

If the explorer challenges or omits a panel, run the read-only Koios query in `TRANSACTION_AUDIT.md`, or inspect the saved full response and normalized JSON. The new archive CLI needs no wallet:

```
cd cardano
npm ci --ignore-scripts --no-audit --no-fund
node --import tsx src/history.ts --archive e3d03ef789985374587412cb459b0db441623ff770bd03006583da302ece5e67
```

For a named-payee campaign show [campaign release](https://preprod.cardanoscan.io/transaction/3f22b3451cdccfcbea302b61221f06c25e9160f930d436edf421cc2bdf3426a3). It spends `fb6f91ecb5e9d509042558436c4d0a11901f94a3244fd74141de3dc72ec5a758#0` and pays the buyer's payment key. Show the two retention refund links in the lifecycle table. The demonstration used the team's own wallets and unliking, not deleting the post.

For cryptographic rejection, run the 78 Aiken tests; these use stored authentic vectors and do not spend. Do not expect historical fixed responses to remain fresh in a live policy today. A bench evaluation requires a reachable provider and unspent matching version; it is still only evaluation.

## What the complete flow actually supports

| Requested stage | Implemented / demonstrated |
|---|---|
| Company creates campaign | CLI planner and validated offer exist; no independently identified real company |
| Company funds escrow | Verified funding UTxOs, including direct x402 funding |
| Creator publishes and supplies post ID | Intake accepts existing posts; publication was manual. **Current flow requires post registration before funding**, because request hash and signed template pin the ID. Funding first and choosing a post later is not implemented. |
| Keeper monitors | Included JSONL traces; conditions measured repeatedly, some never met |
| AirnodeHub provides signed response | Real vectors and on-chain accepted release proofs |
| Keeper builds release | Shared builder; journal changes tested locally, not newly broadcast |
| Validator verifies | Real v1/v2 script spends, rebuilt v2 bytecode and passing tests |
| Creator receives funds | 19 release payouts verified against datums; named-payee test used team's buyer key |
| Confirmation | Blocks/heights/timestamps fetched independently from Koios |
| Explorer verification | Correct public links; UI itself blocked in audit, Koios fallback works |

X/Twitter is the demonstrated live creator-payment source. A projected indexed YouTube video has signed vectors and contract tests, but no identified on-chain YouTube campaign. Instagram creator-list data is historical API experimentation, not a demonstrated Instagram payout. TikTok support is not demonstrated. No promise of arbitrary post coverage, genuine engagement, deletion detection or days-long retention is justified.

Smallest honest demo: retain the registered X post and verified historical lock/release, show monitoring logs separately, run offline tamper tests, then compare ledger inputs and outputs. Do not introduce a new oracle contract or silently change policy semantics to fit a publish-after-funding story.

## Future live run — requires explicit transaction/API-payment approval

Use only Cardano Preprod, current default blueprint, and Base Sepolia test aUSD. Preview first:

```
cd cardano
node --import tsx src/creator-campaign.ts --plan plans/ephemeral-24h.json --source <registered-source-id> --payee <testnet-key-address>
```

After approval, the existing `--lock` path funds tranches; the keeper needs the named payee in `AUTO_RELEASE_PAYEES`, explicit paid-query budget, and enough separate ADA for fees/collateral. Keep one keeper per wallet. `CREATORPAY_METADATA=1` opts into non-sensitive messages for shared releases/refund CLI. Do not run old fixtures with a different blueprint.

Read confirmation records without submitting:

```
node --import tsx src/history.ts <campaign-id-or-escrow-ref-or-tx-hash>
```

This reads Blockfrost Preprod using your existing configured project ID and updates only local confirmation records. Unknown is not rejected. Reconcile funding before repeating a command; a new funding command can create a second escrow even though the same escrow cannot pay twice. All scripts remain explicit spending tools; this review did not execute them.

## Mentor answer

“API3 is our oracle infrastructure and the Airnode is our signed data source. Cardano does not need to communicate with API3's EVM contracts or Base Sepolia. The response is signed off-chain; we put its proof in a Cardano spending transaction. Aiken checks the signature, pinned request, time limits and threshold, then requires payment to the agreed beneficiary. Reference inputs are useful for shared on-chain feeds, but our pull proof needs no feed UTxO. We still trust the chosen signer and upstream facts, and need a keeper/data source available before the deadline. A signature proves what was reported, not whether likes are genuine.”

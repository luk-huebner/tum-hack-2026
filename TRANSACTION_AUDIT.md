# Transaction audit — independently retrieved ledger evidence

## Findings

56 Cardano Preprod transactions were retrieved from public Koios `tx_info`, cross-linked through paginated `address_txs` for both script addresses and both base/enterprise forms of the known buyer/seller keys. Every retrieved hash has a block hash, height and timestamp. The exact response and retrieval time are retained in `audit-evidence/koios-transactions.json` and `collection.json`; normalized records are in `transaction-history.json`.

- 27 lock transactions created 36 escrow outputs.
- 19 releases: all independently checked beneficiary outputs meet the version-specific required ADA amount.
- 7 refunds: actual outputs and fees are retained. Refund authorization does not impose an output destination in the validator.
- 3 other wallet transactions: initial wallet funding and two x402 payments.
- 10 outputs remain unspent in a separate `address_utxos` query: 8 v1 outputs / 40 tADA; 2 v2 judge-bench outputs / 10 tADA. See `current-script-utxos.json`.
- All 26 script spends report valid contracts. Returned bytecode matches the correct archived/current blueprint exactly (10 v1 spends, 16 v2 spends).
- None of the 56 transactions has transaction metadata. Datums and spending redeemers do exist; absence of metadata is not absence of contract evidence.

The only chain transaction newly discovered outside the local full-hash inventory is initial wallet funding:
[`febdcf46f006a0b27d9ed4b9404c57af553f06a6faaa60d1343d8e052b8b6004`](https://preprod.cardanoscan.io/transaction/febdcf46f006a0b27d9ed4b9404c57af553f06a6faaa60d1343d8e052b8b6004), block 5352986. No claim is made that its source wallet is owned by the team or that all other team wallets are known.

## Discrepancies resolved by ledger inputs

| Local claim / incident | Ledger finding |
|---|---|
| `keeper-log-run1.jsonl` says `on-chain-rejected` | `7105a4fa…167f8e` is confirmed in block 5353121; consumes `247dad32…12476#0`, pays 5 tADA to the intended beneficiary, fee 285870 lovelace. Confirmation transport failure was not rejection. |
| HTTP 402 after first hardening-run funding | `19f87c81…18886#0` exists and is consumed by `b670ff12…a6a89` in block 5353795. Local HTTP failure did not cancel settlement. |
| HTTP 402 after static-rainfall funding | `fe03961f…eda38#0` exists; refund `20e884e9…0afd5` consumes it in block 5353872. |
| Campaign payment appeared failed after service interruption | `fb6f91ec…a758#0` is consumed by `3f22b345…426a3`, block 5354250; beneficiary output is the buyer's key, not seller's. |
| Retention payments reported HTTP 402 | `db837990…38e2c#0` and `bca39a39…16886#0` are real. Their refund matches are reconstructed by input refs in JSON, not inferred from documentation order. |
| Keeper restarted while release in flight | Chain shows a single spend per escrow. Failed re-evaluation of an already spent input is not another on-chain transaction. |
| Judge bench disappeared | Old v2 bench `53521b16…b725d#0/#1` was released by `346e7c49…09003` and `0693dbca…0a8c0`. Replacement bench is `40351784…f15bc#0/#1`, still unspent at snapshot. |
| Old documents mix test totals and platform status | 39/55/65/73/78 are snapshots; freshly run current total is 78. Earlier “not tested” statements are superseded only by later specific evidence, not generalized to all platforms. |

Full hashes, real explorer URLs and every ordinary input/output are in `TRANSACTION_HISTORY.md` and JSON. Short hashes above are labels only.

## Evidence categories

| Category | How treated |
|---|---|
| Confirmed Cardano transactions | 56 records, independently retrieved from Koios |
| Submitted but unconfirmed | No such known Cardano hash identified in this snapshot; not a claim about unknown/missing logs |
| Failed/rejected submission | Local error retained as an event; no fabricated ledger record |
| Built but never submitted | Evaluation/control/attack cases, not confirmed chain transactions |
| Script-evaluation failure | No transaction hash or inclusion invented; does not prove the node processed an on-chain failure |
| Dry run / monitoring | Off-chain behavior; JSONL timestamps and value samples are not ledger evidence |
| Signed API responses | Oracle proof/vector data; a request hash or ECDSA scalar is not a transaction hash |
| Base Sepolia API payment/faucet | Separately listed receipts, not independently EVM-confirmed in this review and never counted among Cardano transactions |

The hash inventory intentionally queries all full 32-byte candidates, including request hashes and test fixtures. Nonmatches are retained as unresolved *candidates*, not described as missing Cardano transactions. No claimed Cardano full transaction hash in the local evidence remained unresolved. Abbreviations alone cannot be queried; some were resolved from full references in logs or chain inputs.

## Explorer visibility and API fallback

Cardanoscan's transaction URL format is correct for the verified hashes. Its HTML request returned a Cloudflare “Just a moment” challenge, so this review **cannot attest to which UI panels currently render**. Public web retrieval also failed. Blockfrost requires a project ID; none was supplied. Koios worked without credentials. Thus ledger findings are independent of local documentation, but are not corroborated by two independent successful providers.

| Judge question | On-chain / API evidence available | Cardanoscan UI validation |
|---|---|---|
| Original locked funds | Lock outputs: script address, amount, index | Not observed due to challenge |
| Script address/version | Output payment credential and spending script hash/bytecode | Not observed |
| Inline datum | Raw CBOR and decoded fields in Koios outputs/inputs | Not observed |
| Spending transaction | Match `inputs[].tx_hash/tx_index` to lock output | Not observed |
| Redeemer / execution units | `plutus_contracts[].input.redeemer`, memory and steps | Not observed |
| Beneficiary paid | Compare decoded datum field 13 to output payment credential and amount | Not observed |
| Funding → release/refund | Exact UTxO edges in machine-readable report | Not observed |
| Metadata | Null on all historical records | No historical metadata to render |

Wallet visibility: standard release builder sends an enterprise address with the same payment key as the beneficiary's base address. A wallet watching only base addresses can miss that balance. Compare credentials, not just the full address string. This is distinct from missing payment or indexing failure.

Optional future metadata is implemented only for shared release and CLI refund builders, off by default. It is descriptive; it neither changes validity nor repairs history. See `CODE_AND_SECURITY_REVIEW.md`. No new transaction was sent to demonstrate it.

## Reproduce without paying

```
python audit-evidence/collect.py
python audit-evidence/report-history.py
# Inspect one response directly (read only):
curl -sS https://preprod.koios.rest/api/v1/tx_info \
  -H 'Content-Type: application/json' \
  -d '{"_tx_hashes":["e3d03ef789985374587412cb459b0db441623ff770bd03006583da302ece5e67"],"_inputs":true,"_scripts":true,"_metadata":true,"_bytecode":true}'
```

Collector scope is the supplied repository and approved known public addresses only. It never reads environment secrets or sends a transaction. Regenerated reports describe a later snapshot; retain the included evidence for this audit's conclusions. Provider history is not an independently validated Cardano node and confirmation counts can change/reorg; we report inclusion at retrieval time.

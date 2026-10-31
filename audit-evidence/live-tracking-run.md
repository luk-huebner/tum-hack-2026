# Live run of the tracking code (31 Oct 2026, 07:10 to 07:20 UTC, Cardano preprod)

Run by the Pay-on-Proof team on the branch `night/audit2` with the second audit's code. Free data only (Nodary ETH/USD): no aUSD was spent. Two escrows of 5 tADA through the x402 route, the keeper on, one refund with `CREATORPAY_METADATA=1`. The raw journal is `live-tracking-journal.jsonl` (30 lines for 4 transactions).

| Step | Transaction | What the journal recorded | What Koios shows |
|---|---|---|---|
| Lock B (rule cannot hold: ETH/USD at least 999999) | `5b7111580a276c017f460c47da3811f0e12125778ab72a99c6976194d6bfa216` | hash written at 07:10:46 as `unknown`, "Signed for facilitator", **before** the facilitator received it; `submitted` and `confirmed` at 07:11:34, block 5356208 | block 5356208 |
| Lock A (rule holds now: ETH/USD at least 1) | `5499a12e20f35e41dbcdc581eb4d145225141f090b9512dac871ae64763021d3` | same sequence, confirmed in block 5356211 | block 5356211 |
| Release of A by the keeper | `80a971f4f5b6b774962ea5040c244935a9a7287b0002d7317d5e49415441bad6` | `built`, `unknown` (submission starting), `submitted`, several `unknown` ("no confirmation observed") while waiting, then `confirmed` block 5356215, operation `release`, escrow ref `5499a12e20…#0` | block 5356215, fee 325,441 lovelace, 5,000,000 lovelace to the seller key |
| Refund of B, metadata on | `e686999857f8be6b3a0c314bf4432c689f4d2aebcca400a8f62d289fbaf5021b` | `built`, `unknown`, `submitted`, polls, `confirmed` block 5356224, operation `refund`, escrow ref `5b7111580a…#0` | block 5356224, fee 288,743 lovelace, 4,711,257 lovelace to the buyer key; **metadata label 674** with the five expected lines (CreatorPay, Action: Refund, Network: Cardano Preprod, Validator:, the script hash) |

The keeper's own log is consistent: it found both escrows, saw the free price satisfy A (2243.83 against 1), released it at 07:13:21 and logged `spent-on-chain` at 07:14:19; B was watched and never released.

## What this shows

The write-ahead journal works on the real SDK objects for a x402 lock, a keeper release and a CLI refund; its final states agree with the ledger in all four transactions; the optional CIP-20 metadata lands on chain as designed and costs a few thousand lovelace more.

## What it does not show

- The failure paths: a lost reply, a slow settlement answered as HTTP 402, a keeper restarted in the middle of a release, a provider outage. These were covered by the audit's six offline tests only.
- The other tracked scripts (`buyer.ts`, `keep-client.ts`, `creator-demo.ts`, `engine-demo.ts`, `judge.ts`, `live.ts`, `demo-run.ts`, the service's `/api/keep` route).
- Two side effects seen: after `submitted`, each poll before confirmation writes `unknown`, so a transaction's states can go back and forth; and the journal grows by about seven lines per transaction.

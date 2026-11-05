# Restoring the public Verify benchmark

The previous standing policies expired on 31 October 2026 at 20:00 UTC. The control response was signed on 30 October; its 48-hour allowance had also elapsed. The public page consequently returned EXPIRED for all six cases. This was a backend precheck, not a validator rejection. Starting the migrated backend alone did not restore this feature.

## Replacement receipts

- Cardano Preprod lock: https://preprod.cardanoscan.io/transaction/32bec362059be23a69f13345f78ee66853965adf261a62e7a60fd9edc555da8d
- Two outputs, indices 0 and 1: 5 test ADA each. Confirmed fee: 195465 lovelace (0.195465 test ADA). Total 10.195465 test ADA, within the explicitly authorized 11-test-ADA limit. Buyer key is both beneficiary and refund key, so the ordinary seller keeper does not release the fixtures.
- New deadline: 5 December 2026, 17:18:33.552 UTC. Age limits remain 48 hours and 5 minutes. No validator rules were loosened.
- Control Open-Meteo response signed 5 November 2026, 17:14:33 UTC; payment: https://sepolia.basescan.org/tx/0x7894f96e904565388631e1424989acf3c11641d14f25d50e64b9f97ce3812e47
- Different-request response signed 5 November 2026, 17:15:05 UTC, same Airnode and same projection with latitude 48.15 instead of 48.14; payment: https://sepolia.basescan.org/tx/0xe22d9ef566efc6891a0d733be1f112834741661a4d4ed8f9f985a54660ce7d9c
- Each response cost 0.1 test aUSD on Base Sepolia, for the authorized total of 0.2 test aUSD. No mainnet or real-money purchases.

## Why the stale case has a separate file

Refreshing valid.json would make a recently signed response acceptable to the 5-minute policy. The stale case therefore uses stale.json: a separately preserved genuine old signature for the same request. The different-request case now uses a recent response from the SAME Airnode, avoiding an unrelated signer or old age as a competing reason for rejection. The numeric edit keeps the original signature; the foreign-signer case keeps the real request, timestamp and data and signs with a throwaway key held only in memory.

The frontend recognizes EXPIRED, shows that evaluation did not happen, and displays when the control evidence and test contracts need renewal. GET /api/policies now labels an unspent expired policy as expired rather than open.

## Validation and continuing maintenance

Five offline signature-integrity tests pass, covering the control and each tamper condition. Backend TypeScript checking and the frontend production build pass. The actual public Verify page was run in Chrome on 5 November after fixture activation: **6/6 verdicts as expected**, in order ACCEPTED, REJECTED, REJECTED, REJECTED, REJECTED, ACCEPTED. The first and last controls demonstrate that rejected cases did not consume the escrow. These requests only evaluated unsigned transactions; no release was submitted by the benchmark.

The control evidence must be refreshed before **7 November 2026, 17:14:33 UTC (18:14:33 Berlin)** to retain an accepting live control. The API now exposes this deadline and the UI displays it. No recurring paid refresh is authorized by this one-off repair's spending envelope, so none is scheduled. A maintained live bench needs a separately agreed recurring test-data allowance or a clearly labelled historical replay mode. Stored historical evidence must never be relabelled as fresh or given a fabricated signature time.

Future renewal must also refresh the different-request receipt and regenerate both tampered cases, preserve a genuinely stale signed sample, verify signer/request/template, and verify actual node evaluation. A payment timeout is not evidence of nonpayment. A chain submission timeout is not evidence of rejection: reconcile its existing hash before attempting any new transaction. Do not rerun the old engine-demo.ts bench command: it still contains a hardcoded October deadline.

No wallet seeds, private keys, configuration, host logs or private campaign data are included in these receipts.

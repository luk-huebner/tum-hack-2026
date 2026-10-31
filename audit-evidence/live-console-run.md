# Live run of the console path with the tracking code (31 Oct 2026, 07:36 to 08:35 UTC, Cardano preprod)

Run by the Pay-on-Proof team on the branch `night/audit2`, after the first live run (`live-tracking-run.md`) had covered the command-line clients. This one drives the **console's "Run it live" panel** (`POST /api/demo/run`, `DEMO_BUYER=1`, keeper on), which is the path a judge at the booth would use. Free data only (Nodary ETH/USD): no aUSD was spent. Raw journal: `live-console-journal.jsonl` (30 lines for 4 transactions; the last two lines are the one-off reconcile of the two lock rows).

| Run | Transaction | What the journal recorded | What Koios shows |
|---|---|---|---|
| Release run, lock (rule holds now: ETH/USD at least 1) | `6eb9c64c15e1d6f0eb7b1579123d345f99d4b707d92bd61886b410c92b6ed833` | written at 07:36:45 as `unknown` ("Signed for facilitator"), **never updated by the service**: the console had been answered with HTTP 402 and found the escrow by its datum | block 5356270, fee 178,393 lovelace |
| Release run, release by the keeper | `9f7f9788e9e71499a97a3893131203a2ca8b04411dd40e221c0a25aa71ed74e0` | `built`, `unknown`, `submitted`, then `confirmed` block 5356272, operation `release`, escrow ref `6eb9c64c15…#0` | block 5356272, fee 326,000 lovelace |
| Refund run, lock (rule cannot hold: ETH/USD at least 999999) | `6b303744d42a287c08468bbb0d8591668461e097ddc999a1814c572f8fde6cff` | written at 08:23:00 as `unknown`, **never updated by the service**: this time the payment answered HTTP 200 and the console never asked the chain about it | block 5356395, fee 178,569 lovelace |
| Refund run, refund by the buyer key (6 minutes after the deadline was set; an early refund was refused by the contract first) | `842c82c0952b6b996cf6b3a0f30d77309a994263db27a812b4253ac29f5d9dc4` | `built`, `unknown`, `submitted`, `confirmed` block 5356414, operation `refund`, escrow ref `6b303744d4…#0` | block 5356414, fee 281,263 lovelace |

## What this found

The two **lock** rows stayed `unknown` after the escrow had landed. The signer inside the x402 client only knows that it signed a transaction for the facilitator; the service's journal had no step that asked the chain afterwards. Release and refund rows were fine, because the keeper and the refund code use `submitTracked`, which reconciles.

Two patches (commit `c24164f`): the console run (`demo-run.ts`) now reconciles the payment transaction as soon as the escrow is seen at the contract, on both the HTTP 200 and the HTTP 402 path; the x402 escrow client (`escrow-client.ts`) does the same on its dropped-connection and HTTP 402 paths.

## What was and was not re-run after the patches

- The first patch covered only the HTTP 402 branch. The refund run ran with that patch and took the HTTP 200 branch, so its lock row was still `unknown`; that is how the gap in the other branch was found, and the patch was moved so that it covers both.
- The two stale lock rows were then reconciled once with a small script that calls `reconcile()` on every `unknown` row (read-only on chain). Both turned `confirmed` in the blocks above, which matches Koios. This shows that `reconcile()` is right for a landed lock; it does not show the console doing it by itself.
- **The final form of the console patch (one `reconcile` call after both branches) type-checks and passed CI, but no third live run was made.** It is one call on a path that already worked for the release and refund rows.

## What it still does not show

- The failure paths: a lost reply, a keeper restarted in the middle of a release, a provider outage. These were covered by the audit's six offline tests only.
- The other tracked scripts (`buyer.ts`, `keep-client.ts`, `creator-demo.ts`, `engine-demo.ts`, `judge.ts`, `live.ts`, the service's `/api/keep` route).
- Real aUSD fetch paths: the data was the free Nodary feed.

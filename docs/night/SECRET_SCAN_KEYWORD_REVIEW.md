# Job A continuation: manual keyword inventory review

Authorized continuation start: 2026-10-31 01:47:58 CET. Limit: 15 minutes, ending no later than 02:02:58 CET. Review/report end: 2026-10-31 01:48:26 CET. Commit and push follow immediately; delivery records their completion. This continuation is later than the original job window and is not backdated.

The account-wide usage checkpoint showed 182.2479545 credits before this review phase, above the owner's soft checkpoint of 170. This is neither euros nor a per-job cost measurement.

Reviewed every one of the 128 entries in the existing sanitized non-Markdown keyword lens, in inventory order. The table identifies each reviewed file version by file, line and commit. Of these, 120 expose only name/call/comment structure, and eight suppress the entire data/config context. The visible structures concern environment references, wallet/seed generation and handling, public-address derivation, provider names, API configuration, error handling, imports and documentation. No actual credential value was visible in this review. No detector, repository application, generator, provider validation or transaction was run.

This review cannot certify hidden literal contents. Sanitization removes quoted strings and long opaque tokens, including potentially relevant environment variable names and interpolations. Eight entirely suppressed contexts cannot be classified from this inventory. Markdown keyword hits were excluded by the original lens generator and were not manually classified in this continuation. The original 459 distinct blob/line hits and the exact-term grep's 141 distinct path/line-text pairs have different deduplication/filtering rules; 128 must not be subtracted from either to claim an exact remaining count. Mapping every underlying duplicate/version and inspecting hidden literals remains **not verified**. A complete every-hit manual clearance is therefore still **not verified**.

The earlier Gitleaks candidate remains a documented transaction identifier under local comparison, with no credential validity claim:

| File | Line | Commit | Kind |
|---|---:|---|---|
| PROOFS.md | 246 | 594379561d5f6fab22a85b4b57c6b126e24994d0 | generic-api-key false positive: documented transaction identifier, local comparison |

No additional secret false positive can be conclusively classified from hidden contents. TruffleHog credential validity remains **not verified**. The previous detector evidence and limitations in SECRET_SCAN.md remain applicable. The review table contains metadata only, no matched lines, snippets, values or secret fingerprints.

## Exact reviewed inventory

| File | Line | Commit | Kind |
|---|---:|---|---|
| .env.example | 2 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | entire data/config context suppressed; content not verified |
| cardano/.env.example | 13 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | entire data/config context suppressed; content not verified |
| cardano/.env.example | 14 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | entire data/config context suppressed; content not verified |
| cardano/.env.example | 15 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | entire data/config context suppressed; content not verified |
| cardano/out/autorelease-log-e2-run2.jsonl | 28 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | entire data/config context suppressed; content not verified |
| cardano/out/autorelease-log-e2-run2.jsonl | 30 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | entire data/config context suppressed; content not verified |
| cardano/out/autorelease-log-tranches.jsonl | 9 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | entire data/config context suppressed; content not verified |
| cardano/src/attacks.ts | 6 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/attacks.ts | 23 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/attacks.ts | 24 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/attacks.ts | 105 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/buyer.ts | 16 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/buyer.ts | 17 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/buyer.ts | 20 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/buyer.ts | 21 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/buyer.ts | 24 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/buyer.ts | 25 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/buyer.ts | 36 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/buyer.ts | 38 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/creator-demo.ts | 40 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/demo-run.ts | 7 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/demo-run.ts | 99 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/demo-run.ts | 128 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/demo-run.ts | 130 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/engine-demo.ts | 40 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/engine-demo.ts | 85 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/engine-demo.ts | 87 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/engine-demo.ts | 90 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/engine-demo.ts | 103 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/engine.ts | 3 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/engine.ts | 107 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/engine.ts | 115 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/engine.ts | 117 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/engine.ts | 118 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/engine.ts | 210 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/engine.ts | 217 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/engine.ts | 234 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/escrow-client.ts | 16 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/escrow-client.ts | 58 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/escrow-client.ts | 114 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/escrow-client.ts | 116 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/escrow-client.ts | 167 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/escrow-client.ts | 179 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/escrow-client.ts | 188 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/facilitator.ts | 19 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/facilitator.ts | 21 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/facilitator.ts | 26 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/facilitator.ts | 27 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/facilitator.ts | 31 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/facilitator.ts | 96 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/judge-site.ts | 5 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/judge-site.ts | 9 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/judge-site.ts | 24 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/judge-site.ts | 29 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/judge.ts | 11 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/judge.ts | 25 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/keep-client.ts | 7 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/keep-client.ts | 53 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/keep-client.ts | 54 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/keep-client.ts | 65 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/keep-client.ts | 67 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/keeper.ts | 73 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/live.ts | 43 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/live.ts | 47 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/mcp-server.ts | 47 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/proof.ts | 220 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/refund.ts | 8 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/refund.ts | 24 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/register-source.ts | 17 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/service.ts | 17 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/service.ts | 66 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallet.ts | 3 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallet.ts | 5 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallet.ts | 6 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallet.ts | 8 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallet.ts | 9 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallet.ts | 12 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallet.ts | 14 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallets.ts | 2 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallets.ts | 3 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallets.ts | 4 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallets.ts | 7 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallets.ts | 8 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallets.ts | 16 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallets.ts | 18 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallets.ts | 19 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallets.ts | 20 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallets.ts | 22 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallets.ts | 23 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallets.ts | 26 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallets.ts | 29 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallets.ts | 30 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/wallets.ts | 34 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/web/llms.txt | 26 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | entire data/config context suppressed; content not verified |
| checks/01-vector.mjs | 55 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/01-vector.mjs | 58 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/02-new-wallet.mjs | 3 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/02-new-wallet.mjs | 6 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/02-new-wallet.mjs | 10 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/02-new-wallet.mjs | 13 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/02-new-wallet.mjs | 15 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/02-new-wallet.mjs | 16 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/02-new-wallet.mjs | 17 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/02-new-wallet.mjs | 18 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/03-balances.mjs | 4 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/03-balances.mjs | 14 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/03-balances.mjs | 15 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/03-balances.mjs | 16 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/04-mint-ausd.mjs | 6 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/04-mint-ausd.mjs | 17 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/04-mint-ausd.mjs | 18 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/04-mint-ausd.mjs | 19 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/06-tamper-files.mjs | 10 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/06-tamper-files.mjs | 31 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/10-paid-call.ts | 2 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/10-paid-call.ts | 13 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/10-paid-call.ts | 118 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/10-paid-call.ts | 129 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/10-paid-call.ts | 132 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/20-like-speed.ts | 5 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/20-like-speed.ts | 21 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| checks/20-like-speed.ts | 22 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| lib/x402.ts | 4 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| lib/x402.ts | 20 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| lib/x402.ts | 22 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/engine.ts | 206 | 61c684897b09497380b62ab8d6bdcc7962f5eb65 | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/engine.ts | 193 | 7d67fed973ce68688f7bc71db83753fe4cb21c34 | sanitized name/call/comment structure reviewed; hidden literal content not verified |
| cardano/src/engine.ts | 206 | 7d67fed973ce68688f7bc71db83753fe4cb21c34 | sanitized name/call/comment structure reviewed; hidden literal content not verified |

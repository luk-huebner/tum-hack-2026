# Changes and delivery contents

Core validator, all Aiken tests, and both committed blueprints are unchanged. Current blueprint was rebuilt and matched exactly. No transactions, paid calls, faucets or deployments were performed.

## Modified source files

| File | Change / reason |
|---|---|
| `cardano/src/engine.ts` | Confirmation wait records independent chain observation, including final timeout reconciliation |
| `cardano/src/proof.ts` | Optional descriptive metadata on shared release builder |
| `cardano/src/autorelease.ts` | Tracked submission, durable pending lookup, correct uncertainty about disappearing UTxO |
| `cardano/src/keeper.ts` | Track lock/release; stop labelling generic exceptions as on-chain rejection |
| `cardano/src/escrow-client.ts` | Journal signed payment hash before handoff; recover any transport failure; unknown rather than “not charged”; validate receipt hash |
| `cardano/src/creator-campaign.ts` | Propagate non-sensitive campaign identifier to child funding processes |
| `cardano/src/buyer.ts` | Journal facilitator-payment hash before handoff |
| `cardano/src/keep-client.ts` | Same for paid keeper request |
| `cardano/src/demo-run.ts` | Track facilitator funding and direct refund; fix false “nothing charged” claim |
| `cardano/src/creator-demo.ts` | Track direct lock/release |
| `cardano/src/engine-demo.ts` | Track all four direct submission branches |
| `cardano/src/judge.ts` | Track benchmark funding |
| `cardano/src/live.ts` | Track direct funding/release |
| `cardano/src/refund.ts` | Track refund; optional descriptive metadata |
| `cardano/src/service.ts` | Track service release submission |

## Added code and evidence

- `cardano/src/tx-tracking.ts`: shared write-ahead journal, chain reconciliation and retry suppression. `TRANSACTION_LOG` optionally selects the journal; otherwise `cardano/out/transactions.jsonl`. No global campaign-funding idempotency or multi-process coordination is claimed.
- `cardano/src/tx-metadata.ts`: opt-in CIP-20 messages, no private/campaign content on-chain.
- `cardano/src/history.ts`: read-only query/filter by transaction, escrow or campaign; `--archive` reads verified audit snapshot.
- `cardano/scripts/tracking-test.ts`: six deterministic fault/confirmation/metadata tests, no live submission.
- `audit-evidence/collect.py`: read-only local hash inventory, public-address history and transaction data collector.
- `audit-evidence/report-history.py`: reconstructs escrow edges, verifies beneficiary ADA payouts and generates chronological/JSON reports.
- `audit-evidence/*.json`, `*.txt`: raw public chain observations and test results. `creatorpay-audit.patch` contains source changes and the four new TypeScript files; reports/evidence are included directly in the archive.

## Requested deliverables

- `ORACLE_ARCHITECTURE.md`
- `CODE_AND_SECURITY_REVIEW.md`
- `TRANSACTION_HISTORY.md`
- `transaction-history.json`
- `TRANSACTION_AUDIT.md`
- `JUDGE_DEMO.md` (flow status, safe historical demonstration and mentor explanation)
- This file, the patch, and reproducible evidence.

## Final validation

78 Aiken tests pass; source rebuild equals committed v2 bytecode; all observed script bytecode matches its respective v1/v2 blueprint. TypeScript type checking passes after edits. 54 dishonest-offer checks pass; Masumi's 23-check stand-in suite passes; signature-vector script and polling simulation execute; six new tracking tests pass. Archive history command returns the requested verified record. MCP test was blocked before checks by tsx IPC EPERM; fresh paid/live submission tests were intentionally not run. See the review for exact commands and limits.

56 chain-confirmed transactions, 36 escrow outputs, 19 correct release payouts, 7 refunds, 10 separately observed unspent outputs. Ledger source is Koios; Cardanoscan HTML hit a challenge and Blockfrost credentials were unavailable. Base receipts remain unverified separately. The changes still require an explicitly approved future testnet run to validate real submission recovery and metadata end to end.

## Presentation slide

`presentation/CreatorPay-architecture-slide.pptx` is the editable 16:9 English architecture diagram with funding, signed API response, keeper delivery and independent Cardano verification. It was added after the code audit and does not change the validator or transaction history.

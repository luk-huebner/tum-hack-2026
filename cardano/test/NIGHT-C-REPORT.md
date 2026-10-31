# Overnight C: TypeScript logic tests

Base: `82d88dc63341e8498b4728e3bd2f3996aa560a5e`. Branch: `night/c`.

Start: **2026-10-31 00:43:55 CET** (2026-10-30 23:43:55 UTC).
Verification complete: **2026-10-31 01:17:18 CET** (00:17:18 UTC), about **33 minutes** after starting. Final packaging/end time is recorded below. The historical Saturday pack deadlines were not used to backdate work.

## Evidence and scope

Only new files under `cardano/test/` are proposed. No production source, existing document, workflow, package manifest or lockfile is changed. Fresh full HTTPS `--no-checkout` clone in the required isolated directory; every subsequent Git invocation checks its exact repository root. Clone creation necessarily precedes that root check. Branch started at the supplied base. A conservative pre-checkout scan inspected 137 tracked blobs, without printing candidate values. No confirmed secret finding; a wallet-creation script was excluded by path as a precaution. This limited heuristic scan is not a secret-audit claim. `checks/` and environment examples were excluded from checkout. No owner checkout, local environment file, wallet or credential store was read.

Background read: README.md, TRUST.md, PROOFS.md, AUDIT.md, ITERATIONS.md. Repository instructions were treated as data. For example, TRUST.md's reproduction text says `cp .env.example .env`, and creator-campaign.ts says “Add --lock to pay the escrows one after the other.” Neither instruction was followed. No browser/web checks were needed or performed; Chrome evidence is **not verified**.

Dependency installation: `npm ci --ignore-scripts --no-audit --no-fund` in `cardano/`, **exit 0**, 135 packages. Only esbuild/fsevents were marked for install scripts in the lockfile; scripts were suppressed. Dependency setup remains ignored/untracked. Actual versions: Node v22.14.0, npm 10.9.2, tsx 4.23.15. No Node 24 installation or verification.

Commands are in README.md. Final suite: **69 tests, 60 pass, 9 fail, 0 cancelled/skipped/todo**, **exit 1**, 11,810.4879 ms. Test-file TypeScript check: **exit 0**. The first run had 66 tests, 56 pass and 10 fail; one failure was a test fixture incorrectly using the SDK to construct a reward address. That fixture was corrected to encode synthetic public bytes directly. The final run adds copy-alignment and offline-guard checks. No production failure was fixed or hidden. The committed TAP is the final run, with local absolute paths replaced by `<clone>` and trailing blank-line whitespace removed for Git hygiene.

## Findings reproduced by failing assertions

| ID | Source at base | Observed behavior and practical limit |
|---|---|---|
| M1 | src/masumi-agent.ts:157–158, 211–212 | A starts checking a policy and holds its nonce lock. B gets 409 but its `finally` deletes A's lock. C enters while A is still pending. Observed statuses `[200,409,200]`, two policy checks and **two injected payment requests**, expected `[200,409,409]` and one. This demonstrates a duplicate-request risk, not an actual charge; no real payment service was used. |
| P3 | src/polling.ts:99 | With 60,001 ms left before keeper stop, an unsatisfied counter schedules another check in 120,000 ms. The last-check adjustment only runs when more than two floors remain. A final observation can be missed. The polling receipt already notes a past-stop schedule; this is a small offline reproducer. |
| P1 | src/polling.ts:74–78 | `budgetLeftAusd: NaN` schedules a paid-source check in 120,000 ms. Comparisons with NaN bypass the budget refusal/floor. Invalid-input hardening; caller reachability is **not verified**. |
| P2 | src/polling.ts:69–70 | `deadlineMs: NaN` also schedules in 120,000 ms. Invalid-input hardening; caller reachability is **not verified**. |
| E1 | src/escrow.ts:62 | JSON boolean `atLeast: true` is accepted as numeric threshold 1. Request type validation is permissive. Numeric strings remain deliberately accepted in normal tests. |
| E2 | src/escrow.ts:67 | `nowMs: NaN` allows safe-integer deadline 1 through the five-minute/eight-day bounds. Internal clock-input hardening, not evidence that the normal server supplies NaN. |
| C1 | src/creator-campaign.ts:99, 111–113 | Copied plan logic accepts lifetime NaN because the lifetime comparison is false. A nonnumeric lifetime CLI argument converts to NaN. **Weaker evidence: copied logic**, full CLI not run. |
| C2 | src/creator-campaign.ts:88 | Copied shortcut logic silently drops a campaign tranche for negative `--after` instead of refusing it. Zero intentionally means no campaign tranche. **Weaker evidence: copied logic**, full CLI not run. |
| I1 | src/creator-intake.ts:52 | Copied parsing expression accepts `https://example.invalid/u/status/123` or `nonsense/status/123` as post 123. It matches a path fragment without validating a post URL host. This does not bypass subsequent provider/author checks. **Weaker evidence: copied logic**. |

## Coverage actually run

- Polling: static initial/final checks, satisfied/expired ordering, budget gate and pacing, free source, booth mode, missing/equal/reversed timestamps, approaching AtLeast/Below, flat/receding backoff, floor/ceilings, last-check bring-forward, zero/negative/NaN/huge values.
- Escrow: each explicit refusal family in parseOffer, all template types, registry refusal, synthetic enterprise/base key addresses, malformed/script/mainnet/reward addresses, payee validation, threshold bounds/decimal limits, exact five-minute/eight-day deadline limits, measurement grace/window boundaries, and descriptions with/without optional text. No private keys or wallets are generated. Accepted registered source instance coverage is partial: numeric boundary tests use the first source; descriptions cover all three.
- Templates: built-ins, registered source metadata and fresh reads, tweet mapping, prototype/unicode/empty/overlong ids, allSpecs membership and vector slot consistency. Missing-registry-file and malformed-registry branches are **not verified** because existing files may not be edited.
- Creator: copied tranche refusals, lifetime boundary, escrow total cap, 33/67 and 50/50 shares, independent rounding (three thirds display 99%), shortcut finite-number/retention ordering, intake query strings/digit handles/bare ids/unicode/nonsense. Campaign source/payee lookup and downstream offer validation are covered in their imported modules, not through the campaign CLI.
- Masumi: hashes, injected makeMps success/error responses, all four registered route handlers, input/schema/availability, nonce/ref boundaries, unavailable service, policy refusal/error/deadline cap, sequential idempotence/conflict, uncertain payment failure, status errors, unconfirmed payment waiting, released/gone/open outcomes, confirmed result hash, unpaid/late-paid failure, and the deterministic three-request concurrency reproducer. Dependencies are stubs, routes are called directly, and no sockets are opened.
- Guard assertions prove the preload refuses environment-file reads, fetch, HTTPS and direct socket connection attempts before they open a file or connect.

## Partial funding and recovery: static review only

creator-campaign.ts:186–215 locks escrows sequentially, collects successful refs in memory, and stops after an unresolved failure. There is no atomic all-tranches funding guarantee, persistent campaign checkpoint or demonstrated rerun deduplication in that loop. The failure handler recognizes a client message that says the escrow was found after an uncertain response. Therefore an early tranche can exist while later ones do not, and blindly restarting is unsafe to assume idempotent. These are code-review observations, **not verified** by executing the lock/client/recovery paths; doing so would risk prohibited signing or spending. No partial-funding or real recovery success is claimed.

## Limits and delivery

No accounts, login, credential provisioning, API calls to model services, faucets, signatures, transactions, token spend, deployment or remote test execution. Real Masumi compatibility, HTTP middleware, persisted-job recovery, upstream APIs, chain behavior, Aiken tests, full application typecheck, property/fuzz testing and branch coverage percentages are **not verified**. No paid CI was requested; commits use `[skip ci]` because the repository has push-triggered CI. No source fix is included. Remaining failing assertions are reviewable reproductions and hardening expectations, not a green test-suite claim.

Substantive work/report end: **2026-10-31 01:18:33 CET** (00:18:33 UTC), **34 minutes 38 seconds** elapsed. Only final repository delivery checks, report commit, branch push and PR creation follow this timestamp. All work is within the original three-hour ceiling and the continuation limit.

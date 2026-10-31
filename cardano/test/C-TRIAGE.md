# C follow-up: triage of the nine failing assertions

Continuation start: **2026-10-31 01:47:24 CET** (00:47:24 UTC).
Authorized limit: **35 additional minutes**, ending no later than **02:22:24 CET**.
Original base: `82d88dc63341e8498b4728e3bd2f3996aa560a5e`.
Reviewed PR: https://github.com/luk-huebner/tum-hack-2026/pull/6, existing head `ed911f987a50824847d69d4572aacad971f95e13`.

Usage check before this phase: shared account balance **189.0122025 Codex credits**, above the owner's 170-credit checkpoint. Included ordinary allowance was exhausted. No credits were purchased. These are account credits, not euros or job-local costs.

## Conclusion and evidence strength

The nine assertions are genuine failures in the saved TAP, but **they are not nine established production bugs**:

| Classification | IDs | Evidence |
|---|---|---|
| Confirmed implementation defects, with bounded impact | M1, P3 | Imported production functions; reproduced again in this continuation. M1 is an idempotency defect. P3 is a scheduling inconsistency, not evidence of spending after a deadline. |
| Request coercion that needs a contract decision | E1 | Imported parseOffer accepts a JSON boolean as 1. The assertion assumes stricter request types than the implementation explicitly enforces. |
| Defensive validation expectations, caller failure not established | P1, P2, E2 | Imported functions accept invalid internal numeric inputs. Prior TAP proves the behavior; normal runtime reachability is not established. |
| Copied-logic findings, not executed CLI findings | C1, C2, I1 | Copies and source alignment checks plus review of original branches. CLI and downstream outcomes are not verified. |

No remaining assertion was found to have the earlier reward-address fixture construction error; that error was already fixed before the saved 69-test run. The nine tests are unchanged. In particular, their `BUG` names should not be taken as severity or reachability determinations. E1 and the defensive-input tests encode a proposed stricter policy; a maintainer could choose to document the current contract instead. They have not been weakened or marked as expected failures.

Reviewed the existing test bodies, nine TAP failures, relevant source branches, polling caller, and parseOffer callers. No package installation, source execution with side effects, full-suite rerun or repetition of passing checks was needed. Existing full-run evidence remains **69 tests: 60 pass, 9 fail**, not a new full-suite result.

## Priority findings

### M1 — nonce lock released by a request that never acquired it

**Affected function:** `masumiRoutes`, POST `/start_job`, `src/masumi-agent.ts:135–158, 211–212`.

**Trigger:** A valid request A acquires `inflight` for its nonce and awaits `checkPolicy`. Identical request B sees the lock and returns 409. B nevertheless reaches the unconditional `finally` and deletes that same lock. Identical request C can enter while A is still awaiting its policy check. The test's shared promise gate deliberately holds both checks until after C has arrived; this is an ordinary asynchronous interleaving, not a thread timing guess.

**Expected:** statuses `[200,409,409]`, one policy check, one MPS payment-request invocation.
**Actual:** statuses `[200,409,200]`, two policy checks, **two injected MPS payment-request invocations**. Both the saved TAP and this continuation reproduce those exact counts.

**Impact:** the service's stated per-identifier idempotency guarantee fails. Two Job records can be created and the nonce lookup can end up pointing to the later one. A downstream payment service might itself deduplicate; real duplicate invoices, charges, wallet effects and persisted recovery are **not verified**. The test uses stub MPS functions and performs no payment. Direct handler invocation bypasses HTTP parsing, but executes the actual lock/check/finally code and includes real async awaits.

**Smallest proposed fix, not applied:** introduce a per-request `acquired` boolean, set it only immediately after `inflight.add(key)`, and delete the lock in `finally` only if that request acquired it. Keep acquisition before the first await. This does not solve multiple-process coordination; that remains outside the finding.

**Regression expectation:** the existing three-request gate test should pass with `[200,409,409]` and one payment request. Preserve the already observed sequential retry/conflicting-input behavior. Also check lock release after the owning request's policy refusal/error, without allowing a rejected duplicate to release it. Those additional cases were not rerun here.

### P3 — next paid check can be placed beyond keeper stop

**Affected function:** `planNext`, `src/polling.ts:67–104`, especially the bring-forward guard at line 99.

**Trigger:** unsatisfied paid counter; `now=600000`, `deadlineMs=840001`, `stopBeforeMs=180000`, cost 0.01, budget 100, latest sample `{at:600000,value:10}`, threshold 100, comparison AtLeast. Time left before keeper stop is **60001 ms**. There is only one sample, so the first-estimate delay is 120000 ms; pacing is approximately 6 ms and does not constrain it. The bring-forward guard requires more than 120000 ms remaining and is bypassed.

**Expected by the assertion:** either no further check (`null`) or a delay strictly below 60001 ms. The assertion does **not** require breaking the budget or polling floor to force a final check.
**Actual:** `delayMs=120000`, greater than the remaining 60001 ms, reproduced in both runs.

**Impact:** an affordable final observation can be missed, and the returned schedule is inconsistent with the keeper's stop boundary. The caller in `src/autorelease.ts:255–264` stores `at + delayMs` as the next check. This does **not** establish a transaction or data purchase after stop: the watcher has other filtering and stop logic, and no watcher/chain flow was executed. A past-stop delay can effectively mean no more observations. The old receipt already acknowledges that kind of schedule; this test isolates the boundary case.

**Smallest proposed fix, not applied:** after choosing the final delay, return `null` if it cannot fit strictly before `tLeft`, or bring it forward only when a feasible delay still respects the polling floor and budget pace. Do not blindly clamp below the budget floor. A minimal null guard satisfies the present assertion; adding a feasible final observation is a separate behavior improvement.

**Regression expectation:** existing 60001-ms case returns null or a feasible delay; cover exact 60000, 120000 and 120001-ms stop margins and a budget floor that makes any check infeasible. Preserve the normal last-check and budget-pacing behavior already tested. No new boundary tests were run in this continuation.

## Other imported-function failures

### P1 — invalid budget bypasses budget refusal

**Function:** `planNext`, `src/polling.ts:74–78`.
**Trigger:** the ordinary unsatisfied counter fixture with `budgetLeftAusd=NaN`.
**Expected/actual:** test expects null; saved TAP shows **120000 ms**. Both `NaN < cost` and `NaN > delay` are false.
**Impact/classification:** confirmed function-level non-finite-input behavior, **defensive hardening** rather than a demonstrated deployed cap bypass. JSON does not represent NaN; the watcher passes `ausdCap - spent`, and whether its configured inputs can become NaN was not established here.
**Smallest proposed fix:** validate budget finiteness/nonnegativity before paid-source budget arithmetic and fail closed with null. Decide explicitly whether invalid budgets should matter for free sources.
**Regression:** reject NaN for paid checks, retain zero/insufficient/adequate finite budgets and free-source behavior. Evidence: saved TAP only, not rerun.

### P2 — invalid deadline bypasses time refusal

**Function:** `planNext`, `src/polling.ts:69–70`.
**Trigger:** unsatisfied counter with `deadlineMs=NaN`.
**Expected/actual:** null versus **120000 ms** in saved TAP; `tLeft <= 0` is false for NaN.
**Impact/classification:** defensive validation of an internal typed numeric input. Normal chain-policy/clock corruption is **not verified**. It should not be presented as a remotely demonstrated deadline bypass.
**Smallest proposed fix:** require finite time operands and finite computed `tLeft` before scheduling. Define invalid input as no further check.
**Regression:** NaN/Infinity time inputs refuse, with finite exact-stop and valid-future cases preserved. Evidence: saved TAP only, not rerun.

### E1 — boolean threshold coerces to 1

**Function:** `parseOffer`, `src/escrow.ts:61–63`.
**Trigger:** otherwise valid request with `atLeast:true`.
**Expected/actual:** test expects an atLeast error; actual offer is accepted with **value 1** because `Number(true) === 1`.
**Impact/classification:** malformed JSON input can express a different rule than a caller might intend. The service forwards request bodies to parseOffer, so this is more than an impossible internal value, but numeric coercion is an explicit implementation choice and numeric strings are already accepted. **The test's prohibition of booleans needs an agreed input contract**, not a claim that JavaScript conversion is incorrect. No funds or on-chain policy were created.
**Smallest proposed fix if stricter input is intended:** before conversion, allow only numbers or nonblank numeric strings; reject booleans, arrays and objects. Keep finite, positive, scale and max checks.
**Regression:** true refuses; numeric 1 and string "1" remain accepted; false/null/blank/arrays/objects refuse. Evidence: saved TAP and source/caller review, not rerun.

### E2 — invalid supplied clock disables relative deadline bounds

**Function:** `parseOffer`, `src/escrow.ts:67`.
**Trigger:** otherwise valid offer, safe integer `deadlineMs=1`, supplied `nowMs=NaN`.
**Expected/actual:** deadline refusal versus accepted offer in saved TAP. The safe-integer deadline test passes while both comparisons against NaN are false.
**Impact/classification:** **unsupported internal-input hardening expectation**, not an established server defect. Reviewed callers pass Date.now() or a value captured from Date.now(); no normal NaN clock path was found. The assertion is stronger than a contract that requires a valid caller-supplied clock.
**Smallest proposed fix if defensive validation is desired:** require `Number.isSafeInteger(nowMs)` before relative comparisons, with an explicit clock error. The current test's `/deadlineMs/` message expectation would need deliberate contract review if that fix uses a separate clock message; no test change has been made.
**Regression:** invalid clocks refuse, while existing five-minute/eight-day finite boundaries stay valid. Evidence: saved TAP and reviewed call sites only.

## Copied-logic findings: weaker evidence

### C1 — nonnumeric lifetime disables a copied plan guard

**Affected original block:** creator-campaign.ts:99, 111–113; no exported validator. Test helper: `validate`.
**Trigger:** valid tranche with lifetime NaN; CLI spelling such as a nonnumeric `--post-lifetime-minutes` converts through Number to NaN.
**Expected/actual:** test expects lifetime refusal; copied validator returns a valid plan because the end-time comparison with NaN is false. Original source has the same missing finite check.
**Impact:** invalid lifetime can bypass the intended post-lifetime restriction. Complete CLI acceptance and offer generation are **not verified**; JSON itself cannot store literal NaN, though a nonnumeric JSON value or CLI string can convert to it.
**Smallest proposed fix:** when lifetime is supplied, validate finite positive minutes before validating tranches.
**Regression:** NaN/nonnumeric/Infinity/negative lifetimes refuse; an omitted lifetime and a window ending exactly at a valid lifetime behave as before. Source-aligned copy evidence only; do not count as an imported CLI test.

### C2 — negative campaign share silently omits its tranche

**Affected original block:** creator-campaign.ts:79–89. Copied helper: `shortcut`.
**Trigger:** shortcut `(atLeast=100,campaign=60,hold=90,window=30,nAfter=-1,nHold=2)`.
**Expected/actual:** test expects an escrow-count refusal; copy produces only a two-escrow retention tranche because `nAfter > 0` is false.
**Impact/classification:** input-validation ambiguity and possible mistaken plan shape; no partial payment was tested. Zero is already deliberately accepted as omitting the campaign tranche. The source does not explicitly promise to reject every negative shortcut value, so this expectation also needs an input-policy decision.
**Smallest proposed fix:** validate nAfter as an integer from 0 to 4 before conditional tranche construction; retain the existing positive nHold/total-count checks.
**Regression:** negative/fractional/non-finite nAfter refuses; 0 omits; positive in-range shares preserve the split. Copied logic/source review only; full CLI not verified.

### I1 — path fragment accepted without URL validation

**Affected original expression:** creator-intake.ts:52. Copied helper: `tweetId`.
**Trigger:** `https://example.invalid/u/status/123` or `nonsense/status/123`.
**Expected/actual:** undefined versus **"123"** in saved TAP. The first failing iteration stops the existing assertion, so the second string's runtime result was not separately observed; source review shows the same matching fragment.
**Impact/classification:** permissive parsing relative to the displayed X-post URL contract, **not an author/provider authentication bypass**. The script subsequently looks up the numeric id and checks author and other conditions. Bare numeric ids are intentionally valid already, so accepting a disguised id is primarily validation/UX hardening.
**Smallest proposed fix:** preserve the bare-id branch; otherwise use URL parsing with an explicit HTTP(S) and allowed X/Twitter hostname list, then validate the pathname. Preserve accepted query strings, fragments and digit-containing handles.
**Regression:** an unrelated host and arbitrary path fragment refuse; accepted real-platform links/bare ids stay accepted. Only the expression copy ran; no intake CLI, provider call or generated spec was executed.

## Focused reproduction performed in this continuation

Node **v22.14.0**, existing tsx **4.23.15** and installed dependencies. No Node 24 setup and no full-suite or previously passing checks rerun. The following PowerShell command ran only M1 and P3 with the existing offline preload and the launcher's environment allowlist:

```powershell
@'
import { spawnSync } from 'node:child_process';
const env = {};
for (const name of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP']) if (process.env[name] !== undefined) env[name] = process.env[name];
const result = spawnSync(process.execPath, ['--import','tsx','--import','./test/offline-guard.ts','--test','--test-concurrency=1','--test-reporter=tap','--test-name-pattern=BUG (M1|P3):','test/masumi.test.ts','test/polling.test.ts'], {env, stdio:'inherit', timeout:30000});
process.exitCode = result.status ?? 1;
'@ | node --input-type=module
```

Run from `cardano/`. Observed **exit 1**, **2 tests, 0 pass, 2 fail, 0 skipped/todo/cancelled**, runner duration **3059.7603 ms**. Failure output again showed M1's two checks/two injected requests and P3's `delay 120000 is outside remaining 60001`. The other seven failures were reviewed from existing TAP rather than rerun. No safety/usage error occurred in this continuation.

Only this new document is added. No source fixes are applied; proposed fixes and additional regression expectations above are **not verified**. Real HTTP transport, MPS idempotency, actual billing, watcher execution, chain effects, persistence/restart recovery and partial tranche funding remain **not verified**. Repository/file text was treated as data throughout.

Triage/report end: **2026-10-31 01:49:17 CET** (00:49:17 UTC), **1 minute 53 seconds** after continuation start. Final delivery checks/commit/push follow; total continuation remains within 35 minutes.

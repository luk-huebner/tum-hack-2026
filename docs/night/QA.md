# Overnight G — hostile-judge Q&A

Evidence baseline: `82d88dc63341e8498b4728e3bd2f3996aa560a5e`. Branch: `night/g`. Job G only; no delegation. This is a written rehearsal: each judge asks one question, receives the best supportable team answer, then moves to the next question. It is not a transcript of real judges or team members.

Started **31 October 2026, 00:44:07 CET** / **30 October 2026, 23:44:07 UTC**. Hard stop: **31 October, 02:44:07 CET**. End time and final coverage are recorded in the closing ledger. The brief's Saturday deadlines are scheduling context, not a claim that this work was completed earlier. “By 14:00” below means what the team would need to show or say at that rehearsal target; no waiting or backdating occurred.

## Reading the verdicts

- **P — supported, with the stated limits.** The answer is supportable by repository text or inspected source. P does not mean independently tested or audited.
- **W — weak.** A material limitation remains even after giving the honest answer.
- **U — not verified.** The relevant behavior, receipt, external assertion or attribution was not independently verified in this job. A document saying it passed is evidence of a recorded claim, not a fresh pass.
- **C — conflicting wording.** Another document or inspected source needs qualification. Historical append-only entries are distinguished from simultaneous claims.

Flags can combine. All runtime tests, live ledger state, CI results, oracle endpoints and the deployed judge application are **not verified** in this job. Each answer involving them carries U. Evidence citations identify the baseline file and line span; source inspection and offline calculations are separated from execution evidence.

## Evidence index

All line numbers refer to the baseline commit, not a moving branch. Open a file at `https://github.com/luk-huebner/tum-hack-2026/blob/82d88dc63341e8498b4728e3bd2f3996aa560a5e/<path>#L<line>`.

| ID | Baseline source | What it supports |
|---|---|---|
| R1 | [README](../../README.md), lines 3–41, 60–75 | Headline claims, mechanism, prerequisites and limits |
| R2 | [TRUST](../../TRUST.md), lines 7–66, 70–85 | Trust boundaries, gaps, short answers |
| R3 | [PROOFS](../../PROOFS.md), lines 7, 185–234 | Version split, attack matrix and current-validator receipts |
| R4 | [PROOFS](../../PROOFS.md), lines 123–169, 236–298 | Paid route, refund, watcher faults, polling |
| R5 | [PROOFS](../../PROOFS.md), lines 300–359 | Platform coverage, hosting, like latency, MCP |
| R6 | [PROOFS](../../PROOFS.md), lines 361–412 | Intake, retention chronology, tranche receipts, Masumi stand-in |
| R7 | [AUDIT](../../AUDIT.md), lines 3–30, 43–117 | Invariants, threat model, open findings, costs, review gaps |
| R8 | [ITERATIONS](../../ITERATIONS.md), lines 7–38; [SERVICE](../../SERVICE.md), lines 7–30 | Design changes, market uncertainty, service economics |
| R9 | [JUDGES](../../cardano/JUDGES.md), lines 3–12, 23–25, 48–67; [HOSTING](../../cardano/HOSTING.md), lines 9–15, 35–41 | Unsigned evaluation, controls, hosting limits, bench expiry |
| R10 | [SOURCES](../../cardano/SOURCES.md), lines 3–17, 41–58; [CREATOR_PAY](../../cardano/CREATOR_PAY.md), lines 14–57, 100–108 | Source-shape limits, creator assumptions, retention limitations |
| R11 | [MASUMI](../../cardano/MASUMI.md), lines 18–25, 38–48; [MCP](../../cardano/MCP.md), lines 17–21, 43–61 | Integration limits and spending controls |
| R12 | [airnode.ak](../../aiken/airnode_spike/lib/airnode.ak), lines 11–42; [engine.ak](../../aiken/airnode_spike/lib/engine.ak), lines 61–123, 150–258 | Actual hash construction, decimal parser, freshness and rule |
| R13 | [pay_on_proof.ak](../../aiken/airnode_spike/validators/pay_on_proof.ak), lines 20–92 | Actual payout, one-input rule, refund and finite bounds |
| R14 | [engine.ts](../../cardano/src/engine.ts), lines 19–26, 59–84; [proof.ts](../../cardano/src/proof.ts), lines 131–150, 180–190, 217–261 | Artifact hash check, encoding, preflight hints, verdicts, datum lookup |
| R15 | [mcp-server.ts](../../cardano/src/mcp-server.ts), lines 33–35, 56–72, 172–211 | Actual payee input and attempt counter behavior |
| R16 | [service.ts](../../cardano/src/service.ts), lines 91–173, 211–225; [masumi-agent.ts](../../cardano/src/masumi-agent.ts), lines 11–20 | Submission versus confirmation, payment sequencing, Masumi result semantics |
| R17 | [attack-offline.ts](../../cardano/src/attack-offline.ts), lines 17–61; [autorelease.ts](../../cardano/src/autorelease.ts), lines 96–125 | Three templates × 18 variants; in-memory budget and state |
| R18 | [POLLING](../../POLLING.md), lines 7–20, 22–55 | Invented simulation, cost-derived schedule, booth-mode exception |

## Judge 1 — Cardano developer relations

### C01. “The first contract on Cardano”: what search or independent authority establishes that priority?

**Team answer:** We cannot establish priority from this repository. We can demonstrate the narrower contribution: a Plutus V3 spend validator that verifies a pinned Airnode attestation and uses it for conditional settlement. “First” is a README claim, not an independently substantiated result. **Verdict: W, U.** Evidence: R1 line 3; R12–R13. Novelty search and external attribution: **not verified**.

### C02. Why use Cardano rather than let a conventional service decide whether to pay?

**Team answer:** Once a correctly constructed escrow is locked, the spend rule and payout key are enforced by the validator. The operator cannot substitute its own payout decision. Either a valid proof satisfies the policy or the refund key can spend after the deadline. This removes settlement discretion; it retains oracle and datum-construction trust and gives up human disputes and chargebacks. **Verdict: P.** Evidence: R2 lines 32–47; R13 lines 60–86. This is an inspected design boundary, not a claim of independent ledger verification.

### C03. Did a real Masumi buyer hire you, pay tUSDM and obtain a result, or did you implement your own imitation?

**Team answer:** We implemented the four MIP-003-facing routes and recorded 23 checks against a stand-in payment service. We have no recorded real registration, tUSDM payment, Sokosumi buyer or real MPS round trip. This is an adapter prototype intended to complement Masumi, not a completed production integration. **Verdict: W, U.** Evidence: R11 MASUMI lines 38–46; R6 lines 406–412. The 23 checks were **not verified** here.

### C04. Which receipts actually prove the current validator, rather than the version you admit was exploitable?

**Team answer:** The early receipts belong to `a9e4420c…`, and cannot establish the safety of `58fb7eef…`. The revision section records the current lock `5d348823…0923` and release `aba3ded9…bd94`, while the later template and tranche sections record additional current-version flows. The committed v2 log contains the same full release transaction identifier on lines 3–4. Matching document and log is corroboration, not an independent chain lookup. **Verdict: U, C.** Evidence: R3 lines 7, 209–234; `cardano/out/autorelease-log-v2-test.jsonl:3–4`. The opening “see the last section” and 55-test count are historical pointers; later additions reach 78 tests. Live receipts: **not verified**.

### C05. Can you reproduce “78 tests pass” and prove the committed blueprint came from this source?

**Team answer:** This job independently counted 78 test declarations and recomputed the two blueprint hashes and byte lengths. Those checks agree with the declared current hash and 2,317 bytes. They do not run the tests, identify the compiler output's source commit or reproduce a build. Passing CI is recorded in the documents, not freshly observed here. **Verdict: W, U.** Evidence: R7 lines 5–7, 105–109; R6 line 378; closing verification ledger. Aiken execution and source-to-bytecode reproducibility: **not verified**.

### C06. Does your fix destroy batching, and what happens to an honest payment of two policies in one transaction?

**Team answer:** A Release allows exactly one input with this validator's payment credential. Even a batch paying both policies in full is rejected by this version. That is the explicit tradeoff used to close double satisfaction. Other scripts' inputs do not count toward this particular guard. We have not measured throughput or built a safe batching replacement. **Verdict: P.** Evidence: R13 lines 38–49, 70–79; R3 lines 215–219. Rejection behavior is source-supported; runtime repetition is **not verified**.

### C07. Are your quoted 0.030–0.088 tADA costs whole transactions, and do they demonstrate economic scalability?

**Team answer:** They are reported script execution fees, not full transaction fees. For example, the current ETH/USD keeper release is recorded at 0.321922 tADA total, while AUDIT lists 0.042 tADA for its script. Those are different quantities. The measured inputs are small templates; reference scripts, worst-case payloads, throughput and long-running economics are unmeasured. **Verdict: W, U.** Evidence: R7 lines 94–103; R3 line 230; R2 line 82. Historical cost receipts: **not verified** here.

### C08. Does “permissionless refund” mean anybody can refund to anybody, and is the buyer guaranteed all 5 tADA back?

**Team answer:** No. The refund party's key must be a required signer after the deadline; the validator imposes no refund-output restriction. The ledger must then check the signature. The authorized refund party can choose outputs and fees. One recorded refund returned 4.740077 tADA from 5 tADA after fees, so “all 5 back” would be inaccurate. **Verdict: P.** Evidence: R13 lines 82–86; R7 line 28; R4 lines 163–167. The amount is a recorded receipt, **not verified** against the ledger here.

### C09. Can I use this escrow for an NFT or native token, as a Cardano application normally might?

**Team answer:** The supported templates hold ADA only. Release protects the lovelace amount but does not require native assets in the input to follow the beneficiary. We must not advertise general native-token escrow or place valuable tokens into it. **Verdict: W.** Evidence: R2 line 54; R7 T3/F2; R13 lines 74–79. This limitation is visible in source; a token-transfer attack was **not verified** by execution.

### C10. You say the public site “holds no key of any kind.” How does it call Blockfrost, and is it actually keyless?

**Team answer:** It is wallet-keyless, not credential-free. HOSTING says it holds a Blockfrost preprod project credential and a public address, and can evaluate unsigned transactions. It has no documented payment-signing capability. README's absolute “no key of any kind” wording conflicts with its own parenthesis and the hosting inventory. Deployment contents and availability have not been inspected here. **Verdict: W, U, C.** Evidence: R1 line 21; R9 HOSTING lines 9–15, 35–39.

### C11. If the facilitator does not validate the datum, why should a buyer trust the escrow offer? And is your test count 17 or 54?

**Team answer:** The buyer must independently derive the full intended datum and reject mismatches, including destination, amount, asset, network and script. Facilitator acceptance alone is insufficient. The inspected attack script has 18 dishonest variants over three templates, totaling 54; TRUST and early PROOFS still say 17, while AUDIT says 54. We should label the earlier count historical and cite the current script without claiming to have rerun it. The client and server also share policy-building code, so agreement alone is not independent correctness. **Verdict: W, U, C.** Evidence: R2 lines 30, 43, 56; R3 line 203; R7 T12; R17 attack-offline lines 17–61. Runtime refusals: **not verified**.

### C12. If I see HTTP 402 after a minute, can I retry without paying twice?

**Team answer:** Not safely on that HTTP result alone. Several recorded 402 responses accompanied settled escrows. The clients added lookup by exact datum before concluding failure. That mitigates uncertainty but is not proven durable idempotency: the lookup can fail and two requests can have identical terms. We do not have evidence that every retry maps to exactly one payment. **Verdict: W, U.** Evidence: R2 line 58; R4 lines 264–275; R6 line 398; R14 proof lines 241–261. Duplicate-identical-order and multi-client tests: **not verified**.

### C13. What does the keeper prove about unattended operation, and what survives a restart?

**Team answer:** A recorded three-escrow scenario injected faults and restarted the process; the checked logs contain retry, release and confirmation events. Open UTxOs are rediscovered from the chain. But the inspected budget, polling samples, attempt maps and submitted map live in memory. A process-lifetime spending cap is not a durable campaign cap, and a restart can lose scheduling/accounting state. An eight-day service, multiple watchers and a dropped mempool transaction are not demonstrated. **Verdict: W, U.** Evidence: R4 lines 254–275; R17 autorelease lines 113–125; R10 CREATOR_PAY lines 102–104.

### C14. Does a 2 tADA keeper fee make this profitable, and who pays for checks that never earn a release?

**Team answer:** The keeper pays data and release fees; a failed outcome can still incur data costs. The documents explicitly say today's service loses money and has no real commercial billing. There is no validated conversion between the test currencies, success-rate model or break-even analysis. Pass-through data costs and premium campaign tools are possibilities, not proven margins. **Verdict: W, U.** Evidence: R8 SERVICE lines 10–23, 29–30; R4 lines 287–298. Commercial economics: **not verified**.

### C15. Who has asked for this, and what demonstrates that it is more than a prize-oriented technical demo?

**Team answer:** No customer conversations are recorded. The proposed users are creator agencies, Masumi agent sellers and communities paying on public data. The repository suggests five conversations and a preprod pilot; those are proposed validation, not traction. The present case is a technical feasibility demonstration with explicit demand uncertainty. **Verdict: W, U.** Evidence: R8 ITERATIONS lines 25–30; SERVICE line 30. Customer demand and adoption: **not verified**.

## Judge 2 — API3, signed data and oracles

### A01. State the exact signed-message verification. Are you checking a raw keccak hash or the EIP-191 wrapped digest?

**Team answer:** The inspected Aiken code first computes `keccak256(request_hash || uint256_big_endian(timestamp) || data_bytes)`, then hashes the EIP-191 32-byte-message prefix concatenated with that digest, and checks secp256k1 ECDSA with the pinned compressed public key. README and AUDIT's shortened formulas omit the outer wrapper; they must not be used as exact implementations. **Verdict: P, C.** Evidence: R12 airnode lines 11–42; R1 line 38; R7 line 25. Cryptographic vector execution: **not verified** here.

### A02. Who vouches that the pinned signing key actually belongs to the listed API3-operated Airnode?

**Team answer:** The contract trusts a key chosen in the datum, not an on-chain API3 identity. TRUST records discovery from the Airnode's own root endpoint and matching recovered signer address. That shows consistency with the endpoint, not independent ownership or governance. There is no key registry, rotation or revocation under an open policy. A buyer needs an out-of-band source of trust; we do not have that attestation in the pack. **Verdict: W, U.** Evidence: R2 line 64; R12 engine lines 21–25. Endpoint identity and API3 attribution: **not verified**.

### A03. Your observation limit is 120 seconds. Can data nevertheless be seven minutes old at settlement?

**Team answer:** As a bound derived from the source, yes: the observation may be 120 seconds old when signed and the attestation may remain valid for another 300 seconds, giving up to 420 seconds from observation to the latest allowed validation time. This is a worst-case bound, not an observed stale payout. The optional check applies only when a signed observation slot exists; tweets and rainfall lack that check. “Observation at most 120 s old” must say “at signing.” **Verdict: W, C.** Evidence: R12 engine lines 191–208, 236–247; R3 lines 211, 229; R2 lines 55, 73; R14 proof lines 161–164. A stale-boundary execution is **not verified**.

### A04. If the upstream returns a confidently wrong value or a compromised key signs a lie, why will the contract not pay?

**Team answer:** It can pay. The attestation authenticates the signed answer; it does not establish truth, anti-bot legitimacy or uncompromised operation. Most documented sources trust API3's operator and an upstream API. No independent second signer, dispute process or buyer veto is built. We sell enforcement of a declared data-dependent rule, not immunity from oracle failure. **Verdict: W.** Evidence: R2 lines 42, 45, 66; R10 CREATOR_PAY line 42. No claim of a tested compromise defense is made.

### A05. What prevents one public signed response from being replayed against every similar escrow?

**Team answer:** Nothing, if those escrows intentionally pin the same request, signer, byte shape and freshness bounds. That reuse is by design and enables shared data fetches. Each UTxO can be consumed only once. Different tasks need an identity bound into the request or fixed signed text; the response is not inherently bound to one escrow or chain. **Verdict: P.** Evidence: R2 line 62; R7 T11; R12 engine lines 240–248. This is a protocol boundary, not an executed replay test in this job.

### A06. Show that all four required tamper cases fail for the intended reason, rather than because the whole evaluator is broken.

**Team answer:** The recorded six-step bench brackets edited value, stale response, other request and foreign signer with accepted controls. The first all-rejected attempt was discarded because the evaluator could not see the fresh UTxO. Signature-level tests separately alter value, request, signer and timestamp; age is an engine check, not a cryptographic property. Generic evaluation failures do not identify the exact failing predicate. This job has not rerun the bench or observed the public deployment. **Verdict: U.** Evidence: R3 lines 64–77, 228; R9 JUDGES lines 25, 64–67; R12 airnode lines 75–115.

### A07. “Any API in your contract”: can I register arbitrary JSON, signed arrays, changing titles, negative values or a huge response?

**Team answer:** Not generally. The registration path expects numeric object members, fixed surrounding text and adjacent selected slots; arrays need projection. Shape changes can break a policy. Fixed text over 4,000 bytes is refused by the tool, while smaller unusual encodings remain a compatibility risk. The Aiken numeric parser accepts digits and one decimal point, not signed negatives or exponents. Only a subset of projected responses fits this design. **Verdict: W, C.** Evidence: R10 SOURCES lines 3, 15–16, 54–58; R12 engine lines 61–123. Arbitrary-source compatibility: **not verified**.

### A08. Are numeric interpretation, byte reconstruction and off-chain preflight actually identical for every signed string?

**Team answer:** The validator rebuilds the signed bytes before using its integer-scaled parsing rule; excess precision or invalid characters halt. The TypeScript hint uses `Number` and rounding, which is not the same algorithm for all inputs. A preflight hint cannot establish contract acceptance. Existing examples cover selected decimals; exhaustive parser equivalence and resource bounds are not proven. **Verdict: W, U.** Evidence: R12 engine lines 71–123, 150–174, 227–248; R14 proof lines 131–149; R7 lines 109, 114. Fuzzing and differential parsing: **not verified**.

### A09. Are you bridging Base assets or relying on an API3 deployment on Cardano?

**Team answer:** Neither is required for this mechanism. Data is signed off chain and its proof travels inside the Cardano release transaction. Paid source calls use aUSD on Base Sepolia today; the conditional funds are tADA on Cardano preprod. This is transport and verification of an attestation, not an asset bridge, a Cardano-native data-payment rail or evidence of API3 endorsing a deployment. **Verdict: P.** Evidence: R2 line 80; R8 ITERATIONS line 38; R11 MASUMI line 46.

### A10. Does “measured after the campaign” prove the underlying observation occurred after that time, and will your 48-hour bench work until Sunday?

**Team answer:** `settle_after` constrains signing time. It does not generally prove an upstream observation happened after the measurement boundary; even the optional observation check only compares observation age with signing time. Separately, the bench's deadline is Saturday 31 October at 20:00 UTC, earlier than the stored response's stated Sunday age expiry. Both conditions must hold. The effective release/evaluation availability cannot be promised through Sunday merely because the signature is under 48 hours old. **Verdict: W, C.** Evidence: R12 engine lines 191–208, 236–239; R9 JUDGES lines 5, 9; HOSTING line 40. Current open UTxOs and live expiry behavior: **not verified**.

### A11. Can a judge choose any YouTube, Instagram or TikTok post and see an on-chain payout?

**Team answer:** The documented YouTube projection has eight contract tests, not a service escrow receipt. The sampled video's counts were identical seven hours apart and unknown posts were not served. Instagram listing output is recorded, but single-post field mapping and TikTok flows are untested. We should demonstrate only the supported sample and disclose indexing and snapshot limits. **Verdict: W, U.** Evidence: R5 lines 300–313; R10 SOURCES lines 47–58. Those provider observations and tests: **not verified** here.

### A12. How does late measurement defeat purchased likes that are still present at the end?

**Team answer:** It does not. Baseline-plus-target, late measurement and retention reduce some forms of gaming but do not distinguish genuine engagement from purchased engagement that persists. “A mid-campaign boost does not count” is true only if the boost is gone by the qualifying signed measurement. There is no measurement of manipulation cost or causal attribution to the hired agent. **Verdict: W, C.** Evidence: R10 CREATOR_PAY lines 32–42; R1 line 26; R2 line 76. Fraud prevention effectiveness: **not verified**.

### A13. Where is the receipt for an actual deleted or edited post preventing a retention payout, and a real week of monitoring?

**Team answer:** There is no such receipt in the pack. The on-chain rehearsal used an unlike, not deletion, and a compressed window. It paid the campaign tranche to the buyer-controlled payee and refunded retention escrows. Pinned-text tests show a changed fixed prefix fails, but do not establish live edited-post behavior, deletion response freshness or uninterrupted monitoring for days. Earlier “not on chain yet” paragraphs are historical and are superseded only for the specifically recorded short run. **Verdict: W, U, C.** Evidence: R6 lines 363–400; R10 CREATOR_PAY lines 46–58, 102–107.

### A14. Is “two seconds to a like” or “53 seconds to payout” an SLA, and was the transaction confirmed at 53 seconds?

**Team answer:** Neither is an SLA. Two sampled likes appeared in the next response, received 2.3 and 1.7 seconds after the clicks, with clock and sampling limitations. The detailed live table records release **submission** 52.9 seconds after a like, while prose says “on chain” in 53 seconds. The booth log's final event is `released`, not a separate confirmation. Without a confirmation timestamp, we should say “submitted in about 53 seconds,” and label finality timing unmeasured. **Verdict: W, U, C.** Evidence: R5 lines 329–353; `cardano/out/autorelease-log-booth.jsonl:18`. The log matches the public transaction identifier; latency and ledger inclusion are **not verified** here.

### A15. Prove “paid only when it releases” is atomic between the keeper fee, payout and data payment, including Masumi.

**Team answer:** The recorded x402 run has a keeper payment and release, and a wrong-request refusal with unchanged balances. It does not prove atomicity across separate transactions or chains. The inspected keep handler returns success after `signAndSubmit`, before confirmation, and external middleware settles its fee. Masumi can report either released or not released as a completed watching result; no real MPS settlement was run. We can describe a success-conditioned x402 handler, not guarantee confirmed-outcome billing across all paths. **Verdict: W, U, C.** Evidence: R4 lines 125–140; R16 service lines 147–170 and masumi-agent lines 11–20; R8 SERVICE lines 3, 10. Failure interleavings, fee settlement and Masumi billing: **not verified**.

## Judge 3 — student blockchain security club, audit selection

### S01. Why award you scarce audit time if you cannot show a reproducible build, fuzzing or an independent review?

**Team answer:** Because the small funds-holding contract has an explicit threat model, preserved vulnerable artifact, a documented attack discovery and focused reviewer questions. That is a useful review starting point, not an assurance result. We have 78 declarations but have not rerun them, no property-based tests, no formal proof and no external review. An audit request should freeze the source and artifact, and include the off-chain trust boundary. **Verdict: W, U.** Evidence: R7 lines 3–17, 80–117; closing ledger. Audit readiness is partial; security is **not verified**.

### S02. State the entire money-release invariant without saying “everything locked is protected” when it is not.

**Team answer:** A Release spends exactly one input at this validator credential, passes the engine checks and has some output to the beneficiary's verification payment key containing at least the greater of policy payout and input lovelace. It does not require full-address equality or preservation of native tokens. A Refund instead needs finite bounds, the deadline and the refund signatory, with no output restriction. **Verdict: P.** Evidence: R13 lines 20–86. These are inspected predicates; execution is **not verified**.

### S03. Did the original double-satisfaction attack actually steal funds, and what specifically changed?

**Team answer:** No theft transaction is documented. An unsigned transaction evaluation accepted spending two 5 tADA policies with one 5 tADA payout on the old validator. The revision adds the one-input guard and preserves input lovelace on Release. A same-shape comparison is recorded as old ACCEPTED, new REJECTED; the old blueprint is retained. That is evaluation evidence, not an on-chain exploit or a fresh reproduction by this job. **Verdict: U.** Evidence: R3 lines 207–221; R13 lines 38–49, 74–79. Old and new bytecode hash consistency was verified offline; attack behavior was **not verified** here.

### S04. Your one-input guard ignores other scripts. Can one output satisfy obligations of this validator and an unrelated validator?

**Team answer:** The guard counts only inputs with our payment credential. It closes the documented same-validator case, not every possible composition with other contracts. An output may be considered by another script's independent rules. Whether that creates loss depends on that other protocol and its accounting. Tests allowing another script's input are not a proof of arbitrary composability. We have no reproduced cross-script exploit and must ask the auditor to examine this boundary. **Verdict: W, U.** Evidence: R13 lines 41–49, 27–35; R7 lines 69, 117; R4 line 281. Cross-protocol safety: **not verified**.

### S05. Can a hostile releaser change the beneficiary's stake credential or pay a script-controlled treasury?

**Team answer:** It can choose a different stake credential while retaining the beneficiary's spending payment key. The predicate does not compare the full address, and the builder uses an enterprise address. A script payment credential does not satisfy a verification-key beneficiary, so a DAO or multisig script is not directly supported. Wallet visibility and staking behavior should not be promised. **Verdict: W.** Evidence: R7 F4/F7 and lines 71–78; R13 lines 27–35; R14 proof lines 187–188. Runtime address cases: **not verified**.

### S06. Your unsigned refund evaluation accepts the required key name. Did you prove the ledger refuses a forged signature?

**Team answer:** No. The validator checks the required-signers list; actual witness validation is the ledger's separate job. Documents explicitly say the listed-but-unsigned refund submission was not run. We can show which signer the script requires, but must not describe the evaluation as a cryptographic witness test. **Verdict: U.** Evidence: R2 line 63; R3 lines 187, 201, 205; R13 line 85. Ledger witness behavior: **not verified** in this job.

### S07. At the exact deadline do both parties have valid exits, and do milliseconds in a unit test model real ledger slots?

**Team answer:** The predicates allow Release at `upper <= deadline` and Refund at `lower >= deadline`; AUDIT records an exact-instant overlap accepted as a low finding. One UTxO can still be consumed only once. The abstract boundary tests do not show that a zero-width interval is ledger-admissible; actual slot rounding and admissibility need separate evidence. We should disclose the modeled overlap without promising a reproduced chain race. **Verdict: W, U.** Evidence: R7 F5; R12 engine line 239; R13 line 84; PROOFS line 62. A ledger-level deadline race: **not verified**.

### S08. If a user sends funds with the wrong datum, can an emergency key, admin or timeout rescue them?

**Team answer:** No rescue path is documented. Missing or incompatible datum data can make both redeemers unspendable. The buyer's intended-policy check mitigates our own payment flow, but does not stop arbitrary sends to the script address. A timeout cannot decode a missing Policy. “Funds cannot get stuck” must always be restricted to a valid, spendable datum and an available refund signer. **Verdict: W.** Evidence: R2 line 56; R7 T12/F6; R13 lines 67–68. Rescue behavior is not claimed or verified.

### S09. After the signing key is compromised, can you freeze a live policy without giving an administrator power to steal it?

**Team answer:** This version has neither revocation nor rotation. A compromised trusted key can sign false qualifying data; a changed key can prevent Release, leaving the refund path after deadline. The proposed revoke-only registry is a future design requiring a new validator and analysis of administrator denial-of-service. It is not a present defense. **Verdict: W.** Evidence: R2 lines 64–66; R8 ITERATIONS line 35. Revocation implementation: **not verified**, because not built in this version.

### S10. You say 65-byte signatures are truncated. Where, and what evidence settles high-s or recovery-byte handling?

**Team answer:** Aiken receives the compact signature and passes it directly to the ECDSA builtin. The off-chain encoder removes the recovery suffix before making the redeemer. AUDIT's wording attributing that cut to `airnode.verify_attestation` is imprecise. Existing vectors do not settle all malformed-length, high-s or alternate-recovery encodings. Signature uniqueness is not the payout identity, but the acceptance semantics still deserve review. **Verdict: W, U, C.** Evidence: R12 airnode lines 31–42; R14 engine's compact-signature encoding; R7 lines 78, 113. Builtin edge-case behavior: **not verified**.

### S11. What stops a malicious policy from exhausting execution budget, or a public visitor from draining the site's provider quota?

**Team answer:** Normal recorded templates have modest measured execution budgets, but they are not worst-case parser or huge-scale measurements. The public route has per-process rate and concurrency guards, which HOSTING explicitly calls a courtesy across instances. A transaction-size bound is not a complete CPU bound for every recursive computation; public evaluations also consume an external quota. No load or adversarial-resource result is in the pack. **Verdict: W, U.** Evidence: R7 T15 and lines 94–109; R12 engine lines 63–68; R9 HOSTING lines 15, 37–39; R5 line 321. Denial-of-service resistance: **not verified**.

### S12. If I restart the keeper repeatedly, do I get a fresh data budget? Can paid-source failures escape the budget ledger?

**Team answer:** The inspected watcher initializes `spent` to zero for each process, so its cap is a process-lifetime cap. The shared fetch helper only returns recorded spend on a successfully read saved response; uncertain paid calls need reconciliation rather than an assumption that failure was free. The recorded restart scenario is useful liveness evidence but does not establish a durable budget or exact accounting under lost answers. **Verdict: W, U.** Evidence: R17 autorelease lines 113–125; R14 proof lines 55–66; R4 lines 264–275. Repeated-restart and uncertain-charge accounting: **not verified**.

### S13. Is the MCP three-escrow limit really three settled escrows, including timeouts and “confirm: true” supplied by an agent?

**Team answer:** It is an in-memory counter, incremented before the child process and decremented on error. An error can coexist with settlement elsewhere in this system. Repeated uncertain failures may therefore let actual settled escrows exceed what the counter represents; this is a source-derived concern, not a reproduced incident. `confirm: true` is a tool argument, not proof that a human clicked consent. The payee argument is also exposed, contrary to MCP's fixed-beneficiary sentence. **Verdict: W, U, C.** Evidence: R15 lines 56–72, 175–194; R11 MCP lines 19–21, 45, 59–61; R2 line 58. Spending tools, durable caps and human-approval enforcement: **not verified**.

### S14. Does a signed response prove that an agent did the work, or that the creator owns the payout address?

**Team answer:** Neither follows from the signature alone. The provider can bind reported author ID, post ID, creation time and count; the policy can bind a payment key. The off-chain agreement is what associates the creator with that address and the desired task. All recorded payees are team-controlled, and genuine outside-creator onboarding and payout-address ownership have not been demonstrated. **Verdict: W, U.** Evidence: R2 lines 9–13; R10 CREATOR_PAY lines 7–21, 102; R6 lines 382–400. Causal task attribution and an independent creator's wallet: **not verified**.

### S15. Can this be called safe or mainnet-ready after today's review, and what should our audit decision actually be?

**Team answer:** No. The defensible request is an independent review of a frozen testnet prototype: validator, engine, attestation encoding, buyer checks, uncertain settlement and operator spending controls. Known gaps remain, and this rehearsal supplies neither an audit nor deployment approval. The documented exploit discovery makes review worthwhile; it does not certify the fix or the entire system. **Verdict: W, U.** Evidence: R1 line 75; R7 lines 3–17, 105–117; R8 ITERATIONS lines 31–37. Overall safety and production readiness: **not verified**.

## Ten weakest answers, ranked

The ranking prioritizes security and money-handling gaps, then claims most likely to be challenged. “Fix by 14:00” means bring the named evidence or narrow the spoken claim; it does not imply the evidence exists now. All proposed checks below must stay within the job's testnet, no-spend constraints. Where that evidence cannot be obtained safely, the correct fix is to say “not verified.”

1. **A03 — Observation freshness can exceed the stated 120 seconds.** The optional observation cap applies when the Airnode signs, and signature age adds up to the policy's later validation window. Only feeds carrying observation time benefit. **By 14:00:** use one diagram and a worked timestamp example showing observation time, signing time and latest valid transaction time; label the worst case as a derived bound, and state that tweet/rainfall observation freshness is unavailable. Never call 120 seconds the settlement-time maximum. **Evidence:** R12; R2 line 55.
2. **S13 — MCP spending limits and confirmation.** The per-session counter is in memory, decrements on child-process errors, and `confirm: true` is an input field. The source also accepts a payee, despite MCP.md saying the beneficiary is fixed to the seller. **By 14:00:** show the exact reviewed source behavior and a no-spend failure-path test if already available; otherwise explicitly narrow “three per session” to “three successful child-process calls in one process” and disclose that it is not human confirmation or durable accounting. Reconcile the payee documentation. **Evidence:** R15; R11.
3. **C11 — Buyer datum checking, with 17 versus 54 attack variants.** The checked-in script enumerates 18 dishonest offers for each of three templates (54), while older prose says 17. The buyer-side checker shares code with offer generation. **By 14:00:** point to the exact version/count and call earlier numbers historical; explain that a client check is a mitigation and not an independent proof of buyer intent. If the offline script was not run in this scope, say so. **Evidence:** R17; R2 line 30; R3 line 203.
4. **C04 — Receipts span two validator versions.** Many vivid earlier examples are for the vulnerable first validator; a few current-validator release receipts are logged, but this rehearsal did not query a chain. **By 14:00:** put the validator hash next to every demo receipt and separate old-version attack evidence from current-version evidence. Identify the current v2 receipt as document-plus-log corroboration, not fresh chain verification. **Evidence:** R3 lines 7, 209–234; v2 log.
5. **C10 — “No key of any kind” overstates judge-site isolation.** The public host is documented as holding a Blockfrost credential, although it has no signing wallet key. **By 14:00:** say “no wallet signing key; a read-only provider credential is configured,” and show the hosting inventory. Do not imply the live deployment was inspected during this job. **Evidence:** R1 line 21; R9 HOSTING.
6. **A13 — Retention and deletion.** The actual short run unliked the post; it did not delete it or run a real week-long retention window. **By 14:00:** say “unlike simulation, short window”; show the recorded campaign payout and retention refunds. Do not claim deletion detection or multi-day uptime. A genuine deletion run would require separate authorization and a safe test plan. **Evidence:** R6 lines 380–400; R10 CREATOR_PAY lines 100–108.
7. **C12 — Payment recovery and retry ambiguity.** A 402 response can accompany a settled payment; lookup by datum helps, but matching terms do not create a unique idempotency key. **By 14:00:** explain “check the chain/escrow before retrying” and label the recovery mechanism best-effort. Bring a recorded duplicate-identical-request test only if one already exists; otherwise say duplicate-charge behavior is unresolved. **Evidence:** R2 line 58; R4 lines 264–275; R14 lines 241–261.
8. **A15 — “Only when released” across distinct payment systems.** The keeper release is submitted before chain confirmation, and Masumi's integration only used a stand-in. **By 14:00:** distinguish x402 HTTP job charging, transaction submission, on-chain confirmation and Masumi job-result settlement. State that cross-system atomicity and real Masumi billing were not verified. **Evidence:** R16; R11 MASUMI.
9. **A12 — Authentic signed data is not authentic engagement.** A valid signature shows what the API reported, not that likes were genuine or earned by the agent. Late measurement and retention reduce some gaming but do not eliminate it. **By 14:00:** state this plainly in the pitch, avoid an anti-fraud guarantee, and use brands/agencies as the first proposed paid-pilot buyer only as a hypothesis. **Evidence:** R2 lines 9–13, 66, 76; R10 CREATOR_PAY lines 32–42.
10. **C14 — Monitoring costs and service economics.** Paid checks can cost money when no payout occurs; long retention windows increase watch costs. The documents admit the service currently loses money and has no paying customer evidence. **By 14:00:** show the 0.13 aUSD recorded two-escrow polling example and the 2.8 aUSD estimate for 23 hours, clearly separating observed cost from estimate. Say a brand/agency pilot is the first buyer hypothesis; no customer conversations have happened. Do not call the offer profitable. **Evidence:** R4 lines 287–298; R10 CREATOR_PAY line 76; R8 SERVICE lines 13–30; R8 ITERATIONS lines 25–30.

## Remaining flagged answers and what to say by 14:00

- **C01 (W,U):** Drop “first” unless an independent priority search is available; present only the specific validator capability. No novelty check was run. **Evidence:** R1 line 3.
- **C03 (W,U):** Call Masumi a stand-in-tested adapter prototype; say no real MPS, registration or tUSDM payment. Do not imply a finished integration. **Evidence:** R11; R6 lines 406–412.
- **C05 (W,U):** Say “78 test declarations counted; tests not run here.” A hash match confirms the committed bytes against the committed hash, not compiler provenance. **Evidence:** R7 lines 105–109; verification ledger below.
- **C07 (W,U):** Label script execution cost separately from total fee; offer no scalability conclusion from four small cases. **Evidence:** R7 lines 94–103; R3 line 230.
- **C08 (P, but historical receipt U):** Explain that the refund party signs and fees reduce returned lovelace. The 4.740077 tADA is a recorded receipt, not an independently queried chain result. **Evidence:** R13; R4 lines 163–167.
- **C09 (W):** Say “ADA templates only; native tokens in the input are not protected.” No generic token escrow claim. **Evidence:** R2 line 54; R7 T3.
- **C13 (W,U):** Distinguish chain rediscovery from lost in-memory budget and retry state. Do not promise durable monitoring or eight-day uptime. **Evidence:** R17; R10 CREATOR_PAY lines 102–104.
- **C15 (W,U):** Name brands/agencies as the first paid-pilot buyer hypothesis. Do not suggest they have been interviewed; no customer conversations are recorded. **Evidence:** R8 ITERATIONS lines 25–30; SERVICE line 30.
- **A01 (P,C):** Give the EIP-191 wrapped formula from Aiken source; note the abbreviated README/AUDIT formulas. Do not say crypto vectors were freshly run. **Evidence:** R12; R1 line 38.
- **A02 (W,U):** Explain that the policy pins a key but does not prove API3 ownership; a buyer needs out-of-band trust. No independent identity check was run. **Evidence:** R2 line 64.
- **A04 (W):** Admit a correctly signed falsehood can satisfy the rule; no second source or dispute mechanism exists. **Evidence:** R2 lines 42, 45, 66.
- **A06 (U):** Describe the bench as recorded evaluation evidence only; a control must pass before interpreting refusals. No live page or node evaluation was used in this job. **Evidence:** R3 lines 64–77; R9.
- **A07 (W,C):** Replace “any API” with “a constrained projected response whose signed text has a supported fixed shape.” Do not promise arbitrary JSON support. **Evidence:** R10 SOURCES.
- **A08 (W,U):** Call off-chain checks hints. Exact parser equivalence, fuzzing and worst-case bounds remain unverified. **Evidence:** R12; R14 proof lines 131–149; R7 lines 109, 114.
- **A10 (W,C):** Explain signing-time measurement versus observation time and note deadline can expire before a 48-hour age limit. Live bench UTxOs were not checked. **Evidence:** R12; R9.
- **A11 (W,U):** Limit platform claim to the documented LunarCrush sample and contract tests; no platform endpoint or test was freshly run. **Evidence:** R5 lines 300–313.
- **A14 (W,U,C):** Say “release submitted about 53 seconds after the like”; do not claim confirmed inclusion or an SLA. **Evidence:** R5 lines 329–353; booth log.
- **S01 (W,U):** Ask for an independent testnet review of frozen code, not an audit badge or mainnet approval. No external review was performed. **Evidence:** R7.
- **S03 (U):** Say the old flaw was demonstrated by unsigned evaluation, then the same shape was recorded rejected on the new blueprint. Do not call it an on-chain theft or a fresh test. **Evidence:** R3 lines 207–221.
- **S04 (W,U):** State the one-input guard's scope and request auditor review of cross-script composition. No exploit was reproduced. **Evidence:** R13; R7 line 117.
- **S05 (W):** State payment-key-only beneficiary matching, stake-credential freedom and no script beneficiary support. **Evidence:** R7 F4/F7; R13.
- **S06 (U):** Separate required-signer evaluation from ledger witness verification; the latter was not run. **Evidence:** R2 line 63; R3 line 205.
- **S07 (W,U):** Disclose the exact-deadline overlap in predicates and say ledger-slot race behavior is not verified. **Evidence:** R7 F5; R13 line 84.
- **S08 (W):** Say malformed/missing datum funds may be stranded; no admin rescue exists. **Evidence:** R7 T12/F6; R13.
- **S09 (W):** Say key rotation/revocation is absent; refund remains the documented exit if signing stops. **Evidence:** R2 lines 64–66.
- **S10 (W,U,C):** Correct AUDIT's location for signature compaction; say high-s and edge encodings need reviewer attention. **Evidence:** R12 airnode; R14 engine; R7 lines 78, 113.
- **S11 (W,U):** Present the measured cost range and per-instance rate guard, while saying load and worst-case compute are untested. **Evidence:** R7; R9 HOSTING.
- **S12 (W,U):** Call the aUSD cap process-local and describe uncertain paid-call accounting as unresolved. No restart-budget test was run. **Evidence:** R17; R14 proof lines 55–66.
- **S14 (W,U):** Distinguish a signed author/post field from proof that a real creator controls the payout key or caused the outcome. **Evidence:** R10 CREATOR_PAY; R6 lines 382–400.
- **S15 (W,U):** Request review of a testnet prototype, not production approval; disclose all known limitations. **Evidence:** R1 line 75; R7; R8 ITERATIONS lines 31–37.

## Verification and coverage ledger

Performed in this job, offline against the isolated clone:

- Fresh HTTPS clone with `--no-checkout`; only then verified `git --show-toplevel` as the required isolated directory. Branch `night/g` starts at the specified base commit.
- Scanned 137 tracked paths before checkout. One filename, `checks/02-new-wallet.mjs`, was conservatively excluded from materialization; no secret value or excerpt was emitted. The five requested documents and selected public code/log files were read only from the isolated clone. No local wallet or `.env` file was read or copied.
- Counted 78 Aiken test declarations. Recomputed Blake2b-224 over the Plutus V3 language tag and compiled bytes for both committed blueprints; sizes and hashes matched each blueprint's own declarations (current: 2,317 bytes; prior: 1,832 bytes). This checks static artifact consistency only.
- Parsed the selected committed autorelease JSONL logs without exposing their records. All 14 selected files had valid JSON on every line. The current validator release identifier in `PROOFS.md` matches the v2 log; the Creator Pay payout identifier matches the tranche log. This is local file consistency, not chain verification.
- Confirmed the report has 15 numbered questions for each of the three requested judge roles and a ranked ten-item weak list. No Cardano test, Aiken test, browser bench, live deployment, CI, transaction, signature, paid request, account or API provisioning was performed. Those are **not verified**.
- GitHub Docs were opened in the dedicated `Overnight G` Chrome session. The official page says `[skip ci]` suppresses push and pull-request workflows, but warns that required checks remain pending. This branch's root workflow is push-triggered; PR creation will not merge or deploy. Use `[skip ci]` on the report commit to avoid starting that workflow.

### Time record

- Start: **31 October 2026, 00:44:07 CET** (**30 October 2026, 23:44:07 UTC**).
- End: **to be filled at final commit**.
- Coverage: all 45 judge questions, ranked ten weak answers, remaining flagged-answer coaching, offline artifact/log inspection. No runtime or network behavior was claimed as freshly verified.

- End: **2026-10-31 01:17:44 CET** (**2026-10-31 00:17:44 UTC**).
- Elapsed: **33.6 minutes**. Within the two-hour ceiling.

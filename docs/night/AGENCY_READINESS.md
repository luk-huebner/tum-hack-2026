# Creator Pay: agency pilot and judge readiness

Prepared 31 October 2026, Europe/Berlin. Buyer chosen by the owner: **brands or agencies paying creators**.

This is a decision brief, not a security audit or a claim of production readiness. Repository inspection uses commit `82d88dc63341e8498b4728e3bd2f3996aa560a5e`. Overnight jobs are separate and still running; their results are not assumed here. No transactions, paid API calls, account creation, wallet generation, or production changes were performed for this brief.

## 1. What to build a company around

**Proposed first offer:** help an agency agree creator payment milestones, reserve the payment, and retain independently signed evidence explaining why each milestone paid or did not pay.

The agency is the buyer; the creator must also find the terms acceptable. Test the hypothesis that this reduces payment uncertainty and manual reconciliation. Neither demand nor willingness to pay is established: `SERVICE.md` and `ITERATIONS.md` explicitly say there have been no customer conversations.

Keep one supported platform/source and a small campaign scope for the first preprod pilot. Do not sell a universal autonomous agent, guaranteed authentic engagement, an audited contract, or a guaranteed business result. The contract can verify a pinned provider's signed answer and a numerical rule; it cannot establish why engagement happened or whether it was valuable.

Suggested positioning, subject to the claims audit:

> Creator Pay reserves a campaign payment and releases agreed milestones when a pinned data provider signs evidence that the condition was met. Both sides can inspect the terms and the receipt. Our prototype runs on testnet; provider accuracy, production safety and customer demand still need validation.

Masumi is a possible distribution and hiring integration, not a prerequisite for testing whether agencies value this workflow. A successful Masumi integration would not itself validate agency demand.

## 2. Current evidence and the most useful next proof

| Area | Evidence inspected | Honest status | Next proof |
|---|---|---|---|
| Campaign settlement | `PROOFS.md`, section "Tranches on chain"; `cardano/CREATOR_PAY.md` | The repository records a short testnet campaign, campaign payout and retention refunds. These transactions were not independently rechecked for this brief. | Job B verifies receipts; then a separate creator checks their own payout address and receipt. |
| Actual deletion and long retention | `PROOFS.md` explicitly says deletion was simulated by unliking, days-long retention and a different person's wallet were untested. | Not verified. | Separate tests for real deletion, provider failure and retention over the promised duration. Never present unliking as a real deletion test. |
| Campaign tooling | `cardano/src/creator-campaign.ts`, three files in `cardano/plans/` | Code supports fixed-size escrow tranches and different windows. This brief inspected code; it did not run the planner. | Job C results, especially malformed plans and boundary times; a product-level recovery rehearsal. |
| Creator identity and content | `cardano/src/creator-intake.ts`, `cardano/CREATOR_PAY.md` | Intake uses provider identity fields; text pinning is optional; a disclosure bypass flag exists. This is not proof the creator controls the payout wallet. | Agency confirms identity, creator confirms address, and both accept the exact pinned content and policy. |
| Masumi | `cardano/MASUMI.md`, `cardano/src/masumi-agent.ts` | Stand-in integration only according to repository evidence. Real registration, payment and seller receipt not verified. | One version-pinned preprod round trip, including seller net receipt and a failure path. |
| Real agent client | `cardano/MCP.md` | Custom protocol test is documented; real desktop-client use not verified. | Job H in a real host with spending disabled, including recovery and refusal behavior. |
| Public judge experience | `cardano/src/judge-site.ts`, `cardano/src/judge-routes.ts` | Separate address-only server exists. Its Blockfrost access credential is distinct from a wallet signing key. Deployed behavior not verified here. | Job E screenshots, input and accessibility results. |
| Security | `AUDIT.md`, `TRUST.md` | Internal threat model and known limits exist; independent audit absent. Job D was stopped by the platform before testing. | Independent Aiken review and regression evidence; no audit-success claim. |

Source receipts are pinned in section 10. Runtime observations from jobs must keep their actual command, version, time and result; source inspection alone is not a passing test.

## 3. Fix the story before adding features

These are documentation discrepancies observed at the inspected commit, not new runtime findings:

1. `README.md:21` says the public site holds "no key of any kind" while also mentioning a Blockfrost key. `cardano/src/judge-site.ts` requires `BLOCKFROST_PROJECT_ID`. Say **no wallet signing keys; uses a provider access credential**. A provider credential can still have quota and operational consequences.
2. `README.md:72` and the freshness answer in `TRUST.md:73` say observation time is not checked. `TRUST.md:55` describes the optional observation-time check for supported feeds. Explain **signature freshness for every supported proof; observation freshness only when the policy and feed include the check**. Job B should reconcile the complete claim against code and receipts.
3. The opening "first contract" claim in `README.md:3` is not established by this repository. A working implementation does not establish historical priority. Use a concrete implementation claim unless independent evidence supports priority.
4. `cardano/CREATOR_PAY.md` describes timing and retention as mitigations for bought engagement. These do not prove that engagement is organic; persistent fake engagement can still qualify. A later measurement checks the later reported count.
5. The source code allows `--no-disclosure`. Describe disclosure checks as the default intake behavior, not an unavoidable on-chain requirement or a legal compliance guarantee. Do not enable that bypass in an agency pilot.

No existing documents were edited. Preserve the historical record while making the current status unambiguous in a later reviewed revision.

## 4. Edge cases that must have an owner and a defined outcome

The following are **proposed acceptance cases**, not claims of passing tests. Jobs B, C, E and H cover parts of them; check their exact results. No new validator tests ran for this brief.

| Case | Expected behavior / decision | Evidence still needed |
|---|---|---|
| Wrong creator, wrong post or wrong payout address | Refuse before locking. Agency approves identity and creator confirms the destination. | Intake tests plus an end-to-end preview review by both parties. |
| Post must exist before its ID is known | State that this workflow currently locks after publication. Do not promise escrow assurance before the creator does any work. | Ask creators whether that timing is acceptable; design a separate pre-commitment if it is not. |
| Bought likes, coordinated activity or legitimate popularity | Report only provider counts. Agency decides whether this metric is an acceptable payment basis. | Customer acceptance and independent fraud signals if needed; no organic-engagement claim. |
| Baseline taken late | Show source, retrieval time and absolute threshold; distinguish total count from incremental target. | A reviewed baseline receipt and frozen campaign terms. |
| Count rises and then falls | Specify whether any in-window observation or a final observation qualifies; do not promise continuous retention from one snapshot. | Product wording matched to actual policy and polling behavior. |
| Correct post but edited text or removed disclosure | For the pilot, use an explicitly approved pinning policy; explain that a benign edit may also stop payment. | Actual edit test and evidence of what the provider signs. |
| Unicode, emoji, escaping or provider field-order changes | Refuse incompatible source shapes; never silently weaken pinning or pay on a different interpretation. | Byte-for-byte fixtures and observed provider stability. |
| Real deletion, private post, unknown post and provider timeout | Distinguish missing evidence from evidence of deletion. Show "could not verify" for an outage. | Separate fixtures/live preprod observations; no deletion claim inferred from a timeout. |
| Platform outage near the deadline | Contract may leave the creator unpaid and allow buyer refund later. Agree that risk before locking. | Rehearsal, alerting and an agreed off-chain support route; no unilateral promise to override escrow. |
| Provider signer changes or is compromised | No automatic signer substitution under an open policy; stop new campaigns and follow a reviewed incident process. | Signer provenance, revocation/rotation plan and customer notice. |
| Fresh signature over an old snapshot | Check observation time when available; reject an unsupported freshness promise. | Source-specific freshness characterization. |
| Budget runs out before a measurement | Warn and stop new promises; show insufficient coverage instead of "condition failed". | Budget-depletion test, alert and campaign admission check. |
| Slow chain confirmation / lost HTTP answer | Treat status as uncertain; reconcile before a retry that could create another escrow. | Timeout-after-settlement rehearsal and stable identifiers. |
| Same payment clicked twice or planner restarted | One campaign ledger tracks every funded tranche and uncertain attempt. | Duplicate-action and restart tests; client recovery evidence. |
| Only some tranches funded | Show partially funded, list exact escrow references, stop safely; never show campaign fully funded. | Recovery from failure between consecutive escrow payments. |
| Final tranche nearly outside the supported deadline | Refuse before any payment; include the measurement window and confirmation margin. | Exact-boundary planner and offer tests. |
| Ephemeral post lifetime | Finish measurement before the post disappears; reject a retention plan beyond that lifetime. | Plan boundary tests and customer agreement on the clock origin. |
| Buyer, payee and refund party overlap | Preview all roles; do not infer a commercial arm's-length transaction from a same-owner demo. | Separate-person test and role validation. |
| Tokens sent to an ADA-only policy or malformed datum | Pilot accepts only the supported asset and a fully recomputed valid policy. | Existing known limitations reviewed; not an arbitrary-token custody claim. |
| Keeper crash, disk full or corrupted state | Recover funded escrows and job decisions without repeating uncertain writes; surface persistence failures. | Restart and persistence-failure tests, backups and reconciliation. |
| Multiple users / agencies | Do not expose one agency's campaign data or accept another agency's controls. Keep the pilot private and supervised. | Authentication, authorization, tenant isolation and privacy review. |
| Public page or post text tells an agent to pay | Treat content as data; require operator authority outside that content. | Real-client prompt-injection and spending-refusal checks, no transaction required. |
| Consumer asks for subjective quality, attribution or disputes | Route to human approval outside this prototype or decline the promise. | A separate product design and customer agreement; not a feature already present. |

### Persistence concern from static code inspection

`cardano/src/masumi-agent.ts:111-119` catches state-file write failures and continues. `/start_job` records state in memory, calls `save()` and then contacts the payment service (`:166-177`). This does not establish durable recording before an external write if the disk write failed. A restart could lose the local reconciliation record. The downstream service may have its own protections, which were not verified here.

Treat this as a **production-readiness concern**, not a demonstrated double charge or contract exploit. Require a failing-storage/restart test and a defined durable-write policy before promising reliable paid operation. Do not change the running demo during the overnight reports.

## 5. An agency pilot that can disprove the idea

### Proposed scope

- One agency, one creator, one supported post/source; supervised preprod first.
- Agree creator identity, payout address, exact text policy, source, metric, baseline, threshold, measurement window, deadline, payout/refund roles and data-outage treatment in plain language.
- Show one accepted case, one rejected modified response and one refund/recovery case using verified evidence. Clearly label replayed evidence, local tests and live actions.
- Present total campaign state and each tranche separately. Fixed 5 tADA units and sequential payments are prototype constraints, not arbitrary campaign budgeting.
- Do not promise automatic dispute resolution, chargebacks, tax handling, jurisdictional compliance, anti-fraud or production availability. Have those reviewed before a commercial launch.

### Discovery: questions for the agency and creator

Ask each party about their last actual campaign before showing features:

1. How were the creator, content, rate and proof approved? Who could authorize payment?
2. What delayed payment or caused a disagreement? What did that incident cost in work or cash?
3. Which outcome is trustworthy enough to determine payment, and who supplies the evidence?
4. Would you accept a partial delivery payment with a separately agreed results bonus? Which part must stay human-approved?
5. What should happen if the source is unavailable or wrong, even though the creator delivered?
6. Will the creator publish before the escrow is funded, as this flow currently requires?
7. Who accepts wallet setup, chain fees, data fees and locked capital? Does anyone require invoices or normal-currency settlement?
8. What current tool or manual process would this replace, and would the decision maker commit to another campaign?

Record exact objections and commitments. A friendly reaction or a judge's interest is not a customer purchase.

### Proposed decision gates, not measured results

Proceed to a second supervised pilot only if both sides can explain the terms, approve the same preview, reconcile all tranche outcomes and choose to use the workflow again. Measure manual interventions, unresolved payment states, data checks per campaign, support time and each party's stated objections. Do not invent conversion rates, ROI, customer counts or satisfaction scores.

Before real funds: independent contract review, critical findings resolved and retested, controlled production key operations, durable recovery, source reliability characterization, appropriate access controls, customer/support agreements and relevant professional legal/accounting review. Incorporation, regulatory status and commercial eligibility have not been assessed here.

## 6. Pricing and pivot decisions

The current success-only keeper price exposes the operator to the cost of unsuccessful campaigns. A growth subsidy is a decision to fund a measured experiment; it is not evidence that future scale fixes the economics.

Use the same settlement unit when estimating: revenue actually collected minus data retrievals, release fees, retry/reconciliation work, infrastructure and support. Testnet ADA and test aUSD costs do not establish euro or mainnet unit economics. Shared source reads can reduce retrieval duplication, but do not remove support and reliability costs.

| Observed objection or result | Candidate response to test | What changes technically |
|---|---|---|
| Agencies value audit trails but reject automatic payout | Offer signed evidence and campaign reconciliation with human payment approval. | Existing signed-proof/evidence work remains useful; approval workflow is not yet a finished product. |
| Creators reject all-or-nothing KPI risk | Human-approved delivery fee plus an optional objective bonus. | Tranche plans are a starting point; a true approval/dispute mechanism requires separate design. |
| Fake engagement dominates | Avoid count-based payout for that customer; use a more directly verifiable event or evidence-only service. | Do not market timing or text pinning as an anti-bot solution. |
| Wallet setup blocks agency adoption | Test demand for conventional billing with a separate evidence service or a suitable settlement partner. | Payment integration, custody and legal questions require new work; not a switch already built. |
| Monitoring costs exceed accepted price | Cap admitted windows, reuse reads, quote a monitoring allowance, or charge a base fee plus optional success fee. | Pricing, metering and billing still need implementation and measurement. |
| Agencies do not value it, but agent sellers do | Revisit Masumi as a first buyer segment only after direct conversations and a real service integration. | Preserve verifier/keeper; change distribution, onboarding and job packaging. |

Do not implement every pivot overnight. Choose based on an observed objection and the smallest next experiment.

## 7. Judge demonstration and recovery script

Suggested sequence; times are presentation planning, not system performance claims:

1. State the agency's problem and the precise prototype promise.
2. Show a human-readable campaign preview: named creator, post, amount, numerical condition, measurement window, deadline and refund party.
3. Show a real signed response accepted and a modified response rejected by the same policy. Explain that a rejection from evaluation is not a failed submitted transaction.
4. Show independently checked release and refund receipts. Explain the short testnet retention demonstration and simulated deletion honestly.
5. Show the public judge bench or read-only agent tools. If the provider is unavailable, label that state and use a dated recording or saved evidence labelled as replayed.
6. Explain the current boundary: provider authenticity is checked; provider accuracy and organic audience quality are still assumptions. State the first agency pilot and the decisions it can change.

Fallback order: live read-only bench -> saved signed vectors with clearly labelled local evaluation if available -> dated recording plus explorer receipts -> a diagram with an explicit unverified status. Never simulate a live receipt or change the expected outcome to make the demo pass.

Hard answers to rehearse:

- **Why a chain?** The prototype places the agreed payment exits in an inspectable contract. If a buyer only wants easier campaign administration, a conventional workflow may serve them better; the pilot must establish that settlement assurance matters.
- **What if the likes are fake?** We do not prove authenticity of the audience. If that is the buying criterion, we need another source/metric or a different product promise.
- **What if the oracle is wrong or down?** A wrong authentic answer can cause a wrong payout. An outage may prevent an earned payout before the deadline. We disclose and agree these risks; there is no built-in human dispute process.
- **Can an agent drain a wallet?** Current MCP spending is disabled by default with explicit opt-in controls in code. A protocol flag alone is not a full multi-user authorization system; the real-client checks and production key model are separate work.
- **Is this a real company yet?** This is a testnet prototype with a proposed customer and pilot. We have not established customer demand, profitable operation, independent audit, incorporation or legal clearance through this work.

## 8. What resources would actually unblock deeper work

No paid purchase is required for this brief or the current offline checks. Do not send passwords, seed phrases or API keys in chat.

| Resource | What it unlocks | Boundary / current status |
|---|---|---|
| Agency decision maker and willing creator | Real discovery and a supervised campaign walkthrough. | Owner makes introductions or authorizes specific outreach; no messages sent by this work. |
| Dedicated Blockfrost **preprod** project credential, entered locally | Independent chain reads/evaluation for a real MCP host and later integration. | No wallet signing key needed for read-only tests. Blockfrost tokens are network-specific. No credential requested or used here. |
| Installed, signed-in MCP desktop client | Evidence that the tools work in an actual host. | User handles login. Spending stays off. A scripted protocol test alone does not close this gap. |
| Version-pinned Masumi service, isolated database and scoped runtime credential | Real integration rather than a stand-in. | Current official README supports a native Node/pnpm/PostgreSQL route. PostgreSQL 18 service and pnpm are present locally, but usable isolated database access and Windows compatibility were not tested. No existing database was changed. |
| Docker Desktop, if choosing container setup | An alternative isolated service setup. | Not established as mandatory by current upstream README. Installation/WSL changes are not needed for this brief and were not performed. |
| New throwaway preprod wallets and test assets | Real registration/payment/seller receipt for a later controlled run. | Original no-secret/no-signing/no-spending rules remain. The owner's general offer of resources is not a specific authorization to generate/store wallet secrets or sign. No wallet was created. |
| Explicit spending ceiling and named purchase | Any later billable infrastructure or independent review. | No blanket spend inferred. Ask against a concrete cost and deliverable when needed. Audit scope and a reviewer quote come before purchase. |

The upstream Masumi README warns that seeding can generate and print wallet mnemonics when blank. Do not run its seed command casually under the overnight secret-handling rules. Inspect and isolate the setup first.

## 9. Immediate work order

1. Read job A before making the repository public. An incomplete scan is not clearance; confirmed leaked credentials need owner-led revocation, regardless of later history cleanup.
2. Resolve the claims audit's wrong lines and incorporate actual test failures into the morning decisions. Keep the demo freeze and review every proposed fix separately.
3. Rehearse the agency flow and the failure/recovery story. Confirm which states are live, previously observed, simulated or not verified.
4. Use H/I prerequisite reports to choose the smallest real-client/integration check. Missing Docker alone does not establish no other route exists, but alternative service setup is not completed by this brief.
5. Book agency and creator discovery. Do not add more sources unless the selected customer's outcome needs one.
6. Commission an independent security review before moving to real funds. Job D remains blocked; this memo does not replace it or imply that its tests ran.

## 10. Sources and verification record

Repository content was inspected at the pinned commit; no runtime tests, blockchain transaction verification or customer interviews were performed for this memo:

- [Creator workflow and disclosed limits](https://github.com/luk-huebner/tum-hack-2026/blob/82d88dc63341e8498b4728e3bd2f3996aa560a5e/cardano/CREATOR_PAY.md)
- [Recorded proof chronology](https://github.com/luk-huebner/tum-hack-2026/blob/82d88dc63341e8498b4728e3bd2f3996aa560a5e/PROOFS.md)
- [Trust assumptions and known gaps](https://github.com/luk-huebner/tum-hack-2026/blob/82d88dc63341e8498b4728e3bd2f3996aa560a5e/TRUST.md)
- [Business hypotheses](https://github.com/luk-huebner/tum-hack-2026/blob/82d88dc63341e8498b4728e3bd2f3996aa560a5e/SERVICE.md), [iteration history and untested market](https://github.com/luk-huebner/tum-hack-2026/blob/82d88dc63341e8498b4728e3bd2f3996aa560a5e/ITERATIONS.md)
- [Planner](https://github.com/luk-huebner/tum-hack-2026/blob/82d88dc63341e8498b4728e3bd2f3996aa560a5e/cardano/src/creator-campaign.ts), [intake](https://github.com/luk-huebner/tum-hack-2026/blob/82d88dc63341e8498b4728e3bd2f3996aa560a5e/cardano/src/creator-intake.ts), [Masumi state persistence](https://github.com/luk-huebner/tum-hack-2026/blob/82d88dc63341e8498b4728e3bd2f3996aa560a5e/cardano/src/masumi-agent.ts#L111), [public judge server](https://github.com/luk-huebner/tum-hack-2026/blob/82d88dc63341e8498b4728e3bd2f3996aa560a5e/cardano/src/judge-site.ts)
- [Masumi upstream README](https://github.com/masumi-network/masumi-payment-service/blob/main/README.md), fetched 31 October 2026, README blob SHA `9e9671d80812a77c563347cd167059ca81a80761`. Describes native setup; that setup was not run here.
- [Masumi hackathon starter](https://github.com/masumi-network/tum-hackathon-quickstart/blob/main/README.md), fetched 31 October 2026, README blob SHA `afc45021fbbb84a337b98bd8eb1684075ba4bca9`. Requires independent runtime/client/payment evidence; its dependencies are not asserted to be this repository's dependencies.
- [Blockfrost network/token documentation](https://blockfrost.dev/start-building), checked 31 October 2026.
- [Docker Windows installation documentation](https://docs.docker.com/desktop/setup/install/windows-install/), checked 31 October 2026, only as an optional resource reference.

Local commands were limited to cloning an isolated repository, inspecting files, checking tool/service presence, and preparing this new report. Existing project secrets, wallets, database contents and credentials were not read. The PostgreSQL service presence check does not prove working access or a compatible Masumi deployment.

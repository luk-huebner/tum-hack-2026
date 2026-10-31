# README as a stranger

**Run window:** 2026-10-31 00:44 to 01:18 CET (Europe/Berlin), corresponding to 2026-10-30 23:44 to 2026-10-31 00:18 UTC, about 34 minutes. The first README pass happened in the first few minutes. This is one reader session, not a separately timed human study.

## What I understood after the first two-minute pass

Pay-on-Proof puts a buyer’s test ADA in a Cardano contract. The contract pays a seller only if signed data from an outside service meets a rule chosen in advance; after a deadline, the buyer can reclaim the funds. A keeper can fetch the signed data and submit the release. The examples are creator likes and rainfall. This is conditional payment for outcomes that a data source can measure, rather than proof that an agent did good work.

The README also signals that this is a hackathon prototype: it says testnets only and not audited, and lists a previous contract flaw that the team says it fixed. I would want an easy read-only way to see the demo before being asked to set up a wallet.

## What stayed unclear

- Which project is the starting point? The repository root describes Pay-on-Proof and says `npm run service`; `cardano/README.md` describes a separate x402 starter and says `npm run demo`. The root package has no `service` script. A newcomer can follow the root to a command that fails, then discover a different quickstart nested below.
- What can I try without funding a wallet, entering credentials, or paying for data? The public judge site can answer that, but the root README does not put it first. The local service’s public route still needs a public preprod address and facilitator URL; the judge page needs a Blockfrost project id and address.
- Is the first, longest “What works today” list describing the current validator throughout? `PROOFS.md` says many earlier receipts refer to the first validator, which had a double-satisfaction flaw; readers must find later sections to learn which evidence applies to the current version.
- What does “first contract on Cardano” mean, and what comparison supports that claim? The README gives no scope or source for the superlative.
- Which actions only simulate a release and which actually submit a transaction? Some README wording distinguishes them, but a new user has to follow several links to understand the difference. The included `cardano/README.md` quickstart explicitly submits a payment and says the buyer pays.
- Are the two repositories’ versions of the demo equivalent? The root service is a Pay-on-Proof console; the nested README is a minimal seller/buyer payment starter. Their relationship is not stated.
- Why do some signatures authenticate data whose underlying observation time is not checked? The README names this limit, but does not explain that only feeds that include an observation time can use that check.

## Terms that need a plain-language explanation

- **Cardano:** the blockchain network where this prototype’s contract runs.
- **Preprod:** Cardano’s public test network. Its ADA is test currency and has no intended real-world value.
- **Base Sepolia:** a public Ethereum-compatible test network used here to pay some data providers in test tokens.
- **Smart contract / validator:** a program the blockchain runs to decide whether locked funds may be paid or refunded.
- **UTxO:** an unspent transaction output: a specific chunk of blockchain value that can be spent once. The contract holds a UTxO with the rule attached.
- **Datum / inline datum:** the rule and parties’ public identifiers stored alongside the locked output.
- **Lovelace / tADA:** Cardano’s smallest ADA unit; 1 ADA is 1,000,000 lovelace. “tADA” means test ADA.
- **Aiken / Plutus V3:** the language and on-chain program format used to build the validator.
- **Airnode / AirnodeHub:** API3’s service that obtains an API answer and signs a message containing it.
- **API3:** the project providing the Airnode data-signing system in this prototype.
- **Oracle:** a service that brings information from outside a blockchain onto it. A signature authenticates what the oracle reported; it does not prove the report is true.
- **Attestation:** the signed answer and related request/time information from an Airnode.
- **Signer / pinned key:** the public key a policy trusts to check the answer’s signature.
- **Request hash:** a fingerprint of the question asked, used to reject a signed answer to a different question.
- **x402:** an HTTP payment pattern where a server returns payment requirements and a client retries with payment proof. Explain who submits and who pays network fees in this Cardano version.
- **Facilitator:** the service that checks and settles an x402 payment. The repo says it can refuse to broadcast but cannot change a buyer-signed payment.
- **Escrow / conditional payment:** the funds sit in the validator until its rule permits a payout or the deadline permits a refund.
- **Keeper:** software that watches policies, fetches fresh signed answers and submits a release when a rule is met. It spends its operator’s fees and may spend a capped amount on paid data.
- **Beneficiary / refund party:** the public key allowed to receive a successful payout / the key allowed to reclaim funds after the deadline.
- **Threshold / rule:** the numeric condition, such as rainfall below 30 mm or likes at least 300,000.
- **Datum recomputation:** the buyer checks that the policy sent by the seller matches the terms the buyer intended before paying.
- **Tamper bench / evaluation:** attempts to check a response with the validator without submitting the transaction. Make this distinction visible before the button.
- **MCP:** Model Context Protocol, a way for an AI application to call named tools exposed by a server.
- **Masumi / MIP-003:** an agent marketplace/payment interface and its job API. The README says this integration was tested against a stand-in, not a real payment service.
- **aUSD / tUSDM:** test stable-token names used for paid data calls / Masumi examples. State which network and whether a step spends any.
- **Observation time / signed time:** when a source measured a value / when the Airnode signed the answer. They are different; the current observation check only applies when the feed signs an observation time.

## Steps attempted and outcomes

1. Read `README.md`, then the requested background files `TRUST.md`, `PROOFS.md`, `AUDIT.md` and `ITERATIONS.md`, and checked the referenced package and service scripts. The root README is long (77 lines), with a compact first screen followed by a substantial feature inventory and a technically detailed flow. The evidence documents disclose substantial limitations and distinguish historical validator versions, but a newcomer must reconcile that context themselves.
2. Checked the root’s documented `npm run service`. **Failed:** npm reports `Missing script: "service"` in the root package. The root package only defines price, vector and paid checks. The service package is under `cardano/`.
3. Checked Node. The host had Node 22.14.0 while the root README requires Node 24. Downloaded the official portable Node 24.22.2 x64 ZIP into the job’s ignored `work/tools` area, verified it against the official published SHA-256, and used that local binary. No system-wide setting changed.
4. Installed `cardano/` dependencies with Node 24 using `npm ci --ignore-scripts --no-audit --no-fund`. It completed successfully. `node_modules` and npm cache are local and untracked; existing package manifests and lockfiles were not changed.
5. Tried the actual `cardano/` service command with the clean environment. **Blocked as expected:** it exits with “Set SELLER_ADDRESS to a preprod address … and FACILITATOR_URL in cardano/.env”. The local service cannot start without configuration. I did not create or inspect a `.env`, request credentials, or run the wallet script. The job specifically forbids accounts, test-ADA spending and key handling.
6. Opened `https://pay-on-proof-judge.vercel.app` in a new Chrome tab labelled Overnight F. The public console loaded without login. Its Overview describes the buyer/seller problem and conditional payout more plainly than the README. Its Live tab read two open 5 tADA test policies and showed the keeper off and no recent jobs. This is a read-only display of testnet state.
7. Ran the page’s six-step Tamper bench. **Verified 6/6:** real control accepted; edited value, stale response, different request and foreign signer rejected; final real control accepted. The page says these are unsigned evaluations and nothing is sent to the chain. No transaction was signed or submitted.
8. Read the Evidence tab and selected “Not shown yet / limits.” It still says a public judge URL is on the build list even though this page is live at that URL. This is stale public-facing evidence copy. No source files were changed under this job’s restrictions.
9. Checked browser console warnings/errors; none were returned for this tab. The live-board click had a brief automation timeout, then the refreshed page showed the Live tab and the two policies correctly; the evidence-tab action also worked.

## Rewrite of the first screen (top 15 lines)

This replaces the opening for review; it has not been applied to `README.md`.

```markdown
# Pay-on-Proof

Pay for a result only when signed data shows it happened.

A buyer locks test ADA in a Cardano contract. If a trusted data service reports that an agreed goal was met by the deadline, the seller can collect it. If not, the buyer can reclaim it after the deadline.

Try the read-only demo: [Open the judge console](https://pay-on-proof-judge.vercel.app). Its tamper test checks real and altered data without sending a transaction or spending tokens.

This is a hackathon prototype on public test networks. It is not audited, and a data signature proves what a provider said, not that the data is true. Do not use real funds.

For local development, start in `cardano/` and follow [the judge guide](cardano/JUDGES.md). Local configuration depends on the selected server; payment and wallet demos require additional setup.
```

## Coverage and limits

**Verified here:** the repository root’s missing script, dependency install for `cardano/` on Node 24, expected no-configuration service failure, public Chrome console, read-only live board, six public validator evaluations, and the stale Evidence-tab statement.

**Not verified:** a running local console, because its documented service requires configuration not provided and forbidden to create; Aiken tests, because Aiken is unavailable on this host and no CI run was triggered; wallet/payment flows, live data purchases, account setup, and transaction submission. Existing historical claims in repository docs were read as project documentation, not independently re-run. The public judge site’s hosting costs were not checked; no deployment or paid service was invoked.

**Secret scan:** the tracked base tree was scanned before checkout for common key/seed patterns and sensitive filenames; it reported no matches. This is a pattern scan, not proof that no secret exists. No local owner files or tracked `.env` were read; the only tracked environment template is `.env.example`.

**Delivery after interruption:** The coordinator corrected contradictory timestamps in this draft and published the existing evidence. No checks were rerun during delivery. Technical observations ended at about 01:18 CET; report publication happened afterward. Historical Saturday deadlines were not used to delay or backdate this check.

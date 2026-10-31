# CreatorPay code and security review

Scope: supplied ZIP, Cardano Preprod and Base Sepolia test aUSD only. No transactions submitted or paid API calls made during this review. No core Aiken code or committed blueprint changed. This is not an external audit certification.

## Versions and build identity

| Version | Script hash | Finding |
|---|---|---|
| Archived v1 | `a9e4420cc2b611c46a8a0c1f5413f9ce4b6be47c7974e8509171b11c` | Vulnerable to shared-output double satisfaction; 16-field policy, no observation check |
| Current v2 | `58fb7eefb61d968668106385cf7a7dc8e8591004162a81c6b50562ea` | Single same-validator input; full locked ADA paid; 18-field policy |

Aiken v1.1.24 official archive checksum verified. `aiken build` produced exactly the committed current bytecode and hash. The archive contains the old compiled blueprint, not a separate old Aiken source tree. Old behavior is documented/evaluation evidence; this review freshly reran the current regression tests, not a fresh v1 network attack.

`cardano/src/engine.ts` loads `aiken/blueprint/plutus.json` by default and checks blake2b-224(language-tag 03 || compiled bytes) against its hash. All transaction builders import this shared engine. `VALIDATOR_BLUEPRINT` can intentionally select v1 for historical testing/refunds; do not set it for a new demo. `standing-policies-v1.json`, `out/lock.json`, `out/creator-lock.json`, `out/keeper-policy.json` retain legacy references. Selecting the current blueprint cannot spend old-script outputs. Re-locking requires approval and does not migrate old outputs.

## Enforcement matrix

| Check | Code and result |
|---|---|
| EIP-191, Keccak, secp256k1 | `lib/airnode.ak:17–48`; hash and real signature/tamper vectors pass |
| Exact reconstruction and request/key pin | `lib/engine.ak:154–248`; policy fragments and request hash drive verification, never a backend boolean |
| Freshness / observation | `lib/engine.ak:193–248`; signature time and optional observed-time age separately checked |
| Deadline / finite interval | `validators/pay_on_proof.ak:21`, `lib/engine.ak:236`; both finite, release upper <= deadline, refund lower >= deadline |
| Payout / surplus ADA | `validators/pay_on_proof.ak:27,74`; a single beneficiary-key output must pay max(payout, own input lovelace) |
| Double satisfaction | `validators/pay_on_proof.ak:41,77`; counts all inputs at the same payment credential, so alternate stake credentials cannot bypass it; even fully paid same-script batching is refused |
| Refund | `validators/pay_on_proof.ak:82`; required refund signer plus time, no output constraint. Ledger signature verification complements script evaluation |
| Consumption / replay | Ledger spends the original UTxO once. A proof can be reused across separately funded matching policies; not globally single-use |
| Datum integrity | Ledger input datum is authoritative. Buyer re-derives offer datum in `escrow.ts:158`; sending to a script address does not validate the new datum |
| Malformed inputs | Missing datum / wrong constructor / malformed cryptographic inputs halt or fail decoding. Exact bytes needed; invalid decimal syntax fails. Existing suite is not exhaustive fuzzing |
| Fees | Release preserves all locked ADA, requiring other inputs for fee. Refund may consume fees from escrow (observed). Collateral inputs/return are separate from ordinary successful outputs |
| Confirmation | New journal retains hash before broadcast; a timeout becomes unknown, then chain is queried. “Rejected” is never inferred from timeout |

## Findings, reproduction, impact and disposition

Line references in this section refer to the original attached source unless explicitly identified as new.

| ID / severity | Exact location | Reproduction / realistic impact | Fix and testnet relevance |
|---|---|---|---|
| S1 High, legacy only | `aiken/blueprint/plutus-v1-a9e4420c.json:1`; current guard `validators/pay_on_proof.ak:41` | Spend two v1 policies for the same key, supply one 5 ADA output, retain the other 5. Historical evaluation accepted it; never a submitted exploit. | Current guard independently passes regression tests. Keep v1 clearly labelled, avoid funding it; 40 tADA remains there at snapshot. No v2 core change needed. |
| S2 Medium, fixed | `cardano/src/escrow-client.ts:173,183` (original) | Drop response, or let keeper spend before datum scan; scan sees no open output and prints “nothing was charged.” Retrying may fund another escrow. | Hash journal before facilitator handoff; unknown wording, recovery on all transport failures, valid receipt checks. Applies directly to demo. Stable business-intent deduplication across separately restarted funding commands is still absent: reconcile before paying again. |
| S3 Medium, fixed | `cardano/src/autorelease.ts:115,170,290`; `keeper.ts:186` (original) | Restart after submission, lose in-memory pending map; retry already spent input. A disappearing UTxO was incorrectly attributed to own release; catch labelled errors “on-chain-rejected.” | Durable submission journal, retry suppression/reconciliation, neutral error wording. Regression tests cover timeout and delayed confirmation. Ledger always prevents double spending the same escrow. |
| S4 Medium, scope limit | `validators/pay_on_proof.ak:75,79` | Lock ADA plus native assets; release can pay ADA while routing tokens elsewhere. | ADA-only templates and testnet scope retained. Native tokens are not protected; do not use them for this demo. No speculative validator migration. |
| S5 Medium, configuration | `validators/pay_on_proof.ak:67`; `cardano/src/engine.ts:47` policy encoder | Send an invalid/missing datum directly: decoding may prevent both exits. Or pin the wrong signing key/rule and later fail release. | Buyer `checkRequirement` verifies locally expected full datum; 54 dishonest offers rejected. Does not protect arbitrary direct deposits or compromised local source definitions. |
| S6 Low, retained | `validators/pay_on_proof.ak:31` | Pay enterprise address with beneficiary's payment key instead of their base/stake address. Payment is spendable by that key but may be absent in wallet address view. | Explain and inspect enterprise payout address. Do not equate wallet display with missing payment. |
| S7 Low, script boundary | `lib/engine.ak:239`; `validators/pay_on_proof.ak:84` | At abstract lower=upper=deadline both branches can return true. Ledger interval/slot representation may make that exact zero-width interval unusable. | Do not claim a demonstrated chain exploit; ledger permits only one spend. Existing off-chain margins avoid boundary. No core change. |
| S8 Medium, trust/liveness | `cardano/src/register-source.ts:63`; `checks/05-make-vector.mjs:15`; `lib/engine.ak:200` | Trust a spoofed listing/endpoint or use a recently signed old snapshot with no observation slot. Signature still authenticates that source's statement. | Out-of-band key/source approval and disclose API snapshot coverage. Creator/Twitter observation freshness is not guaranteed. No new registry needed. |
| S9 Low, residual operational | new `cardano/src/tx-tracking.ts:53`; `autorelease.ts:187` | Provider outage leaves unknown pending record and pauses that escrow. Multiple independent processes/wallets can race, journal is not a distributed lock. | Favor no duplicate attempts over liveness; one keeper per wallet, inspect journal and chain. No exactly-once campaign-funding guarantee. Rejected state is reserved for authoritative evidence, not generic errors. |

Cross-validator shared-output satisfaction is not prevented globally: the v2 guard counts its own script credential, not every other contract. Mixing v1/v2 escrows or unrelated scripts in adversarial batches is outside the one-v2-input proof; do not use legacy contracts as if patched. Existing builders spend one escrow. Refund authorization gives the refund key discretion over outputs; older prose claiming the contract forces refund to a particular address is inaccurate.

## Necessary code changes

Shared `tx-tracking.ts` records built/submission-attempt/submitted/confirmed/unknown/expired states, network, operation, campaign (nullable), exact escrow refs, timestamps, block details and explorer URL. It writes and fsyncs before network submission. No signed transaction or key is logged. All 15 direct SDK submission sites use the helper; the four x402 buyer-side builders record the signed-body hash before handing it to the facilitator. A facilitator receipt alone remains submitted, not confirmed. Included phase-2 failures are marked rejected with their block information, not reported as successful payouts. Generic transport errors are kept unknown; a provider 404 plus tip past TTL marks expired with an indexing caveat.

`engine.waitForTx` now reconciles the journal, including a final query at timeout. Autorelease consults persistent pending records after restart, rather than relying solely on its map. A disappearing UTxO no longer proves its own submitted hash landed. The campaign planner passes a non-sensitive campaign hash to children. `history.ts` is a read-only chain query/local-journal command, with a separate archived-evidence mode.

Optional `CREATORPAY_METADATA=1` attaches CIP-20 label 674 messages to the shared release builder and refund CLI: project, action, Preprod and exact configured script hash. Every string is <=64 UTF-8 bytes. It leaves validator rules unchanged, increases transaction bytes/fees slightly, and does not retrofit history. Third-party x402 funding metadata was not altered. No campaign personal data is included.

See `CHANGES.md` for the exact modified-file inventory and `creatorpay-audit.patch` for the source diff. SDK helpers were inspected locally rather than guessed.

## Tests executed

From repository root unless stated otherwise:

```
# Download official v1.1.24, verify published SHA-256, extract; then:
cd aiken/airnode_spike
aiken check
aiken build
# Compare validators[0].compiledCode/hash with ../../aiken/blueprint/plutus.json from repo root.
cd ../../cardano
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
SELLER_ADDRESS=<public seller address from PROOFS.md> node --import tsx src/attack-offline.ts
node --import tsx scripts/masumi-test.ts
node --import tsx src/poll-sim.ts
node --import tsx --test scripts/tracking-test.ts
cd ..
npm ci --ignore-scripts --no-audit --no-fund
mkdir -p checks/out
node checks/01-vector.mjs
```

Results: 78 Aiken tests pass, build byte-for-byte matches current blueprint; TypeScript passes; 54 dishonest price lists refused and controls accepted; Masumi stand-in test passes (23 checks); polling simulation executes; 6 new tracking tests pass; signature-vector script executes. Logs are in `audit-evidence/`.

`node scripts/mcp-test.mjs` was attempted: its tsx subprocess failed with EPERM opening `/tmp/tsx-0/64.pipe`, before protocol checks. It also requires authenticated chain access for its live checks; no credentials were present. Do not claim the prior 14-check run was freshly reproduced. Paid-call scripts, faucet/mint, live release, refund submissions and network attack scripts requiring wallet/fresh paid data were not executed because they may spend or require credentials. Aiken malformed-input coverage is finite; no formal proof, fuzz campaign, high-s test or fresh v1 attack was performed. New tracking/metadata code was not broadcast-tested, per the explicit approval requirement.

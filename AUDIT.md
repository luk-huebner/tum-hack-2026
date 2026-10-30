# Audit preparation for the Pay-on-Proof validator

**Status: not audited.** This is the authors' own review, done with an AI coding assistant, written so that an independent reviewer can start quickly and so that nothing is hidden. It is also the honest answer to "does this deserve an audit": the contract is small, it holds funds, and we found a real flaw in our own first version by attacking it. Test funds only.

- Current validator: `pay_on_proof`, Plutus V3, script hash `58fb7eefb61d968668106385cf7a7dc8e8591004162a81c6b50562ea`, 2,317 bytes, Aiken v1.1.24, stdlib v4.0.0.
- First version (kept as evidence, flawed): `a9e4420cc2b611c46a8a0c1f5413f9ce4b6be47c7974e8509171b11c`.
- Tests: **73, all passing in CI** (`.github/workflows/aiken.yml`). Receipts of everything that ran on chain: `PROOFS.md`. Trust assumptions and known gaps in plain language: `TRUST.md`.

## 1. Scope

| In scope | Files |
|---|---|
| The validator | `aiken/airnode_spike/validators/pay_on_proof.ak` |
| The engine: policy type, signed-text rebuild, decimal parsing, the release check | `aiken/airnode_spike/lib/engine.ak` |
| The attestation check (EIP-191 hash and secp256k1 verification) | `aiken/airnode_spike/lib/airnode.ak` |
| Tests, with real signed AirnodeHub responses as vectors | `lib/*.test.ak`, `validators/pay_on_proof.ak` (tests at the bottom), `lib/vectors/` |
| Off-chain code, for context only, not reviewed in depth | `cardano/src/` (`proof.ts`, `escrow.ts`, `autorelease.ts`, `engine.ts`) |

## 2. What the validator does

One spend validator. The datum is a `Policy` (18 fields): the data provider's compressed secp256k1 key, the request hash, the signed-text template (prefix, separators, suffix), the decimal scale, the slot range summed, the comparison (`Below` or `AtLeast`), the threshold, `settle_after_ms`, `deadline_ms`, `max_age_ms`, the beneficiary and refund key hashes, the payout in lovelace, and an optional observation-time slot and maximum age.

**`Release { timestamp, slots, signature }`** passes only if all hold:
1. the transaction spends **exactly one** input at this validator's credential (closes double satisfaction), and its own input is found by its output reference;
2. `engine.release_ok`: the slot count matches the template; the slot range is valid; `signed_ms >= settle_after`; `signed_ms <= lower_ms`; `upper_ms <= signed_ms + max_age`; `upper_ms <= deadline`; the signature verifies over `keccak256(request_hash ++ uint256(timestamp) ++ rebuilt_signed_text)` under the pinned key; the observation check passes (if the policy has one); the rule holds on the parsed slots;
3. some output pays `max(payout, locked lovelace)` to a **verification-key** credential equal to the beneficiary.

**`Refund`** passes if `lower_ms >= deadline_ms` and the refund party's key is among the required signers. It puts no condition on outputs.

Anything else (other script purposes, a missing datum) halts. Both validity bounds must be finite or the script halts.

## 3. Assets, actors, trust

- **Asset:** lovelace locked at the validator by a funder (the buyer). Our templates lock ADA only, exactly the payout.
- **Funder:** writes the datum. Everything in the policy is the funder's choice. The beneficiary and any third party must read the datum before relying on it.
- **Beneficiary:** is paid on a valid release. **Refund party:** may take the money back after the deadline, not before.
- **Anyone** may submit a release (a user, a keeper, an agent). The contract needs no trust in the submitter.
- **Trusted:** the data provider's signing key and what it signs (a signature proves what the API returned, not that it is true); the Cardano ledger and its time-to-slot conversion; the compiler and standard library.
- **Not trusted:** the submitter, the keeper, the facilitator (it can refuse to broadcast, not change a signed payment), the seller's server (the buyer's client re-derives the datum).

## 4. Threat model

| # | Threat | Defence | Evidence | Residual |
|---|---|---|---|---|
| T1 | A release that keeps the money or pays another key | `pays` checks a verification-key output for the beneficiary | contract tests; on-chain evaluation (`attacks.ts`) | none known |
| T2 | Underpaying the beneficiary | `max(payout, locked)` | contract tests, evaluation (4.9 tADA, 5 tADA minus a lovelace) | none |
| T3 | Taking value locked above the payout | the beneficiary must receive everything locked | contract tests (`value_locked_above_the_payout...`) | **native tokens in the UTxO are not protected** |
| T4 | **Double satisfaction**: two policies of one beneficiary, one payment | one input of this validator per release | found by our attack matrix on the first version; same attack accepted there and refused here (`PROOFS.md`) | none known |
| T5 | Edited signed data | the signed text is rebuilt from the submitted slots and the signature is checked over it | tamper bench, contract tests | compromise of the provider's key |
| T6 | Wrong signer, wrong request | both pinned in the datum | bench, tests | none |
| T7 | Stale data | `max_age`, `settle_after`, optional observation age | tests with real signed vectors | observation time only for feeds that sign one |
| T8 | Data from the future | `signed_ms <= lower_ms` | test | none |
| T9 | Release after the deadline | `upper_ms <= deadline_ms` | test | the **exact deadline instant** (see F5) |
| T10 | Early refund, or refund by the wrong party | `lower_ms >= deadline`, refund party must sign | tests; on-chain evaluation; real refund | the evaluator reads the required-signers list, the ledger checks signatures |
| T11 | Replay of a response | a response is public data, not bound to a policy; one policy pays once because its UTxO is spent | by design | the same response may release every policy that pins the same request within its age limit |
| T12 | Funds locked with a bad or missing datum | **cannot be prevented on chain**: anyone can send funds to a script address with any datum, and such funds can never be spent | tests document the halt | the buyer's client recomputes the datum (54 dishonest price lists refused) |
| T13 | Data provider wrong or compromised | out of scope | `TRUST.md` | trust assumption |
| T14 | Other script purposes (mint, withdraw, publish) with this hash | `else(_) fail` | by construction | none |
| T15 | Exhausting execution budget with attacker-chosen slot text | bounded by transaction size; measured cost below | on-chain numbers | a malformed slot halts only the attacker's own transaction |
| T16 | Keeper griefing: policies that name the service as beneficiary | off-chain: the watcher's aUSD cap, one release per cycle | `autorelease.ts` | spam costs the service small fees; it also receives the money |

## 5. Classic Cardano / Plutus flaw checklist

| Flaw | Status |
|---|---|
| Double satisfaction | **Closed** (T4). It was real in the first version |
| Unbounded value and token dust in the UTxO | **Lovelace closed, tokens open** (T3): our policies hold ADA only |
| Datum hijacking (continuing outputs with attacker datums) | N/A: the validator creates no continuing output |
| Spoofed inputs / unauthenticated reference data | N/A: it uses its own input's datum; no reference inputs are read |
| Open-ended validity intervals | **Closed**: `bounds` halts unless both ends are finite |
| Time handling at the edges | Tested at the boundaries; **one instant open** (F5) |
| Stake credential of the payout address | **Open, low, accepted** (F4) |
| Missing signature check | Refund requires the refund key; release deliberately needs none (it only pays the beneficiary) |
| Arbitrary redeemer data | Slots and signature are checked by rebuilding and verifying; a bad slot halts |
| Other redeemers or purposes | `else(_) fail` |
| Minimum ADA | Payouts are 5 tADA; a payout below minimum would only fail the submitter's transaction |
| Large datum | 206 bytes inline |
| Signature malleability | We do not rely on signature uniqueness (a release is identified by its UTxO). Whether the builtin accepts a high-s variant is a **question for the reviewer** |

## 6. Findings log (what we found, in order)

| # | Finding | State |
|---|---|---|
| F1 | **Double satisfaction** in the first validator: one payment satisfied two policies, the submitter kept the second | Found by an on-chain evaluation attack, confirmed (`0x0b618703...`, fresh signed response), **fixed** in `58fb7eef...`, regression test |
| F2 | Value locked above `payout` could be taken by the submitter | **Fixed** (same revision); native tokens still unprotected |
| F3 | The contract checked when the data was signed, not when it was observed | **Fixed for feeds that sign an observation time** (the Nodary `updatedAt`); not for rainfall or tweets, which sign none |
| F4 | The stake part of the payout address is not checked: the release builder picks it. The beneficiary keeps spending control through the payment key; staking rewards and wallet visibility are not guaranteed. Our own releases pay an enterprise address, which a wallet that tracks only base addresses may not list | **Open, low. Accepted and left documented** (owner's decision, 30 Oct): the amounts at stake are small and a new validator would move every policy. Fix if ever needed: store the full beneficiary address in the datum and require it exactly (a new validator) |
| F5 | At exactly the deadline instant (lower = upper = deadline) both a release and a refund are valid. They are different transactions on one UTxO, so one wins | **Open, low. Accepted and left documented** (owner's decision, 30 Oct). Pinned by two tests. Fix if ever needed: make the release bound strict (`upper < deadline`) |
| F6 | A bad or missing datum strands funds forever | **Inherent** to script addresses; mitigated off chain |
| F7 | The beneficiary can only be a key hash: no script, multisig or DAO payout | Design limit |
| F8 | A buyer can be told a payment failed when it settled (HTTP 402 after 61 s, escrow on chain) | Off-chain; the buyer clients now look for the escrow by its datum |
| F9 | Our standing judge bench was released by the seller's own keeper because it named the seller key | Off-chain, fixed by naming another key; recorded because it shows the keeper acts on every policy that pays it |

## 7. Execution cost (measured on preprod, current validator)

Protocol limits per transaction: 17,500,000 memory units, 10,000,000,000 steps.

| Transaction | Memory | Steps | Fee |
|---|---|---|---|
| Release, ETH/USD price (2 slots signed, 1 summed) | 470,292 (2.7%) | 205,218,513 (2.1%) | 0.042 tADA for the script |
| Release, tweet likes (4 slots parsed) | 321,622 (1.8%) | 160,609,110 (1.6%) | 0.030 tADA |
| Release, rainfall (14 slots summed) | 1,058,208 (6.0%) | 369,090,640 (3.7%) | 0.088 tADA |
| Refund | 49,567 (0.3%) | 17,652,677 (0.2%) | 0.004 tADA |

## 8. Tests

73 tests: attestation (hash and signature vectors, four tamper cases), engine (decimal parsing edge cases, the rule, time bounds, a real Open-Meteo vector, a real Nodary vector with the observation check, a real LunarCrush YouTube vector), and the validator (release and refund paths, redirect, underpay, surplus, double satisfaction with and without payment, inputs of other scripts, input order, script and stake credentials, the deadline instant, missing datum). All use real signed vectors where a signature is involved.

**Gaps:** no property-based or fuzz tests (stdlib v4.0.0 as pinned has no fuzzer module); no formal verification; no external review; the off-chain code is tested end to end on chain but has no unit tests of its own beyond the attack scripts.

## 9. Questions we would put to a reviewer

1. `airnode.verify_attestation`: the 65-byte Airnode signature is cut to its first 64 bytes (r and s) and checked with `verify_ecdsa_signature` against a compressed key. Is dropping `v` safe here, and does the builtin accept high-s signatures?
2. `engine.rebuild` and `parse_scaled`: any input that makes the rebuilt text equal the signed text while parsing differently from what the signer meant (leading zeros, a second dot, huge slot counts)?
3. Is the strict finite-bounds `expect` the right failure mode, or should an open bound be a clean `False`?
4. F4 and F5: is it worth a new validator to close them, given the amounts at stake?
5. Anything about `only_input_here` that a batching transaction with other scripts could abuse?

## 10. Reproduce

```bash
cd aiken/airnode_spike && aiken check            # needs Aiken v1.1.24 on x86; CI runs it on every push
cd cardano && npm install
npx tsx src/attack-offline.ts                     # no network: lying price lists
npx tsx src/attacks.ts                            # evaluation only: redirect, underpay, anyone may submit
npx tsx src/attacks.ts --fresh <response.json>    # adds double satisfaction (0.1 aUSD for a fresh response)
VALIDATOR_BLUEPRINT=../aiken/blueprint/plutus-v1-a9e4420c.json npx tsx src/attacks.ts --fresh <file> --standing standing-policies-v1.json   # the same attack on the first version
```

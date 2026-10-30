# What Pay-on-Proof proves, who can do what, and what it does not cover

Testnets only (Cardano preprod, Base Sepolia). Not audited. Every result below was run; the command or the transaction is named next to it. What was not run is marked.

## 1. What the contract proves

| Level | Question | Answered by the contract? |
|---|---|---|
| Authenticity | Did the pinned data provider's key sign this exact answer to this exact request? | **Yes.** Pinned signer key, pinned request hash, the signed text rebuilt byte for byte from the submitted values, secp256k1 signature checked on chain |
| Condition | Does the signed answer meet the rule agreed in advance, and is it recent and in time? | **Yes.** A sum of numeric slots below or at least a threshold; not signed in the future, not older than the policy's limit, after the data window settled, before the deadline |
| Task completion | Did a hired agent actually do the work? | **Only when the work's outcome is what the data source measures.** A signed like count proves what the provider reported, not that the agent earned the likes legitimately |

So Pay-on-Proof is **conditional settlement for outcomes that independent data can verify**: pay for the result, not for the effort. It does not verify AI reasoning, quality or intent.

## 2. Who can do what

Every row names where it was shown. "Evaluation" means the node provider ran the validator on a built transaction that was never submitted.

| Actor | Action | Allowed? | Shown by |
|---|---|---|---|
| Anyone (buyer, seller, a third wallet, a keeper) | Release a policy with a valid, fresh, matching response, paying the beneficiary in full | Yes | Releases `0a2b24dd…`, `b266fc38…`, `076de3e1…`, `d4d63369…`; evaluation with three different wallets (`cardano/src/attacks.ts`) |
| Anyone | Release and keep the money (pay nobody, or pay another key) | **No, for one policy.** For two policies of the same beneficiary in one transaction, see section 4: **currently possible** | `attacks.ts`: single-policy cases refused; the two-policy case accepted |
| Anyone | Release and pay the beneficiary less than the payout (4.9 tADA, 5 tADA minus a lovelace) | **No** | `attacks.ts`: both refused |
| Anyone | Release with an edited value, a different request, a different signer, or a response older than the policy allows | **No** | The judge bench: `cardano/JUDGES.md`, page at `/` |
| Anyone | Release after the deadline | No, by the code (`upper <= deadline`) | Contract tests in CI; **not run on chain** |
| Refund party | Refund after the deadline | Yes | `1057e1d9…0d1d`, `b338476f…` |
| Refund party | Refund before the deadline | **No** | Same UTxO refused 343 s early, then refunded after the deadline (`PROOFS.md`) |
| Anyone else, including the beneficiary | Refund (not listing the refund party as signer) | **No** | `attacks.ts --expired`: no signer, the attacker's key and the beneficiary's key all refused |
| Anyone | Pay the same UTxO twice | **No** | Spending the UTxO consumes it; a second release finds no policy |
| Seller's server | Lie in the price list (another beneficiary or refund party, an easier rule, a longer deadline, another signer, a different payout, another script, a missing datum) | The facilitator does not check the datum, so **only the buyer's client stops it** | `cardano/src/attack-offline.ts`: 17 dishonest price lists, all refused, honest one accepted |

## 3. Why not Stripe and a backend?

The honest answer is about which trust assumptions disappear and which remain.

**Disappear**
- Neither the buyer nor the seller, nor the marketplace operator, can redirect locked funds. The only exits are payment to the named beneficiary on a valid proof and refund to the named refund party after the deadline, and the contract enforces both.
- The settlement rule is public and checkable by anyone before paying. Nobody has to trust that a backend applies the rule it advertises.
- No account, API key or card is needed on either side: an agent pays with x402 and the money is in the contract.

**Remain**
- The data provider. A signature proves what an API returned, not that it is true. For most AirnodeHub listings the Airnode is run by API3 over a third party's API, so both are trusted.
- Whoever builds the datum for the buyer. A wrong datum can strand or redirect funds, so the buyer's client must recompute it (section 2, last row).
- The facilitator, which can refuse to broadcast a payment. It cannot change it, because the buyer signed the transaction.
- There is no dispute process. If the data says the condition is met, the beneficiary is paid. Masumi's escrow has disputes; we do not.

**What an ordinary backend does better:** refunds for reasons the data cannot see, human review, chargebacks, tax and invoices.

## 4. Known gaps

| Gap | Status |
|---|---|
| **Two policies with the same beneficiary in one transaction** (double satisfaction). `Release` checks that *some* output pays the beneficiary at least `payout`, and does not tie that output to the input being spent. A third party who holds a response that satisfies two such policies can release both with one payment and keep the other | **CONFIRMED by evaluation (30 Oct, `attacks.ts --fresh`, nothing submitted):** a transaction spending both bench policies and paying the beneficiary 5 tADA once was ACCEPTED by the validator, where a sound validator must refuse it (an honest batch paying 10 tADA is also accepted, as it should be). Not exploitable by our own flows one policy at a time, but release is open to anyone, so on a live deployment a third party could batch two satisfied policies and pocket one payout. **Open until the validator is fixed** |
| Value locked above `payout`, and any native tokens in the UTxO, are not protected: only `payout` lovelace must reach the beneficiary | By reading. Our templates lock exactly the payout in ADA, so nothing is exposed in our flows |
| **Observation time.** The contract checks when the Airnode *signed*, not when the value was *observed*. The Nodary price signs an `updatedAt` that the contract does not look at | Not covered. Could be added for feeds that carry an observation time |
| A UTxO locked with a missing or malformed datum can never be spent, not even refunded | Prevented only by the buyer's client check (`attack-offline.ts`) |
| Replay across policies | **By design.** A response is public data, not bound to one policy: it can release every policy that pins the same request and signer within its age limit. One policy still pays once. To bind a task, put its id in the request (the tweet id is part of the request hash) |
| The evaluation reads a transaction's list of required signers, not its signatures | The ledger checks signatures when a transaction is submitted. A refund that lists the refund party but is not signed by them is refused there; this was not run |
| Oracle failures: an authentic but wrong value | Not covered. Disclose; prefer first-party sources; a second independent source is not built |

## 5. Short answers for judges

- **"What does it prove?"** Authenticity and the condition. Task completion only where the outcome is what the data measures.
- **"Why a blockchain here?"** So that no party, including the operator, can redirect funds, and so the settlement rule is public. Not for transparency alone.
- **"What if the oracle is wrong?"** Then the contract pays on a wrong value. That risk stays; we choose sources close to the data owner and say so.
- **"Is the data fresh?"** The signature is (age limit, not from the future). The underlying observation is not checked yet.
- **"Can a response be reused?"** For another policy that pins the same request, yes, by design. For the same policy, no.
- **"What if the keeper fails?"** The funds stay in the contract. Anyone can release a satisfied policy, and the refund party gets the money back after the deadline.
- **"Can a malformed refund address lock funds?"** A bad datum can. The server validates the address and the client recomputes the whole datum before paying.
- **"Who is the customer?"** A buyer (a person or an agent) who wants to pay for a measurable outcome without trusting the seller to deliver, and a seller who wants proof that the money exists before working.

## 6. Reproduce

```bash
cd cardano && npm install && cp .env.example .env     # a funded preprod wallet and a Blockfrost key
npx tsx src/attack-offline.ts                          # no network: 17 lying price lists
npx tsx src/attacks.ts                                 # evaluation only: redirect, underpay, anyone may submit
npx tsx src/attacks.ts --expired <txHash>#<index>      # evaluation only: wrong refunders on an expired policy you funded
# the double-satisfaction case needs a fresh response (0.1 aUSD, see JUDGES.md for the command).
# Today it exits 1: the validator accepts the attack. It is the regression test for the fix.
npx tsx src/attacks.ts --fresh <the saved response file>
```

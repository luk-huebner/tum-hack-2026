# What Pay-on-Proof proves, who can do what, and what it does not cover

Testnets only (Cardano preprod, Base Sepolia). Not audited. This describes the current validator, script hash `58fb7eef...` (the first version, `a9e4420c...`, had the flaw in section 4). Every result below was run; the command or the transaction is named next to it. What was not run is marked.

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
| Anyone | Release and keep the money (pay nobody, or pay another key) | **No.** One policy per release; the beneficiary must receive everything locked | `attacks.ts`: all cases refused; the same two-policy attack was ACCEPTED by the first validator and is REJECTED by the current one |
| Anyone | Release and pay the beneficiary less than the payout (4.9 tADA, 5 tADA minus a lovelace) | **No** | `attacks.ts`: both refused |
| Anyone | Release with an edited value, a different request, a different signer, or a response older than the policy allows | **No** | The judge bench: `cardano/JUDGES.md`, page at `/` |
| Anyone | Release after the deadline | No, by the code (`upper <= deadline`) | Contract tests in CI (73 pass); **not run on chain** |
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
| **Two policies with the same beneficiary in one transaction** (double satisfaction): `Release` checked that *some* output paid the beneficiary at least `payout`, not tied to the input being spent | **FIXED in the current validator** (`58fb7eef...`). Confirmed on the first validator by evaluation (one fresh response, nothing submitted): both bench policies spent with one payment were ACCEPTED. The fix allows one policy of this validator per release. The same attack, response and wallet is REJECTED on the current validator (`PROOFS.md`, last section; `attacks.ts --fresh`). Contract tests cover it |
| Value locked above `payout`, and native tokens in the UTxO | **Lovelace: fixed.** The beneficiary must now receive the payout and at least everything locked. Native tokens in a policy UTxO are still not protected (our templates lock ADA only) |
| **Observation time.** The first validator checked when the Airnode *signed*, not when the value was *observed* | **Fixed for feeds that sign an observation time.** The current validator has an optional check (a slot holding the observation time in ms, and a maximum age). The ETH/USD escrow uses the Nodary `updatedAt` with 120 s. **Not covered:** feeds without an observation time (rainfall, tweets) |
| A UTxO locked with a missing or malformed datum can never be spent, not even refunded | Prevented only by the buyer's client check (`attack-offline.ts`) |
| **The seller's keeper acts on every policy that names the seller key as beneficiary and pins a request it knows.** It once released our own standing judge bench that way | Known and by design: it can only collect money a policy already owes the service. The bench now names a different key (the buyer's), so it is left alone. Anyone can lock a policy that pays the service; the keeper will then spend fees (about 0.3 tADA) to collect 5 tADA, and, for tweet and rainfall policies, up to its aUSD cap on data |
| **A buyer can be told a payment failed when it settled** (seen on 30 Oct: HTTP 402 after 61 s, escrow on chain), or lose the answer to a dropped connection | Funds are safe in both cases: the escrow exists, the seller's keeper can release it, and the buyer can refund it after the deadline. The buyer's client therefore looks for the escrow by its datum before concluding that nothing was charged. A buyer who just retries pays a second time |
| Likes are not monotonic: a tweet's like count can fall (tweet 20 went from 309,363 to 308,791 within hours) | A rule "at least N" that held can stop holding, and one that did not hold can be missed. State it, and pick thresholds with a margin |
| **Checking costs money.** A seller's keeper pays per look at a paid source, so a fixed fast pace spends the whole budget before the value moves | The keeper plans each check from the cost, the kind of data and the trend (`POLLING.md`): static data once, a counter by its predicted crossing, otherwise at most 5 minutes apart, never twice a minute, and never beyond the aUSD cap. The price of a minute of delay is a choice that was not measured; the simulation uses invented histories |
| **Platform data through LunarCrush is a snapshot, and only for what it indexes.** The same YouTube video showed identical counts 7 hours apart; an unknown video, creator or post is not served | Use it for claims about settled history, not live counters. For a live like count the TwitterAPI.io route (any tweet) is the tested one. A signed projection keeps the id in the signed text so one video cannot stand in for another |
| Replay across policies | **By design.** A response is public data, not bound to one policy: it can release every policy that pins the same request and signer within its age limit. One policy still pays once. To bind a task, put its id in the request (the tweet id is part of the request hash) |
| The evaluation reads a transaction's list of required signers, not its signatures | The ledger checks signatures when a transaction is submitted. A refund that lists the refund party but is not signed by them is refused there; this was not run |
| Oracle failures: an authentic but wrong value | Not covered. Disclose; prefer first-party sources; a second independent source is not built |

## 5. Short answers for judges

- **"What does it prove?"** Authenticity and the condition. Task completion only where the outcome is what the data measures.
- **"Why a blockchain here?"** So that no party, including the operator, can redirect funds, and so the settlement rule is public. Not for transparency alone.
- **"What if the oracle is wrong?"** Then the contract pays on a wrong value. That risk stays; we choose sources close to the data owner and say so.
- **"Is the data fresh?"** The signature is (age limit, not from the future). The underlying observation is not checked yet.
- **"Can a response be reused?"** For another policy that pins the same request, yes, by design. For the same policy, no.
- **"How often does the keeper check, and what does that cost?"** It depends on the data. Rainfall over a finished window: once. Likes: next look at half the predicted time to the threshold, at most 15 minutes apart with a trend and 5 without, never twice a minute, always inside an aUSD cap. A free price feed: every 20 seconds. Derivation and numbers in `POLLING.md`.
- **"What if the creator buys likes or views?"** The contract proves what the data said, not that it is real. The design answers with the rule, not with the contract: count only a measurement taken at the end (`settle_after`), pay on the increase over today's number, hold part back in a second escrow measured later, keep the payout small against the cost of faking, and do not pay on views alone. Two sources that must agree and a buyer veto window would need a new validator. See `cardano/CREATOR_PAY.md`.
- **"How do you know the post is the creator's?"** The intake reads the author from the data provider, and the signed text pins the author's numeric id, the creation time and the post id; a different post or author cannot satisfy the policy.
- **"How fast does a like become a payout?"** Measured on 30 Oct: the signed like count followed a like within the next response (about 2 s), the keeper saw it within one 5-second cycle, and the payout was on chain 53 s after the like, most of it waiting for the chain. See `PROOFS.md`.
- **"Can an AI agent spend money with this?"** Only if the operator starts the agent server with spending on, and then each payment needs an explicit confirmation, is always 5 testnet tADA, and at most 3 per session. By default an agent can read, preview and ask the contract for verdicts, none of which needs a key. See `cardano/MCP.md`.
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
# It exits 0 on the current validator; against the first version it exits 1 on exactly the flawed rows:
npx tsx src/attacks.ts --fresh <the saved response file>
VALIDATOR_BLUEPRINT=../aiken/blueprint/plutus-v1-a9e4420c.json npx tsx src/attacks.ts --fresh <file> --standing standing-policies-v1.json
```

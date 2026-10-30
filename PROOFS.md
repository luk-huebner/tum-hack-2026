# Proofs and receipts (testnet only)

Collected during the TUM Blockchain & AI Hackathon 2026. All networks are testnets; nothing here has real value.

> **Which validator?** Everything above the section "Validator revision" was run against the FIRST validator, script hash `a9e4420cc2b611c46a8a0c1f5413f9ce4b6be47c7974e8509171b11c` (1,832 bytes, 39 tests), which has the double-satisfaction flaw described in TRUST.md. Those receipts stay valid as evidence of what that version did. The current validator is `58fb7eefb61d968668106385cf7a7dc8e8591004162a81c6b50562ea` (2,317 bytes, 55 tests), see the last section.


## Cardano preprod: first paid x402 request (the Cardano track gate)

- Date: 30 Oct 2026, about 12:17 Munich time. HTTP 200 after 24.3 s, 2 confirmations.
- Transaction: `88b9fb664a8c8ffb0d1704de049df3c243ae5a90f39e3ebc8b10d39b597d15dd`
- Explorer: https://preprod.cardanoscan.io/transaction/88b9fb664a8c8ffb0d1704de049df3c243ae5a90f39e3ebc8b10d39b597d15dd
- Checked independently on Koios: 2.0 tADA to the seller address, fee 0.168581 tADA, change back to the buyer.
- Buyer `addr_test1qqf6wl8rev5q2zwslk95eqz0tgymshadz26gs70ygr593jwkmysa3xpenqsmsw29qwe6zpqkdqt7mu5wlx8ln8crz9csuqjxxp`
- Seller `addr_test1qqc6zk4fal6ls7pjmmapfczmwu5fzj7f6pl2pc350zachuk4p4mmu6500t9l838kggwz7w2t4en5aul9hkaxk3x37grsq70xr8`
- Facilitator: `https://x402.preprod.dev.ecosyseng.cf-deployments.org` (Cardano Foundation, hosted)
- Note: the template's client was rejected with `invalid_exact_cardano_payload_ttl_too_far` because it sets the transaction TTL from the local clock while the facilitator measures from the chain tip, which was 31 s old. `cardano/src/buyer.ts` asks for a shorter window (120 s margin) and the payment went through.

## Base Sepolia: AirnodeHub calls paid in aUSD (x402)

| Call | Cost | Transaction |
|---|---|---|
| Mint 10 aUSD (faucet) | gas only | `0x015c9ca8287b05e394a6205318863320b1606abaa4b9c1883d4bd111403b4ac8` |
| Tweet, id from the docs (empty record) | 0.01 | `0x83a500a4bac7f93e72eeed81a9820d4cb965e1d0faf7a47c96b4ca4b96e32bde` |
| LunarCrush post, YouTube video | 0.02 | `0x52958f53e1dec5e7ff308009fbf697b0da03931c8c1af1f1e7f76959e79e1a1d` |
| Open-Meteo rainfall, Munich, 14 projected fields | 0.1 | `0x391bba91115a3e2ecb1b226a15a818ecb30078e39ed456bd9faffa9721a55873` |
| Tweet id 20 (live counts) | 0.01 | `0xe17cadb7d0b09b8e6da87b42845b9dee3adb19f3b0bf61d353e54b6fce959013` |

Explorer prefix: https://sepolia.basescan.org/tx/

## Contract tests (GitHub Actions, private repo)

- Run 41041571911: 39 of 39 Aiken tests pass, with a real signed Open-Meteo response.
- Run 41044730373: compiled validator `pay_on_proof`, Plutus V3, script hash `a9e4420cc2b611c46a8a0c1f5413f9ce4b6be47c7974e8509171b11c`.

## Cardano preprod: Pay-on-Proof with a REAL signed AirnodeHub response (30 Oct 2026, about 12:25 to 12:36 Munich time)

The response: Open-Meteo rainfall, Munich, 10 to 23 Oct 2026, 14 daily values (sum 26.20 mm), signed by the Open-Meteo Airnode `0xee510FFb986299529fE987bfD163D6c89067D767` at unix 1793355726, request hash `0x11e0e1b67c51d6c7ecc06f18d0ce6d2b2b1802243733bf63cc69df10599b86c5`. The policy: pay 5 tADA to the seller when the 14-day sum is below 30.00 mm. The demo policies allow an attestation age of 24 hours because the stored response was a few hours old; a live policy would allow minutes. Script address `addr_test1wz57gssvc2mpr3...` (hash `a9e4420c...`, no stake part).

| Step | Transaction | Result |
|---|---|---|
| Lock six policy UTxOs, 5 tADA each, inline datums | `211d85c16ac19ca116c0d5551f1474a480a137e98240fea459b87b5865d2ef89` | Confirmed, block 5353014 |
| **Release** the valid policy with the real signed response | `0a2b24ddef14da2d29369d3fbb3e4d771d321e2519dbbc1d07e544aef3e64649` | Confirmed, block 5353033. Validator spent: 981,963 memory, 339,432,301 steps. 5 tADA to the seller |
| **Refund** the short-deadline policy to the buyer after its deadline | `b338476fcdca0ca00043cc16244e2d91c99ab98fc4e38c7d000c6ccd3cad8d92` | Confirmed, block 5353040. 49,567 memory, 17,652,677 steps. Buyer signature required |

Explorer prefix: https://preprod.cardanoscan.io/transaction/

**Tamper cases against the locked UTxOs** (`tsx src/engine-demo.ts attempts`). Each is a release attempt whose script evaluation fails before anything is submitted; the control builds:

| Case | Outcome |
|---|---|
| Edited value (d00 6.90 changed to 0.90) | Rejected at script evaluation |
| Too old (policy allows 5 minutes, response is hours old) | Rejected |
| Different request (policy pinned to another request hash) | Rejected |
| Wrong signer (policy pinned to another key) | Rejected |
| Rule not met (26.20 mm is not below 20.00 mm) | Rejected |
| Attestation from the future (validity starts before it was signed) | Rejected |
| Valid response, valid policy (control) | Builds |

Notes: the rejections are evaluation failures reported by the provider (Blockfrost), not failed transactions on chain, and the provider's message is generic ("Script evaluation failed"). Each case differs from the control in one input only. The first refund attempts failed for timing reasons, not network ones: the ledger rounds a validity start down to a whole slot (so the start must be a second after the deadline), and the node validates against its own latest slot, which trails the clock (so the script now waits for the chain tip to pass the start).

## Judge bench (Cardano preprod, 30 Oct 2026, about 13:00 Munich time)

Two standing policies for the tamper test, locked in `4ec3a5dd555f794d3f8ea4ad730282701bc71a6e6e94518ddea875bc6d1d973e` (output 0: accepts a response up to 48 hours old; output 1: up to 5 minutes), open until 31 Oct 20:00 UTC. Run with `tsx src/judge.ts` (see `cardano/JUDGES.md`). Results, with the valid response run before and after the tamper cases as a control:

| Case | Policy | Outcome |
|---|---|---|
| Real response, valid (control, first) | 48 h | ACCEPTED |
| One value edited | 48 h | REJECTED |
| Real response to a different request (a YouTube video, signed by the LunarCrush Airnode) | 48 h | REJECTED |
| Same request and data, signed by a throwaway key | 48 h | REJECTED |
| Real response, 79 minutes old | 5 min | REJECTED |
| Real response, valid (control, last) | 48 h | ACCEPTED |

**A first run of these cases was thrown away.** Run straight after the lock confirmed, even the valid control was rejected, so the four rejections in that run could not be trusted: the evaluator had not yet seen the fresh output. The table above is the rerun, bracketed by two accepted controls.

## Live flow: a fresh signed response releases a 5-minute policy (Cardano preprod + Base Sepolia, 30 Oct 2026, 11:45 to 11:47 UTC)

`tsx src/live.ts --pay`, one command, 99 seconds end to end:

| Step | Receipt |
|---|---|
| 1. Lock a 5 tADA policy that accepts a response up to 300 s old | `49ce28c19ee140d3322279c5238cd082c3eec79e80bca5c0e10964cf445f100f` |
| 2. Buy a fresh signed Open-Meteo response, same pinned request, 0.1 aUSD (x402, Base Sepolia) | `0x427aba95eb24dec6ca272bf444d7d637524a65efb6fe0198ea31f41c68be0746`; response signed at unix 1793360750 |
| 3. **Release** the policy with that response, 16 s after it was signed | `b266fc382a1c89ca4bebdf44d273f5601424e20341a1124305f245f7c3caa12b`, block 5353069 |

Koios confirms the release: it spends the script input with hash `a9e4420c…` (981,963 memory, 339,432,301 steps), pays 5 tADA to the seller address, fee 0.346383 tADA. The aUSD balance fell from 9.86 to 9.76 (0.1 for this call). The same request, response format and rule as the stored-response release, but the age limit (300 s) now actually binds: the response must be fresh.

## Creator Pay shape: a signed tweet response drives the same validator (30 Oct 2026, about 13:15 Munich time)

The response: TwitterAPI.io `tweetsByIds` for tweet 20, projected to five fields, signed by the TwitterAPI.io Airnode `0x7B02Fd3324D2dC362f65a9c01e59EC5fDb4E1CCB` at unix 1793361156, request hash `0xf083d879a1ca4e8aadc7aa72c7ee1c5b60bf18436689e935280bfa439497e191`. Signed text: `{"id":"20","likes":309363,"replies":18116,"retweets":124535,"views":0}`. Paid on Base Sepolia for 0.01 aUSD: `0x563dd83fc686f1b28e1cb7330b0791a2d77a94ae67d839419cdd76b90a421e27`. The counts moved by a few units since a call 40 minutes earlier (likes 309,362 to 309,363), so they are live. **No contract change was needed:** the tweet id sits in the fixed text (and in the request hash), and the rule sums only the likes slot.

| Step | Transaction or outcome |
|---|---|
| Lock two policies, 5 tADA each ("at least 300,000 likes" and "at least 400,000 likes") | `16865f77c9d8ffe0984c30ab94469e52a1ea399af7d141d736f36e038a2128a6` |
| Real response against the 300,000 policy (control, first) | ACCEPTED |
| Real response against the 400,000 policy (about 309,000 likes) | REJECTED, KPI not met |
| Likes edited to 999,999 in the signed text, against the 400,000 policy (the forged screenshot) | REJECTED (the signature no longer matches; the edited value would have met the KPI) |
| Real response against the 300,000 policy (control, last) | ACCEPTED |
| **Release** of the 300,000 policy | `08796403a39fb51a1d04f35ff6aa857b52ab9eff32dc8667cba1ae32d0c8d161`, block 5353089. Koios: script spend 257,071 memory and 134,776,248 steps, 5 tADA to the seller |

Limits of this test: tweet 20 is Jack Dorsey's 2006 tweet, so `views` is 0 and a views KPI is still untested; nobody posted a test tweet yet, so update speed after a live like is unmeasured; the signature proves what the API returned, not that the likes are genuine.

## Keeper agent (Cardano preprod, 30 Oct 2026, about 12:06 to 12:21 UTC)

`cardano/src/keeper.ts` watches a locked policy on a schedule and releases it when the signed data satisfies the rule. Source for these runs: the Nodary ETH/USD price through AirnodeHub (free, so the spending cap stayed at 0 aUSD). Before it spends anything it checks the response against the policy locally; every cycle is appended to `cardano/out/keeper-log*.jsonl`.

| Run | Policy (5 tADA) | Result |
|---|---|---|
| 1 | `247dad32…2476#0`, ETH/USD at least 2234.445 | Cycle 1: price 2234.825, rule met. **Release** `7105a4fa3115b739e85b662b4e3e3438e92ab3e47e5b359f1cba4a809e167f8e`, block 5353121, submitted when the response was 15 s old. The log said "on-chain-rejected": a network error on the confirmation wait (train connection) was reported as a rejection. The transaction is on chain. Fixed: submit and confirmation are now separate and the wait tolerates network errors. Log kept as `keeper-log-run1.jsonl` |
| 2 | lock `12b89bad3c69bdf1a52424e22aac689f66aa27eb545edda3bf6637876d99e042`, ETH/USD at least 2236.495 (price at lock 2235.495) | Cycle 1: price 2239.835, rule met. **Release** `a1c04de9d5637e0d80e70c00300ba8d2ba08f13df37aabc93f6160d70616d944`, response 20 s old, logged `released` then `confirmed`. Koios: block 5353160, fee 0.286457 tADA, 5 tADA to the seller. First attempt to start this run failed on a dropped Blockfrost read before any cycle; provider reads now retry with backoff |

Runs 1 and 2 crossed the threshold in the first cycle, because the price moved up between locking and the first check. They prove the autonomous release, not the waiting loop. Run 3 was locked with a $4 margin to show the waiting loop:

| Run | Policy (5 tADA) | Result |
|---|---|---|
| 3 | lock `aca78b2bb163a745a7c1fd22f23f26bf4b177f2850f75b5eb02cb9fb6df2e530`, ETH/USD at least 2239.21 (price at lock 2235.21) | 22 cycles in about 9 minutes (12:23 to 12:32 UTC, log `keeper-log-run3.jsonl`). The price stayed between 2234.12 and 2237.49, so the rule never held and **nothing was released**, which is the correct outcome. Three fetches failed (cycles 2, 6, 7); the keeper backed off 40 s, 40 s and 80 s and carried on. Spending stayed at 0 aUSD. After cycle 22 the log has no line for 39 minutes, then `stop: policy deadline close`. The cause is not known: either the laptop slept or a fetch hung, since the fetch had no timeout. A 60 s timeout was added afterwards, so a hung fetch now counts as a failed cycle. That fix is not tested against a real hang. The policy is still locked and refundable by the funder after its deadline |

What the keeper runs do not show: a paid source in the loop (the tweet source costs 0.01 aUSD per cycle and was never run in a loop), an unattended run of hours, or any judgment beyond a threshold rule.

## Paid keeper job: x402 payment on Cardano preprod, release by the validator (30 Oct 2026, about 14:00 UTC)

The service (`cardano/src/service.ts`) charges 2 tADA by x402 for `POST /api/keep` and settles the payment only if the keeper releases the policy. Test policy: ETH/USD at least 2220.165 (price when locked 2225.165), 5 tADA, accepts a response up to 300 s old, free Nodary source.

| Step | Receipt |
|---|---|
| Lock the policy (buyer wallet) | `2af6326b3530712c25312db60478fd02d97037e2d2d04f52d068a36233dc05dd#0` |
| `tsx src/keep-client.ts --ref 2af6326b…05dd#0`: HTTP 200 after 91.0 s | the keeper fetched a signed Nodary response (70 s old at release, price 2225.025), waited for the chain tip, released |
| **x402 payment**, buyer to seller address, 2.0 tADA, fee 0.168405 tADA | `51188ed459c7bf8a59160e0f8ede352251bfdc1b57524784c85f6e68cb146ffb`, block 5353430 |
| **Release** by the service wallet, 5 tADA to the policy's beneficiary, fee 0.283201 tADA | `1678080ab54aee6c3f799775247b624b37da21eb4ec4a3ad6431c78a0f979d84`, block 5353430 |

Both confirmed on Koios in the same block. The beneficiary here is our own seller key, so the 5 tADA stayed inside our wallets.

**A request that is refused is not charged.** The same endpoint was called for the Open-Meteo bench policy with the Nodary source, which answers a different request than the policy pins. The service answered HTTP 422 after 1.9 s with `"charged": false`. The buyer and seller balances read the same before and after (9922.327158 and 18.716799 tADA, checked again 45 s later) and no payment transaction exists. This was tested for the wrong-request refusal only; the rule-not-met refusal takes the same code path (a 409) but was not run. The client crashed after the refusal because it tried to read a payment receipt that does not exist; fixed.

**Fresh response on the 5-minute bench policy.** A response bought for 0.1 aUSD (`0xcaeebff9db9863a69450c55a8a3d69d0c61508a099e69dd20c7ac23ef8efd6d5`, Base Sepolia) and 12 s old was ACCEPTED by `bench-5min`, both through `judge.ts` and through the page. This is the case the old fixed validity window would have refused; the old code was not re-run to confirm that.

Limits: the service ran on a laptop; the 91 s probably consists mostly of waiting for the preprod chain tip (not measured separately); the service does not wait for the release to be confirmed before answering; the paid route has been run once for a release.

## An x402 payment locked straight into the validator (Cardano `script` transfer method, 30 Oct 2026, about 14:35 UTC)

`POST /api/escrow` on the local service. The buyer asked: pay the seller if ETH/USD is at least 2000 (the price was about 2217) before a deadline 40 minutes away, refund the buyer otherwise; 5 tADA, signed response at most 300 s old. The 402 price list declared `assetTransferMethod: script`, our script hash and the policy as inline datum; `payTo` was the validator address.

| Step | Receipt |
|---|---|
| **x402 payment into the validator**: HTTP 200 after 26.3 s, settled by the hosted facilitator | `d903edc39152b5a07e8492a4536c51adc162a60852fb7a6e330cb88d8cd4b292`, block 5353457, fee 0.176545 tADA. Koios: output 0 is 5.0 tADA at the validator address with an inline datum; the policy UTxO is `d903edc3…b292#0` |
| **Release** by the keeper (free Nodary data: price 2216.94, response 70 s old) | `076de3e1fbff36936d46e364bd699442424259b4409691e7948f59aa3e106430`, block 5353461, fee 0.2859 tADA. Koios: 5.0 tADA to the seller's key (enterprise address `addr_test1vqc6zk4f…`) |

The buyer wallet fell from 9922.327158 to 9916.864713 tADA: 5 tADA moved to the seller plus the two fees (0.176545 + 0.2859). That the release worked proves that the datum on the payment output is a valid policy for the validator, since the keeper read the policy from it and the validator ran against it.

Before paying, without sending anything: the price list decoded to the intended policy, and a payment transaction built and signed locally carried exactly that datum on the validator output.

Not shown: the buyer's **refund** from a policy created this way (the validator and the datum shape are the ones whose refund was tested earlier, but not this UTxO), the rule-not-met case on this route, and what the facilitator does with a wrong datum (it does not check the datum, only that `payTo` is the declared script). The refund party is whatever address the buyer declares. The release here was a separate keeper run; the service does not yet watch its own escrows and release them.

## Refund from an x402-locked policy (30 Oct 2026, about 14:17 to 14:30 UTC)

The same route with a 7-minute deadline (`--minutes 7`): ETH/USD at least 2000, refund party the buyer wallet, 5 tADA.

| Step | Result |
|---|---|
| **x402 payment into the validator**, HTTP 200 after 39.0 s | `78cf5df6b6bd98b5e9a57c6d470eaefd67db578e07a7e6de8e6962a5abbcc849`, block 5353466, fee 0.178129 tADA. Policy UTxO `78cf5df6…c849#0`, 5.0 tADA with inline datum |
| **A refund 343 s before the deadline** (`tsx src/refund.ts --utxo … --early`, evaluation only, 30 s after the payment) | REJECTED by the validator (script evaluation failed). Nothing was sent |
| **Refund after the deadline** (`tsx src/refund.ts --utxo … --submit --wait`; validity starts one second after the deadline, signed by the buyer key) | `1057e1d9deb8981a292da4e13f87a6d4122f1c374283d0c6f589fccdbf6e0d1d`, block 5353493, fee 0.259923 tADA. Koios: one output of 4.740077 tADA to the buyer address (the 5.0 tADA locked, minus the fee, which the refund tx took from the locked amount) |

The buyer wallet went from 9916.864713 to 9916.426661 tADA: the two fees (0.178129 + 0.259923) and nothing else. The same UTxO was refused before the deadline and refunded after it, so the refusal is not an evaluator that could not see the UTxO.

So both exits of a policy created by an x402 payment are shown: release to the seller (previous section) and refund to the buyer after the deadline. Not shown: the rule-not-met case on this route, and a refund attempted by someone other than the refund party (the validator requires the refund party's signature; that case is covered by the contract tests, not run on chain for this UTxO).

## The seller's keeper released an x402-locked policy on its own (30 Oct 2026, about 14:31 to 14:33 UTC)

The service ran with `AUTO_RELEASE=1`. After one command, `tsx src/escrow-client.ts --at-least 2000 --minutes 40` (the buyer pays 5 tADA by x402 into the validator), nobody named the policy or started a release: the watcher (`cardano/src/autorelease.ts`) found it on its next scan and released it. Log: `cardano/out/autorelease-log-live-test.jsonl`.

| Step | Receipt |
|---|---|
| **x402 payment into the validator**, HTTP 200 after 26.6 s | `576696ed1c37990d42e620454dcf8f9e143ee9f1c879fdaef72ac656ee0899ef`, block 5353516, fee 0.176545 tADA. Policy UTxO `576696ed…99ef#0`: 5.0 tADA with inline datum |
| Watcher scan: 1 candidate, ETH/USD 2219.855 against "at least 2000", ready | 14:31:45 |
| **Release** by the watcher, response 24 s old | `d4d633697e33a41cc8d287045ed54042f877396fbf42b0a28580eff2752241db`, block 5353520, fee 0.283201 tADA, logged 14:32:07; confirmed 14:32:42. Koios: 5.0 tADA to the seller's key (enterprise address `addr_test1vqc6zk4f…`) |

From the payment's confirmation to the release was about 40 seconds. The buyer wallet fell by 5.176545 tADA (the 5 locked plus its fee). The release fee, 0.283201 tADA, was paid by the service wallet, whose balance fell by exactly that amount.

What this does not show: more than one escrow at a time, a rule that is not yet met when the watcher first sees it (the waiting cycles ran in the keeper's earlier run 3, with the same fetch and check code, not in this watcher), a watcher restart (it keeps no state: it rediscovers policies from the chain), or any source but the free Nodary ETH/USD feed. The watcher acts only on policies that name the service's seller key as beneficiary, so it can only collect money the policy already owes the service.

## Attack matrix: who can do what (30 Oct 2026, about 14:50 UTC; evaluation only, nothing signed or submitted)

`cardano/src/attacks.ts` builds each case and asks the node provider to run the validator; `cardano/src/attack-offline.ts` needs no network. Controls run first and last. The evaluation reads a transaction's list of required signers and does not check signatures, so the refund cases show what the validator requires, not what the ledger would then check.

**Release attacks on `bench-48h` with the stored real response (9 cases, all as expected)**

| Case | Result |
|---|---|
| Control: pay the beneficiary 5 tADA (run first and last) | ACCEPTED |
| Release but pay nobody (the 5 tADA would go to the submitter's change) | REJECTED |
| Pay the 5 tADA to an attacker's key instead | REJECTED |
| Pay the beneficiary 4.9 tADA | REJECTED |
| Pay the beneficiary 5 tADA minus one lovelace | REJECTED |
| Anyone may submit: the buyer's wallet, and a third wallet, pay correctly | ACCEPTED, ACCEPTED |
| Pay more than required (6 tADA) | ACCEPTED |

**Refund attacks on the expired keeper policy `aca78b2b…e530#0`** (deadline passed 13:02 UTC, refund party the buyer wallet; 5 cases, all as expected): the refund party listed as signer ACCEPTED (control, first and last); no signer REJECTED; the attacker's key as signer REJECTED; the beneficiary's key as signer REJECTED.

**Lying price lists (`attack-offline.ts`, no network):** the buyer's client recomputes the whole policy datum and refuses unless it matches. 17 dishonest variants, each refused: refund party swapped, beneficiary swapped, rule made trivial, rule made impossible, deadline pushed out, deadline pulled in, payout lowered, response age limit stretched, request swapped, signer swapped, `payTo` the attacker (with the script method and with a plain payment), another script hash, amount raised, a non-lovelace asset, mainnet, no datum. The honest price list passes.

**Not run:** release after the deadline on chain (covered by a contract test), a refund listing the refund party without their signature (the ledger's check).

**Double satisfaction: CONFIRMED (30 Oct 2026, about 15:00 UTC).** With a fresh Open-Meteo response bought for 0.1 aUSD (`0x4192c420bcbfeb1d6db5e9f80d8130b6be22b2cee935a157fe3200df48ef4232`, 12 s old), `attacks.ts --fresh` evaluated one transaction that spends BOTH standing bench policies (same beneficiary, 5 tADA each) and pays the beneficiary 5 tADA once. The validator ACCEPTED it; the other 5 tADA would stay with whoever submitted it. Controls around it behave: each policy alone is accepted, an honest batch paying 10 tADA is accepted. Nothing was signed or submitted. The cause: `pays(outputs, beneficiary, payout)` is satisfied by any output, so one payment satisfies every policy in the transaction. This is a flaw in the current validator (`a9e4420c…`), not a property of the demos, and it is open until the validator is fixed; the case is now the regression test (`attacks.ts --fresh` exits 1 while it is open).

## Validator revision: the double-satisfaction flaw fixed and re-tested (30 Oct 2026, about 15:20 to 16:10 UTC)

**The change** (`aiken/airnode_spike/validators/pay_on_proof.ak`, `lib/engine.ak`): (1) a release may spend only ONE UTxO of this validator per transaction; (2) the beneficiary must receive at least everything locked in the UTxO, not only the stated payout; (3) an optional observation-time check: the policy names a slot that holds the time the value was observed (POSIX ms, for example the Nodary `updatedAt`) and a maximum age, and the contract refuses a response whose observation is older than that when the Airnode signed it, or later than the signature by more than a second. CI run `41079363081`: **55 of 55 tests pass** (39 before; the new ones cover two policies with one payment, two policies both paid, the surplus rule, a release that does not spend its own input, and the observation check with a real signed Nodary response), build clean. New script hash `58fb7eefb61d968668106385cf7a7dc8e8591004162a81c6b50562ea`, 2,317 bytes. The first validator's blueprint is kept at `aiken/blueprint/plutus-v1-a9e4420c.json`.

**The same attack on both validators** (`attacks.ts --fresh`, evaluation only, nothing submitted; one fresh Open-Meteo response bought for 0.1 aUSD, `0x0b618703f858647ba2dbd50969c8c202109d5de19a92f161cf6f56c6dcb6dc5e`, 14 s old on the current validator and 26 s old on the first; same wallet, same transaction shapes):

| Transaction | First validator `a9e4420c...` | Current validator `58fb7eef...` |
|---|---|---|
| Each policy alone, paid 5 tADA | ACCEPTED | ACCEPTED |
| Both bench policies, beneficiary paid 5 tADA once (**double satisfaction**) | **ACCEPTED (the flaw)** | **REJECTED** |
| Both bench policies, beneficiary paid 10 tADA (an honest batch) | ACCEPTED | REJECTED (one policy per release now) |

All other cases on the current validator are as before (13 of 13 as expected: redirect, underpay, anyone may submit, controls). On the first validator the run exits 1 on exactly the two rows above.

**The full flow on the current validator**

| Step | Receipt |
|---|---|
| Re-lock the two standing bench policies (10 tADA, refundable) | `53521b16498c0bd4ce7f7920433a6b9d34e7ad77bce5e974c25d66f7990b725d`, block 5353645, fee 0.194937 tADA. Standing list: `cardano/standing-policies.json` (the first validator's bench is kept in `standing-policies-v1.json`) |
| The judge page's six-step bench on the current validator | 6 of 6 as expected (control, edited value, stale for the 5-minute policy, other request, foreign signer, control) |
| **x402 escrow payment into the current validator** (ETH/USD at least 2000; the datum now carries an observation check of at most 120 s on `updatedAt`), HTTP 200 after 52.0 s | `5d3488232e4944a7600c69c07558f448e9750fd5468126d80c44ff077b970923`, block 5353648, fee 0.178393 tADA. Policy UTxO `...0923#0`, 5.0 tADA, inline datum of 206 bytes. The client first recomputed the whole datum and found it matched field by field |
| **Release by the seller's keeper with no further command** (price 2246.885, response 40 s old; the local check and then the validator both passed the observation test) | `aba3ded929b15142c0804a09c449c8027d11a43bf522c33a80d7531e6868bd94`, block 5353651, fee 0.321922 tADA, 5.0 tADA to the seller's key. Log: `cardano/out/autorelease-log-v2-test.jsonl` |

Not run on chain: a UTxO with more locked than the payout (covered by contract tests), an observation that is actually stale (the Nodary feed's `updatedAt` stayed within 0.9 s of the signature in all 31 responses saved today; the stale case is covered by contract tests), several escrows at once, a watcher restart.

**Left behind on the first validator** (its address; not refundable with the current tooling unless `VALIDATOR_BLUEPRINT` points at the old blueprint): the first bench pair `4ec3a5dd...973e#0/#1` (deadline Sat 31 Oct 20:00 UTC) and a few older test policies, about 40 tADA of test funds in all.

## More templates through the paid escrow route, the console's live runs, and a mistake (30 Oct 2026, about 15:35 to 16:10 UTC)

The escrow route (`POST /api/escrow`) now offers three templates on the same validator, and the seller's keeper (`autorelease.ts`) proves each with its own signed source. Nothing in the contract changed for them. The three were run from the console's "Run it live" panel (`DEMO_BUYER=1`), each an x402 payment into the validator followed by a release by the seller's keeper with no further command:

| Template | Escrow payment | Release | What proved it |
|---|---|---|---|
| ETH/USD at least 2000 | `37be6deba117710c04887d7204ed15b02e6306fef46044593c401ceaec947ff3`, block 5353695 | `a3b9da71121c030ec35bea1002c5e8119852fa7164e7d90e7cc06e16099527db`, block 5353707 | Nodary price 2227.695, free. The first release attempt failed once ("script evaluation failed") because the node's evaluator could not yet see this wallet's change output from the release before; the retry succeeded |
| Likes of tweet 20 at least 300,000 | `7d169440d20c5caaedcbd25e461594feb707597c91b3ca6dd56d4abb1fa11bcc`, block 5353716 | `f214d830f2d39ed849c441fe478e073b6abc49906704b185d924f2f610417665`, block 5353720 | 308,791 likes in a signed TwitterAPI.io response, 0.01 aUSD. The count had **fallen** from 309,363 (earlier test) to 308,791: likes are not monotonic |
| Munich rainfall, 10 to 23 Oct 2026, below 30 mm | `847b40e6a388ba462c0ddcd1908fc63908cea9b3fcac071a68296fed801fef55`, block 5353721 | `d897e036800dbb2f5702d96482297efb6cc7d79825733d67dc7c7df6a7a78b40`, block 5353726 | 26.2 mm in a signed Open-Meteo response, 0.1 aUSD (a second 0.1 aUSD response was bought and thrown away, see below) |

The x402 payments took 14 to 17 s in these runs (26 to 52 s earlier). The client recomputed each datum and found it identical before paying.

**Refund demo from the console** (an escrow with the rule ETH/USD at least 999,999, which nobody will see, and a deadline 7 minutes away): the escrow payment is `51855b9bfe4516530aaf02c082c6e42011407751a37c49a23eb2883a2d9f481e`; 35 s later the console tried to refund before the deadline and the contract refused (script evaluation failed, nothing sent); after the deadline the buyer's key refunded it: `593d05f66bfb1417a95b9a008f53daefb1275ccd70dff44cf464fd429feb5901`. Receipts: `https://preprod.cardanoscan.io/transaction/593d05f66bfb1417a95b9a008f53daefb1275ccd70dff44cf464fd429feb5901`.

**A mistake, found because the keeper did what it was built to do.** When the keeper learned to prove the rainfall template, it found the two standing **judge-bench** policies, which named the seller key as beneficiary and pinned the Open-Meteo request, saw the rule hold, and released both on its own (`346e7c496d59cd0928cf127b7334deba9da2ff1eec5ab90fbff0287c42309003`, block 5353696, and `0693dbcaa73acf21dacf7cd22323cd50773326609e8532c2a5ae6c6c4a70a8c0`, block 5353698), spending 0.2 aUSD. The 10 tADA went to the seller key, which is ours, so nothing was lost but the bench. Fix: the bench is re-locked with the **buyer** key as beneficiary (`403517841e2a925bffa38a50069a03449193b88402511b82088a77fdb6ff15bc`, block 5353710), so the keeper never treats it as its own, and the attack script now pays whichever beneficiary a policy names. The rule to remember: **the seller's keeper releases every policy that names the seller key as beneficiary and pins a request it knows how to fetch.** The judge page's six cases pass on the re-locked bench (6 of 6).

**Two more fixes from the same runs.** The keeper bought a paid response and then discarded it because of its post-release cooldown, and bought another; the cooldown is now checked before any data is fetched. A confirmation wait hung for about 8 minutes because provider calls had no timeout (the train connection); every provider call now gives up after 15 s and the loop tries again. Not run again after those two fixes except for the refund demo, which does not use the keeper.

## Watcher hardening: three escrows at once, injected faults, a lost response, a crash and a restart (30 Oct 2026, about 16:10 to 16:20 UTC)

The seller's keeper was changed to fail safely (see the header of `cardano/src/autorelease.ts`) and then tested on chain in one scenario. The service ran with fast cycles (8 s) and three kinds of injected fault (`AUTO_RELEASE_FAULTS=cycle:2,fetch:2,evaluate:1`, `cardano/src/faults.ts`), three escrows were paid into the validator, and the service was killed in the middle.

| What was tested | What happened |
|---|---|
| **Two cycles fail at the start** (injected) | `cycle-failed` twice, backoff 16 s then 32 s, then normal cycles. Nothing else stopped |
| **Two data fetches fail** (injected) | `source-failed` with backoff 16 s then 32 s for that source only, `source-backoff` on the cycles in between, then the fetch worked and the scan found a value |
| **The first release fails like a blind evaluator** (injected) | `release-retry`, `counted=false` ("policy seen less than 90 s ago"): it did not count against the policy. The next cycle released it |
| **Three escrows at once** (ETH/USD at least 2000, ETH/USD at least 2100, likes of tweet 20 at least 300,000) | One release per cycle, the policy closest to its deadline first, with the 45 s cooldown between releases. All three released, one transaction each |
| **A buyer who is told the payment failed.** The first escrow's payment returned HTTP 402 after 60.8 s | **The payment had settled anyway**: the escrow was at the validator and was released. A slow settlement is reported as a failure. The buyer clients used to print "not charged" here; they now look for the escrow at the validator by its datum before saying anything |
| **The service was killed seconds after the first release was sent, before it was confirmed**, and restarted (it keeps no state) | The restarted watcher found all three escrows again from the chain. It tried the first one again, was refused because the input was already spent, and did not count that against it; it then released the other two. Nothing was released twice |

| Escrow | Payment | Release | Data |
|---|---|---|---|
| ETH/USD at least 2000 | `19f87c81c8bbbd0533950d017a12f5bb2b3b856320ed14c4bfb52ec789c18886`, block 5353789 | `b670ff12a08ffbafac0d88d4a824d0c730a8d6c9569744cd0bac58350e9a6a89`, block 5353795 (original process, after the injected faults) | price 2233.09, free |
| ETH/USD at least 2100 | `e94c7b1fccc55b1e1327177acae1b9e197d7989c09bb4b119a67df57a922f16f`, block 5353790 | `771be277ed1bf93756a20e33c2ecb4eae433fcd1cf141675017c2a76e6682ff2`, block 5353801 (after the restart) | price 2236.33, free |
| Likes of tweet 20 at least 300,000 | `a824f2e042a49dafd69e6fe6638ef3e257b617377b7da350235984eb992e7f48`, block 5353792 | `93d9d6582bcc13d4bdd28471c3aa7e0fae10452d1f5e0bf6bac2fba83c397739`, block 5353807 (after the restart) | 308,790 likes, 0.01 aUSD per fetch |

Costs: three 5 tADA payments to the seller key (our own), about 1.5 tADA in fees, 0.03 aUSD. Logs: `cardano/out/autorelease-log-e2-run1.jsonl` (until the kill) and `autorelease-log-e2-run2.jsonl` (the whole file).

**Not tested:** the provider being unreachable for minutes (the injected cycle faults and the 15 s call timeouts stand in for it), the facilitator being down, the lossy-connection test (`escrow-client.ts --drop-response`) after its fix (it did not trigger in this run because it checked the wrong place for the payment header; the natural 402-while-settled case above covered the same hazard), several watchers on one wallet, and a release whose transaction is dropped from the mempool (the 6-minute "sent but not spent" retry is coded, not exercised).

## Audit preparation (30 Oct 2026, about 16:30 UTC)

`AUDIT.md` holds the threat model, a checklist of classic Cardano flaws, the findings log, execution cost and questions for a reviewer. New in this step:

- **Ten more contract tests** (65 of 65 pass, CI run `41090389165`; the script hash is unchanged, `58fb7eef...`, because tests are not part of the compiled validator). They pin down: a payment to a script credential with the beneficiary's hash does not count; a payment with another stake credential does count (a known limitation); the policy's own input may come after wallet inputs; an input at another script does not break the one-policy rule; a refund puts no condition on outputs; at the exact deadline instant both a release and a refund are valid, and one millisecond later only the refund is; a missing datum halts both redeemers.
- **Execution cost measured on chain** (Blockfrost redeemer data for the real transactions): a release uses 321,622 to 1,058,208 memory units (1.8% to 6.0% of the 17,500,000 limit) and 160,609,110 to 369,090,640 steps (1.6% to 3.7% of the limit); a refund uses 49,567 memory (0.3%) and 17,652,677 steps (0.2%). The 14-slot rainfall sum is the most expensive case.
- **Not done:** property-based tests (the pinned stdlib has no fuzzer module), formal verification, any external review.

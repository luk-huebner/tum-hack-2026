# Proofs and receipts (testnet only)

Collected during the TUM Blockchain & AI Hackathon 2026. All networks are testnets; nothing here has real value.

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

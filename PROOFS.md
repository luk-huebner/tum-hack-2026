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

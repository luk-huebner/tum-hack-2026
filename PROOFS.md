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

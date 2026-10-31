# Secret check before publishing, morning of 31 October 2026

Run by the Pay-on-Proof team's assistant on the day of the deadline, after the overnight scan (`SECRET_SCAN*.md`, PR 4) left 27 entries for human review. Everything below was run locally on a checkout with all fetched refs (76 commits, including the overnight branches). Secret values were never printed: scripts reported variable names, lengths, counts and file paths only.

## 1. Exact values of our own secrets, across all history and the working tree

Every non-empty value in the two local environment files (`.env`, `cardano/.env`; both ignored by git) was searched as a literal string in every commit of every ref and in the working tree.

| Variable | Result |
|---|---|
| `PAYER_PRIVATE_KEY` (Base Sepolia payer) | not found anywhere |
| `MNEMONIC` (buyer wallet) | not found anywhere |
| `SELLER_MNEMONIC` (seller wallet) | not found anywhere |
| `BLOCKFROST_PROJECT_ID` | not found anywhere |
| `SELLER_ADDRESS` | found in PROOFS.md and the audit evidence: it is a public address, as intended |

Every 4-word window of both mnemonics (42 windows) was searched too: no file contains a fragment.

## 2. Patterns, for secrets that are not in our env files

Zero hits across all history for: Blockfrost-style keys, GitHub tokens, `sk-` style keys, AWS keys, Slack tokens, `Bearer` tokens, private-key blocks, Cardano signing-key encodings (`ed25519_sk`, `xprv`, `addr_xsk`), a 64-hex string next to a word like private/secret/seed/key, non-empty `*_KEY` / `*_TOKEN` / `*_SECRET` assignments, and `key=` / `token=` / `project_id=` values in URLs. One loose pattern (a line of 12 or more lowercase words) matched three lines of ordinary prose.

## 3. The 27 entries the overnight scan could not clear

| Entries | What they are | How they were resolved |
|---|---|---|
| 23 `PROOFS.md` lines flagged as opaque identifiers | transaction hashes | every one of the 54 distinct plain 64-hex strings in the documentation (all history) was looked up on Cardano preprod: **54 of 54 are real, public transactions**. The 15 `0x…` strings were looked up on Base Sepolia: 13 are transactions, 2 are labelled request hashes |
| 1 `cardano/README.md` line flagged as assignment-like | the sentence "copy the `MNEMONIC=` line into `.env`" (an instruction, no value) | read |
| 3 log lines in `cardano/out/autorelease-log-*.jsonl` | one transaction hash and the provider's error text each | read; no other long token on the lines |

## What this does not show

- It is not a certificate. It cannot find a secret whose format we did not test and whose value is not in our two env files (for example an API key for a data provider that lives only in a hosting dashboard or another person's machine).
- The wallet seed phrase a teammate once pasted into a chat is not in this repository, but it has been exposed elsewhere; treat that wallet as burned and use only testnet funds in it.
- Not scanned: objects that are unreachable from any ref, GitHub's hidden pull-request refs beyond the branches fetched, and content outside the repository (hosting dashboards, chat history).
- GitHub's own secret scanning and push protection were not consulted.
- No credential was validated against a provider.

Public branches: when the repository becomes public, every branch and pull request becomes visible (the `night/*` branches and their reports included).

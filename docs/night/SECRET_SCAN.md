# Overnight A: historical secret scan

## Result and limits

No confirmed secret value was identified by the completed local checks. This is a partial assessment, not a certificate that the repository contains no secrets. Gitleaks produced one candidate, listed below. Local comparison of the captured candidate with repository transaction fields and explorer transaction references supports classifying it as a documentation transaction identifier (apparent false positive); its value is deliberately omitted. No live lookup or credential validation was performed.

TruffleHog local detection completed with **nothing found**. The requested credential-verifying scan is **not verified**: provider credential validation can log in with discovered credentials, which conflicts with this job's no-login rule. The requested historical keyword search completed, but exhaustive human classification of every hit as name/documentation rather than value is **not verified**.

## Scope and timing

- Job A only. Isolated fresh, full, no-checkout clone supplied at `C:/Users/theri/.codex/overnight/tum-hack-2026-20261031/a`.
- Start: 2026-10-31 00:43:46 CET (first recorded tool timestamp; coordinating brief records approximately 00:43:40).
- Original deadline: 2026-10-31 01:28:40 CET. Historical Saturday deadlines did not delay the start.
- Report finalization: 2026-10-31 01:17:58 CET. Elapsed wall time from first recorded tool timestamp: 0:34:12. This includes an interruption; active model/tool time was not separately measured. Commit/push/PR publication follows this timestamp and is separately reported in delivery.
- Base: `82d88dc63341e8498b4728e3bd2f3996aa560a5e`. Scan snapshot: all 47 commits reachable from all fetched refs, 321 unique blobs, 4,113 commit/path tree entries; no binary blobs detected by the supplemental NUL-byte test.
- Refs at scan time: local `main`, `origin/main`, and symbolic `origin/HEAD`, all at the base. `git ls-remote --heads --tags origin` showed only `main`, with no tags. This covers all fetched origin refs at that observation, not deleted/unfetched server refs, hidden PR refs, unreachable objects, external LFS objects or submodule repositories.
- Background files read through a safety-filtered Git-object view: README.md, TRUST.md, PROOFS.md, AUDIT.md and ITERATIONS.md. Sensitive contexts and code fences were suppressed; no repository scripts were executed.

## Scanner candidate (value omitted)

| File | Line | Commit | Kind |
|---|---:|---|---|
| PROOFS.md | 246 | 594379561d5f6fab22a85b4b57c6b126e24994d0 | generic-api-key; apparent documentation transaction-identifier false positive, based on local reference comparison |

The local comparison found the same captured item in 15 explorer transaction references and 10 structured transaction fields across distinct historical blobs. These are local consistency checks, not external confirmation. No values, snippets, surrounding lines or secret fingerprints are included.

## Commands, versions and observed results

Host tools observed: Git `2.41.0.windows.3`, Python `3.10.9`, Node `v22.14.0`. Node was not used for project execution; Node 24 and Aiken were not required or run. Scanner archives came from official GitHub release assets and matched the accompanying published SHA-256 checksums. Signature authenticity beyond that checksum comparison is **not verified**. Tools and helper files stayed outside the repository in the session's `work/` directory.

Every direct repository Git operation was guarded by a `git -C <isolated-repo> rev-parse --show-toplevel` equality check. The scanner working directory was checked before launch. Git content and scanner streams were captured in memory; only selected metadata was persisted or displayed. No tracked repository file was checked out for the scan, including example environment files.

`TOOLS` below denotes the absolute session `work/tools` directory. The Gitleaks configuration was exactly `[extend]` followed by `useDefault = true`; the ignore file was empty. This avoids repository configuration/ignore suppression. Scanner streams were parsed before displaying only file, line, commit and kind.

```text
git rev-parse --is-shallow-repository
git rev-parse --verify 82d88dc63341e8498b4728e3bd2f3996aa560a5e
git for-each-ref --format="%(refname) %(objectname)"
git rev-list --all --count
git ls-remote --heads --tags origin
git rev-list --all
git ls-tree -rz --full-tree <each of the 47 commits>
git cat-file blob <each distinct blob>
git log --all --diff-filter=A --name-only --format=COMMIT:%H
git grep -n -I -i -E -e "mnemonic|seed|private key|PAYER_PRIVATE_KEY|BLOCKFROST" <all 47 commit IDs> --
```

- Full clone check returned `false` for shallow state; the known base resolved correctly.
- Name inventory used the complete additions log, then filtered paths in memory. Results are below.
- Exact requested-term grep: exit 0, 4,857 commit/path/line occurrences, 141 distinct path/line-text pairs, zero unparsed records. Raw matching text was neither printed nor saved.
- Broader in-memory keyword search also included private-key spelling variants: 459 distinct blob/line hits, representing 5,614 commit/path/line occurrences. Its preliminary categories were 63 environment-variable references, 231 documentation/comment contexts and 165 other code/name/string contexts. These categories alone do not prove absence of values.
- Supplemental local heuristics across all 321 blobs found no private-key/provider-token marker, literal secret-assignment candidate, Cardano signing-key material candidate, or per-line sequence of at least 12 English BIP39 words. The public BIP39 English list came from the official bitcoin/bips repository. Heuristics can miss multiline, encoded, split, non-English or otherwise unrecognized material.
- Secret-named assignment fields in the current two `.env.example` files were empty. Historical files also received the scanners and supplemental checks; complete manual historical placeholder review is **not verified**.

```text
gitleaks version
# 8.30.1
gitleaks detect --source . --log-opts=--all --redact=100 --config TOOLS/default.toml --gitleaks-ignore-path TOOLS/empty-ignore --ignore-gitleaks-allow --report-format json --report-path - --no-banner --no-color --timeout 600
```

Gitleaks reported 47 commits scanned, one finding, exit 1 (finding exit status), 8.20 seconds measured by the wrapper. The finding is recorded above; no report containing values was written to disk.

```text
trufflehog --version
# trufflehog 3.99.7
trufflehog git file://. --no-verification --no-update --json --no-color --no-ignore-tag --trust-local-git-config --fail-on-scan-errors --concurrency=4
```

TruffleHog: exit 0, 554 chunks, 878,550 bytes, zero findings, zero error log records, 5.54 seconds wrapper elapsed (scanner reported 1.065306s). Additional refs were not disabled and no branch/depth/since/path restriction was passed. Local Git configuration keys and expected origin URL were validated before using `--trust-local-git-config`; this prevented an automatic temporary checkout of repository files. Its default local clone would otherwise materialize files.

Two earlier attempts using the absolute URI `file:///C:/Users/theri/.codex/overnight/tum-hack-2026-20261031/a` failed with exit 1 and two error records each (26.62s and 5.53s). Those failed attempts provide no scan coverage. The successful relative `file://.` run replaced that failed invocation. The exact requested `trufflehog git file://. --only-verified` command was not run; provider credential validity remains **not verified**. This version's help uses `--results=verified` for that filter, but changing the filter would not remove the no-login conflict.

## Every matching added historical path

| File | Addition commit | Classification |
|---|---|---|
| .env.example | d3e1f88bc7e13caf0f2f789718cc84731efe193e | example configuration |
| cardano/.env.example | 1a22137f6b84ef6ac4e04cc1322039550420666b | example configuration |
| cardano/src/wallet.ts | 1a22137f6b84ef6ac4e04cc1322039550420666b | wallet source code |
| cardano/src/wallets.ts | 1a22137f6b84ef6ac4e04cc1322039550420666b | wallet source code |
| checks/02-new-wallet.mjs | 99e2a83d110879c50e5eeb158699c19ee715f36c | wallet-generation source code |

No other matching added path was found for `.env`, `.env.*`, `checks/out/**`, `*.pem`, `*.key`, or paths containing wallet/mnemonic (case-insensitive filtering). This additions-log inventory does not independently prove absence of a path introduced solely by a rename or copy; full historical blob scanning still covered the fetched commit trees. `cardano/out` is a different directory and was included in content scanning.

## Restrictions and remaining coverage

- No owner-local environment or wallet files were read/copied. No secret or wallet was generated, no account/login, signature, transaction, faucet, token spend, paid service, CI fallback or deployment was requested. Existing repository source, workflow, package and document files were not changed.
- Repository instructions were treated as data. For example, README.md:63 advertises `tsx src/keeper.ts lock --source nodary:ETH/USD --delta 4`, and PROOFS.md:81 records `tsx src/live.ts --pay`; these were not executed. Wallet-generator source was inspected only through metadata/safety-filtered structure, never executed.
- Official scanner documentation was consulted through the web tool, not Chrome. No Chrome evidence or web application verification is claimed. Chrome-based web checks are **not verified**.
- Live credential verification, exhaustive manual classification of all historical keyword hits, hidden/unreachable server content, external hosting/logs and repository application tests are **not verified**.
- Only this new report is intended for commit on `night/a`; the commit uses `[skip ci]`. No history rewrite, main push, force-push or merge is authorized or performed. CI execution and billing eligibility are **not verified**.
- Completion was interrupted before reporting. This report preserves successful earlier evidence; the incorrect interim chat statement that no scans ran is superseded by the recorded scanner results above. No successful scanner was rerun during report-only continuation.

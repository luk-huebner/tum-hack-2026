# Job A: publication decision

**Decision: human review is required before making the repository public.** No confirmed secret candidate was established by the existing scans or this bounded classification. Twenty-seven reviewed entries remain unresolved. They are review candidates, not confirmed leaks; they must not be silently cleared because detectors found nothing.

Morning continuation: 2026-10-31 09:14:37 CET to 2026-10-31 09:16:11 CET (report finalization; commit/push follows). Authorized maximum: 20 minutes, deadline 09:34:37 CET. This is a fresh authorized continuation, not work backdated into the overnight limit.

## Actual coverage

Reused the existing successful detector evidence without rerunning detectors: all fetched scan-snapshot refs, 47 commits, 321 unique blobs and 4,113 commit/path tree entries. Gitleaks 8.30.1 scanned 47 commits; TruffleHog 3.99.7 local detection scanned 554 chunks / 878,550 bytes. Credential validity remains **not verified**; provider authentication was never attempted.

This continuation locally classified every one of the 176 Markdown entries in the saved broader-keyword inventory, representing 915 commit/path/line occurrences. It also revisited exactly the eight fully suppressed entries indexed 0, 1, 2, 3, 4, 5, 6 and 93 in the prior 128-entry sanitized lens. Total: 184 entries, using 82 representative commit/file versions. Exact locations and kinds appear below. Duplicate occurrence associations come from the original inventory; identical versions were not repeatedly opened.

Local processing read only corresponding historical Git objects into memory. It tested assignment-like syntax and opaque identifier forms, and compared identifier candidates with repository transaction fields and explorer transaction references. No matched line, literal, excerpt, seed word, value or secret fingerprint was printed or saved. This is rule-assisted local classification, not exhaustive human reading of raw literals. The 153 documentation/name classifications do not certify absence of all possible secrets.

## Results and provenance

- 153 entries: documentation/name contexts without an opaque literal or assignment-like form identified by this bounded classification.
- Three entries: empty assignments in example configuration. One entry: example configuration comment. These four have no configuration value on the reviewed line.
- 23 entries: opaque/public-identifier-like documentation, unresolved. Local reference matching did not establish sufficient provenance to clear them.
- One entry: assignment-like documentation, unresolved.
- Three entries: log/error string contexts, unresolved. Valid JSON structure alone does not establish safe string contents.
- No newly confirmed secret candidate. No new opaque candidate was reclassified as a verified public identifier or placeholder without evidence.

The existing Gitleaks finding remains classified as a documented transaction identifier based on the earlier local capture comparison (15 explorer transaction references and ten structured transaction fields across historical blobs). Its value is omitted:

| File | Line | Commit | Kind |
|---|---:|---|---|
| PROOFS.md | 246 | 594379561d5f6fab22a85b4b57c6b126e24994d0 | generic-api-key false positive: documented transaction identifier under local comparison |

## Remaining publication limits

Human reviewers should resolve all 27 unresolved rows below before publication, especially the assignment-like documentation and log/error contexts. Review must retain redaction; this report grants no permission to disclose or use credentials. A public transaction-reference classification is not live credential validation.

The original full keyword inventory has 459 distinct blob/line entries (5,614 commit/path/line occurrences). Its exact requested-term grep has 4,857 occurrences / 141 distinct path/line-text pairs. These counts use different matching and deduplication rules; neither the earlier 128-entry structure review nor these 184 entries can be subtracted from those totals to claim complete manual coverage. Other hidden literals in the earlier structure-only review, multiline/split/encoded or unrecognized secrets, and exhaustive every-hit clearance remain **not verified**.

The scan snapshot excludes later repository changes, unreachable/deleted/unfetched server refs, hidden PR refs, external LFS/submodule contents, owner-local files, hosted logs and deployed configuration. Detector silence does not prove safety. No credentials were extracted to files, validated against providers, rotated, or used. No repository base file was changed, and no account, signature, transaction, token spending, paid service, deployment, CI fallback or history rewrite was performed. Only this new job report is added with a skip-ci commit to existing PR #4.

## Exact classification inventory

| File | Line | Commit | Kind |
|---|---:|---|---|
| PROOFS.md | 62 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 113 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | unresolved opaque/public-identifier-like documentation; human review required |
| PROOFS.md | 282 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 317 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 321 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 21 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 64 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| TRUST.md | 91 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/HOSTING.md | 11 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/HOSTING.md | 37 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/HOSTING.md | 41 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 19 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 23 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 32 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 54 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/MCP.md | 10 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/MCP.md | 11 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/MCP.md | 13 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/MCP.md | 43 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/README.md | 19 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | unresolved assignment-like documentation; human review required |
| cardano/README.md | 22 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/README.md | 23 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/README.md | 35 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/README.md | 41 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/README.md | 46 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/README.md | 52 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/README.md | 55 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/README.md | 94 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/README.md | 106 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/README.md | 112 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| TRUST.md | 86 | 0550a2237249c82ed35d03ae18fa744fa439c46d | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 21 | aaa17265e9cc654e8b0aee75af97c9f0ec19d928 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 64 | aaa17265e9cc654e8b0aee75af97c9f0ec19d928 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 19 | f6359621f0b343c08a5c09dec556bf43b9485c69 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 62 | f6359621f0b343c08a5c09dec556bf43b9485c69 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 62 | 068950bc7fca7bf603775ea5282dbb67a4b06176 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 113 | 068950bc7fca7bf603775ea5282dbb67a4b06176 | unresolved opaque/public-identifier-like documentation; human review required |
| PROOFS.md | 282 | 068950bc7fca7bf603775ea5282dbb67a4b06176 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 317 | 068950bc7fca7bf603775ea5282dbb67a4b06176 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 321 | 068950bc7fca7bf603775ea5282dbb67a4b06176 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 19 | 068950bc7fca7bf603775ea5282dbb67a4b06176 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 61 | 068950bc7fca7bf603775ea5282dbb67a4b06176 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 62 | 589532a02f303edfb05ec871bdc4029cf8c6d29b | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 113 | 589532a02f303edfb05ec871bdc4029cf8c6d29b | unresolved opaque/public-identifier-like documentation; human review required |
| PROOFS.md | 282 | 589532a02f303edfb05ec871bdc4029cf8c6d29b | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 317 | 589532a02f303edfb05ec871bdc4029cf8c6d29b | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 321 | 589532a02f303edfb05ec871bdc4029cf8c6d29b | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 19 | 589532a02f303edfb05ec871bdc4029cf8c6d29b | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 61 | 589532a02f303edfb05ec871bdc4029cf8c6d29b | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 62 | 19dd090974f32f5166eb3cc756e41f884166ee45 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 113 | 19dd090974f32f5166eb3cc756e41f884166ee45 | unresolved opaque/public-identifier-like documentation; human review required |
| PROOFS.md | 282 | 19dd090974f32f5166eb3cc756e41f884166ee45 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 317 | 19dd090974f32f5166eb3cc756e41f884166ee45 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 321 | 19dd090974f32f5166eb3cc756e41f884166ee45 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 19 | 19dd090974f32f5166eb3cc756e41f884166ee45 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 61 | 19dd090974f32f5166eb3cc756e41f884166ee45 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 62 | bde255871bfb086a824033024ae90bfd5e8dcf34 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 113 | bde255871bfb086a824033024ae90bfd5e8dcf34 | unresolved opaque/public-identifier-like documentation; human review required |
| PROOFS.md | 282 | bde255871bfb086a824033024ae90bfd5e8dcf34 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 317 | bde255871bfb086a824033024ae90bfd5e8dcf34 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 321 | bde255871bfb086a824033024ae90bfd5e8dcf34 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 19 | bde255871bfb086a824033024ae90bfd5e8dcf34 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 61 | bde255871bfb086a824033024ae90bfd5e8dcf34 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| TRUST.md | 86 | bde255871bfb086a824033024ae90bfd5e8dcf34 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 62 | b6132c1aaf18656168b9da9926fbdf2c4a89db2a | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 113 | b6132c1aaf18656168b9da9926fbdf2c4a89db2a | unresolved opaque/public-identifier-like documentation; human review required |
| PROOFS.md | 282 | b6132c1aaf18656168b9da9926fbdf2c4a89db2a | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 317 | b6132c1aaf18656168b9da9926fbdf2c4a89db2a | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 321 | b6132c1aaf18656168b9da9926fbdf2c4a89db2a | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 19 | b6132c1aaf18656168b9da9926fbdf2c4a89db2a | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 61 | b6132c1aaf18656168b9da9926fbdf2c4a89db2a | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| TRUST.md | 85 | b6132c1aaf18656168b9da9926fbdf2c4a89db2a | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 62 | c3d7c0d87bafda30dec8c30e62af7d606b7c655c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 113 | c3d7c0d87bafda30dec8c30e62af7d606b7c655c | unresolved opaque/public-identifier-like documentation; human review required |
| PROOFS.md | 282 | c3d7c0d87bafda30dec8c30e62af7d606b7c655c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 317 | c3d7c0d87bafda30dec8c30e62af7d606b7c655c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 321 | c3d7c0d87bafda30dec8c30e62af7d606b7c655c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 19 | c3d7c0d87bafda30dec8c30e62af7d606b7c655c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 60 | c3d7c0d87bafda30dec8c30e62af7d606b7c655c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| TRUST.md | 83 | c3d7c0d87bafda30dec8c30e62af7d606b7c655c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/MCP.md | 10 | c3d7c0d87bafda30dec8c30e62af7d606b7c655c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/MCP.md | 11 | c3d7c0d87bafda30dec8c30e62af7d606b7c655c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/MCP.md | 13 | c3d7c0d87bafda30dec8c30e62af7d606b7c655c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/MCP.md | 43 | c3d7c0d87bafda30dec8c30e62af7d606b7c655c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 60 | 598e70c3271205a50d8101da87178c8bf43ce1e4 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 111 | 598e70c3271205a50d8101da87178c8bf43ce1e4 | unresolved opaque/public-identifier-like documentation; human review required |
| PROOFS.md | 280 | 598e70c3271205a50d8101da87178c8bf43ce1e4 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 315 | 598e70c3271205a50d8101da87178c8bf43ce1e4 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 319 | 598e70c3271205a50d8101da87178c8bf43ce1e4 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 60 | 2440e006c7a2ef2908d8b32c8de22ece0138292c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 111 | 2440e006c7a2ef2908d8b32c8de22ece0138292c | unresolved opaque/public-identifier-like documentation; human review required |
| PROOFS.md | 280 | 2440e006c7a2ef2908d8b32c8de22ece0138292c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 315 | 2440e006c7a2ef2908d8b32c8de22ece0138292c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 319 | 2440e006c7a2ef2908d8b32c8de22ece0138292c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 19 | 2440e006c7a2ef2908d8b32c8de22ece0138292c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 59 | 2440e006c7a2ef2908d8b32c8de22ece0138292c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| TRUST.md | 82 | 2440e006c7a2ef2908d8b32c8de22ece0138292c | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 60 | e78e04d35a60ecaf00a688688d509e4d42386b14 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 111 | e78e04d35a60ecaf00a688688d509e4d42386b14 | unresolved opaque/public-identifier-like documentation; human review required |
| PROOFS.md | 280 | e78e04d35a60ecaf00a688688d509e4d42386b14 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 315 | e78e04d35a60ecaf00a688688d509e4d42386b14 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 319 | e78e04d35a60ecaf00a688688d509e4d42386b14 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 19 | e78e04d35a60ecaf00a688688d509e4d42386b14 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 58 | e78e04d35a60ecaf00a688688d509e4d42386b14 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| TRUST.md | 81 | e78e04d35a60ecaf00a688688d509e4d42386b14 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 60 | 0ac57029259da1f7990f7df872f530adb899b62f | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 111 | 0ac57029259da1f7990f7df872f530adb899b62f | unresolved opaque/public-identifier-like documentation; human review required |
| PROOFS.md | 280 | 0ac57029259da1f7990f7df872f530adb899b62f | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 57 | 0ac57029259da1f7990f7df872f530adb899b62f | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/HOSTING.md | 9 | 0ac57029259da1f7990f7df872f530adb899b62f | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/HOSTING.md | 35 | 0ac57029259da1f7990f7df872f530adb899b62f | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 17 | 0ac57029259da1f7990f7df872f530adb899b62f | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 21 | 0ac57029259da1f7990f7df872f530adb899b62f | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 30 | 0ac57029259da1f7990f7df872f530adb899b62f | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 52 | 0ac57029259da1f7990f7df872f530adb899b62f | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 60 | efd5856c53da5c7c30a848b895487879042a621a | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 111 | efd5856c53da5c7c30a848b895487879042a621a | unresolved opaque/public-identifier-like documentation; human review required |
| PROOFS.md | 280 | efd5856c53da5c7c30a848b895487879042a621a | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 56 | efd5856c53da5c7c30a848b895487879042a621a | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| TRUST.md | 80 | efd5856c53da5c7c30a848b895487879042a621a | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 60 | 4f7a14518cbc9e4ef7aac794fc05cd54eea2b236 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 111 | 4f7a14518cbc9e4ef7aac794fc05cd54eea2b236 | unresolved opaque/public-identifier-like documentation; human review required |
| PROOFS.md | 280 | 4f7a14518cbc9e4ef7aac794fc05cd54eea2b236 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 56 | 4f7a14518cbc9e4ef7aac794fc05cd54eea2b236 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| TRUST.md | 78 | 4f7a14518cbc9e4ef7aac794fc05cd54eea2b236 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 60 | e4073a1e15fd92eaa76bd100a326dcee9981bc8e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 111 | e4073a1e15fd92eaa76bd100a326dcee9981bc8e | unresolved opaque/public-identifier-like documentation; human review required |
| README.md | 56 | e4073a1e15fd92eaa76bd100a326dcee9981bc8e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| TRUST.md | 78 | e4073a1e15fd92eaa76bd100a326dcee9981bc8e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 60 | 594379561d5f6fab22a85b4b57c6b126e24994d0 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 111 | 594379561d5f6fab22a85b4b57c6b126e24994d0 | unresolved opaque/public-identifier-like documentation; human review required |
| README.md | 56 | 594379561d5f6fab22a85b4b57c6b126e24994d0 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| TRUST.md | 77 | 594379561d5f6fab22a85b4b57c6b126e24994d0 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 60 | 61c684897b09497380b62ab8d6bdcc7962f5eb65 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 111 | 61c684897b09497380b62ab8d6bdcc7962f5eb65 | unresolved opaque/public-identifier-like documentation; human review required |
| README.md | 54 | 61c684897b09497380b62ab8d6bdcc7962f5eb65 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| TRUST.md | 75 | 61c684897b09497380b62ab8d6bdcc7962f5eb65 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 17 | 61c684897b09497380b62ab8d6bdcc7962f5eb65 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 21 | 61c684897b09497380b62ab8d6bdcc7962f5eb65 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 30 | 61c684897b09497380b62ab8d6bdcc7962f5eb65 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 52 | 61c684897b09497380b62ab8d6bdcc7962f5eb65 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 57 | 485d74a36637fb6abeefa403b34b0af57024ea39 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 108 | 485d74a36637fb6abeefa403b34b0af57024ea39 | unresolved opaque/public-identifier-like documentation; human review required |
| README.md | 54 | 485d74a36637fb6abeefa403b34b0af57024ea39 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| TRUST.md | 75 | 485d74a36637fb6abeefa403b34b0af57024ea39 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 17 | 485d74a36637fb6abeefa403b34b0af57024ea39 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 21 | 485d74a36637fb6abeefa403b34b0af57024ea39 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 30 | 485d74a36637fb6abeefa403b34b0af57024ea39 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 52 | 485d74a36637fb6abeefa403b34b0af57024ea39 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 57 | bdf98735a3c1a72dedc23f5da67207a9ba080ce5 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 108 | bdf98735a3c1a72dedc23f5da67207a9ba080ce5 | unresolved opaque/public-identifier-like documentation; human review required |
| TRUST.md | 75 | bdf98735a3c1a72dedc23f5da67207a9ba080ce5 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 57 | c575124dc4abd605a71131b024fd6951d6db9666 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 108 | c575124dc4abd605a71131b024fd6951d6db9666 | unresolved opaque/public-identifier-like documentation; human review required |
| README.md | 54 | c575124dc4abd605a71131b024fd6951d6db9666 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 57 | 5b682c99349417653163e596001781d73200c28b | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 108 | 5b682c99349417653163e596001781d73200c28b | unresolved opaque/public-identifier-like documentation; human review required |
| README.md | 54 | 5b682c99349417653163e596001781d73200c28b | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 52 | f1778b089352497a8f103b784c78a250b7f6f64e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 57 | 972f7a2fab561e936984eedc219dde7f6937fc15 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 108 | 972f7a2fab561e936984eedc219dde7f6937fc15 | unresolved opaque/public-identifier-like documentation; human review required |
| README.md | 52 | 972f7a2fab561e936984eedc219dde7f6937fc15 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 57 | 0360f88551f9b65a9edbb48379fb82409a619831 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 108 | 0360f88551f9b65a9edbb48379fb82409a619831 | unresolved opaque/public-identifier-like documentation; human review required |
| README.md | 52 | 0360f88551f9b65a9edbb48379fb82409a619831 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 51 | bd9aeab4dd512c340ec6cc6283e84a5323aaa23b | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 57 | 25c5395ce3cd216d024d2ef1ac7fa59941e89cdf | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 108 | 25c5395ce3cd216d024d2ef1ac7fa59941e89cdf | unresolved opaque/public-identifier-like documentation; human review required |
| README.md | 51 | 25c5395ce3cd216d024d2ef1ac7fa59941e89cdf | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| README.md | 48 | 469019bf1777ac6ceb5ef69857694b0b29c51174 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 17 | 469019bf1777ac6ceb5ef69857694b0b29c51174 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| cardano/JUDGES.md | 39 | 469019bf1777ac6ceb5ef69857694b0b29c51174 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 57 | 7d67fed973ce68688f7bc71db83753fe4cb21c34 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 57 | 39fd71a17777e595e75f74aae8ba7f55a169af90 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 57 | e9ab704e91466a27d7dd534496e067438f762a2e | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| PROOFS.md | 57 | 37fa2c9ce5e4f219e46b4c37fa0eadb45f58ebd5 | documentation/name context; no opaque literal or assignment-like form identified by local classification |
| .env.example | 2 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | empty example assignment; placeholder only |
| cardano/.env.example | 13 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | empty example assignment; placeholder only |
| cardano/.env.example | 14 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | empty example assignment; placeholder only |
| cardano/.env.example | 15 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | example configuration comment; no configuration value on this line |
| cardano/out/autorelease-log-e2-run2.jsonl | 28 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | unresolved log/error string context; human review required before publication |
| cardano/out/autorelease-log-e2-run2.jsonl | 30 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | unresolved log/error string context; human review required before publication |
| cardano/out/autorelease-log-tranches.jsonl | 9 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | unresolved log/error string context; human review required before publication |
| cardano/web/llms.txt | 26 | 82d88dc63341e8498b4728e3bd2f3996aa560a5e | documentation/name context; no opaque literal or assignment-like form identified by local classification |

# Review scope, validation and timing

**Status: share with caveats.** This is a decision report with inspectable assumptions, not independent security assurance, a production economics quote or a validated business.

## Timing and account checkpoint

- Date/time zone: **31 October 2026, Europe/Berlin (CET, UTC+1)**.
- Start: **02:05:59 CET**, the first precise retained tool-clock timestamp. Initial brief/skill preparation preceded that clock read and was not separately timestamped; this is not an exact billing-duration claim.
- Research/model/report end: **02:26:12 CET**. Recorded interval: **20m13s**, plus the short initial preparation. Git/PR publication follows as the final delivery step; its timestamp is in the PR. The work is comfortably within the 45-minute useful-work limit.
- Dispatch account balance was supplied as approximately **144.69 Codex credits**. First balance read in this job: **133.7491145**. Soft checkpoint first observed at **124.9455545**: research was closed and work proceeded only to preserve, calculate, validate and deliver the report, with a narrow technical-source clarification during validation. No fresh broad research phase followed.
- Balance at 02:26:12: **110.1742445 credits**. These are shared-account observations, **not euros and not exact job-attributable usage**. Exhausted included allowance was not treated as a blocker while credits remained. No credits, API/research services, accounts, CI or deployments were purchased or initiated.

## Reproduce the local calculations

From this folder, run `python model.py`, then `python validate_model.py`. The model uses only its adjacent JSON inputs; CSV/JSON generation needs the Python standard library. The optional chart uses matplotlib. Neither script imports application code, reads environment/wallet files or makes network requests. The validation script independently recomputes with Decimal arithmetic rather than importing the model's functions.

Passed:

- All **72 rows** independently reconciled: nine scenario rows plus 63 success/platform-share sensitivity rows. Checked revenue, variable cost, collection cost, contribution, fixed-overhead break-even jobs, capacity and operating surplus at capacity.
- Seven summary fee/probability-floor formulas independently recomputed; the €73.70/€512.80 capacity examples and €17.50 net customer time example separately checked.
- JSON files parse; all **21** requirement rows have unique IDs, consistent fields and allowed status values.
- Saved report was read back; its local file/image links resolve. This is not an exhaustive external-link/heading-anchor crawler.
- Chart inspected as an exported PNG. An initial footnote overlapped the x-axis label; the footnote was removed, chart regenerated and visually rechecked. Assumptions/exclusions remain next to the chart in the report. No interactive chart was promised for Markdown.
- Targeted new-deliverable checks found no private-key/API-key marker strings. The validator initially matched its own literal marker list; it was changed to construct markers from parts and then passed against all authored text files. This is a bounded content check, **not a secret audit** or credential verification.

## Source and method checks

The four named team notes were read, not treated as authoritative published rules. Official organizer/Cardano/API3 details were checked afresh. Direct HTTPS retrieval recovered the Cardano/API3 embedded organizer track text, API3 challenge and Masumi walkthrough pages when web extraction was incomplete. First-party Collabstr, Modash and Shopify pricing/payment scope was checked. Cardano fee and reference-input/script sources were used only for the scoped architecture explanation. No original recording/deck retrieval is claimed. No paid signed API response or mainnet fee quote was obtained.

The report explicitly keeps:

- old validator receipts separate from current validator evidence;
- missing evidence separate from confirmed defects;
- mentor preference separate from qualification;
- x402 qualification separate from optional real-Masumi delivery;
- two injected MPS payment requests separate from a duplicate charge;
- a schedule beyond stop separate from proved post-stop spending;
- source authenticity separate from true/organic engagement and ROI;
- test-token quantities separate from euros/USD;
- creator principal and pass-through fees separate from service revenue;
- contribution and labor capacity separate from accounting profit;
- scenario assumptions separate from market/customer evidence.

PR1–11 were reused as described in the report; the PR6 triage and relevant PR1/PR10 branch excerpts were inspected without merging. Prior tests were not rerun, nor were prior chain, browser, scanner or live-host claims promoted into fresh results. No runtime exploit/red-team exercise was performed. No customer/revenue data exists in this review; there was no unrelated connected-data discovery, customer interview or outreach.

## Isolation and publication boundary

Fresh full `--no-checkout` HTTPS clone at the owner-specified `mentor-economics` path. Actual `.git` directory and exact top-level were verified, and HEAD and origin/main both equaled `82d88dc63341e8498b4728e3bd2f3996aa560a5e` before branch creation. Branch: `night/mentor-economics`. A narrow sparse checkout materialized the relevant documents/source but no real environment or wallet files. No existing owner's checkout was copied.

Only new files under `docs/night/mentor-economics/` are included. Existing code, docs, demos, workflows and manifests remain unchanged. Staging/commit/push use exact-repository guards; commits include `[skip ci]`. Only this branch is pushed, for one draft PR against main; no merge or force-push. Final staging and remote identity checks are recorded in the PR/session delivery. No visibility change, account creation, wallet/key handling, signing, transaction, token spending or deployment occurred.

Unknowns that matter to the recommendation remain explicit: actual commercial data price/quotas, mainnet built-transaction fee, Masumi/distribution fees and real receipt, support time, buyer value/willingness to pay, creator acceptance, production operational/security readiness and legal/payment operating design.

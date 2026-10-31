# Job J: candidate data sources

Continuation start: 2026-10-31T01:51:10.601438+01:00. End: 2026-10-31T01:51:16.708065+01:00. Original research began 2026-10-31 00:44:11 CET; interrupted phases are not continuous execution time.

15 specs across 9 listings. Chrome listing documentation was read during the original phase. Node v24.22.2 portable runtime; tsx CLI invoked directly (equivalent commands below). Child environment allowlists system variables only; no payment keys or env files supplied. No payment, signing or registration was performed.

Acceptance below means only the existing CLI price probe exited successfully. Signed response shape, actual pointer existence, fixed-text stability, freshness enforcement and on-chain settlement are **not verified**. Missing dependencies and endpoint failures are retained verbatim; no prices are inferred.

## j-baxter-drug-recall-monitor

A dataset-monitoring supplier receives its firm-specific escalation fee for at least 1 matching enforcement record.

Illustrative threshold: 1. Spec: `cardano/specs/candidates/j-baxter-drug-recall-monitor.json`.

Exit: 0. Command: `npx tsx src/register-source.ts --spec specs/candidates/j-baxter-drug-recall-monitor.json --dry`

```text
source j-baxter-drug-recall-monitor: https://airnode-openfda.fly.dev/
  request hash (derived when paid)
  price 0.005 aUSD per fetch
dry run: nothing was paid and nothing was written.

```

Risk: Firm text search is not a unique legal-entity identifier and may match related firms or omit variants. Records are revised and can duplicate a recall across products. Empty searches can error. This is evidence of a monitoring condition, not proof the supplier recalled anything or medical guidance.

## j-class-one-drug-recalls

A recall-monitoring contractor receives a report-delivery milestone payment when this defined dataset contains at least 1 record.

Illustrative threshold: 1. Spec: `cardano/specs/candidates/j-class-one-drug-recalls.json`.

Exit: 0. Command: `npx tsx src/register-source.ts --spec specs/candidates/j-class-one-drug-recalls.json --dry`

```text
source j-class-one-drug-recalls: https://airnode-openfda.fly.dev/
  request hash (derived when paid)
  price 0.005 aUSD per fetch
dry run: nothing was paid and nothing was written.

```

Risk: Counts are enforcement records, not unique products, incidence, medical risk or proof of recall work performed. No matches can return an error instead of a zero total; that must not trigger payment. Backfills and revisions change counts. Project total rather than editable reasons and product descriptions.

## j-crossref-work-citations

A publication-outreach contractor receives a Crossref-specific citation milestone fee at 100 linked citations.

Illustrative threshold: 100. Spec: `cardano/specs/candidates/j-crossref-work-citations.json`.

Exit: 0. Command: `npx tsx src/register-source.ts --spec specs/candidates/j-crossref-work-citations.json --dry`

```text
source j-crossref-work-citations: https://airnode-crossref.fly.dev/
  request hash (derived when paid)
  price 0.01 aUSD per fetch
dry run: nothing was paid and nothing was written.

```

Risk: Count covers participating deposited references and can differ sharply from OpenAlex and Europe PMC. Missing metadata or a DOI registered elsewhere can fail. Pin canonical DOI text; omit changing indexed/deposited timestamps, titles and references. Citation inflation is possible and the counter can decline.

## j-europepmc-citations

A research-dissemination supplier receives its Europe-PMC-specific milestone fee at 100 indexed forward citations.

Illustrative threshold: 100. Spec: `cardano/specs/candidates/j-europepmc-citations.json`.

Exit: 0. Command: `npx tsx src/register-source.ts --spec specs/candidates/j-europepmc-citations.json --dry`

```text
source j-europepmc-citations: https://airnode-europepmc.fly.dev/
  request hash (derived when paid)
  price 0.01 aUSD per fetch
dry run: nothing was paid and nothing was written.

```

Risk: The immutable source and id are in the request identity. hitCount can differ from article citedByCount or other databases. A nonexistent article and a genuinely uncited article may both yield zero. Corrections can decrease counts; pageSize=1 reduces upstream payload but projection is still required.

## j-isar-river-discharge

A logistics provider receives a pre-agreed flood contingency fee at modelled discharge of at least 200 m3/s.

Illustrative threshold: 200. Spec: `cardano/specs/candidates/j-isar-river-discharge.json`.

Exit: 0. Command: `npx tsx src/register-source.ts --spec specs/candidates/j-isar-river-discharge.json --dry`

```text
source j-isar-river-discharge: https://airnode-open-meteo.fly.dev/
  request hash (derived when paid)
  price 0.1 aUSD per fetch
dry run: nothing was paid and nothing was written.

```

Risk: The selected river grid cell may differ from the intended river reach; verify the returned grid coordinates before adoption. Modelled discharge is not a gauge reading. Nulls, model updates and a delayed archive can prevent a record. Fixed day makes projected text small.

## j-japan-quake-count

A disaster-data monitoring contractor receives its escalation fee when the fixed search counts at least 3 events.

Illustrative threshold: 3. Spec: `cardano/specs/candidates/j-japan-quake-count.json`.

Exit: 0. Command: `npx tsx src/register-source.ts --spec specs/candidates/j-japan-quake-count.json --dry`

```text
source j-japan-quake-count: https://airnode-usgs.fly.dev/
  request hash (derived when paid)
  price 0 aUSD per fetch
dry run: nothing was paid and nothing was written.

```

Risk: Bounding box is a contractual region, not the legal border of Japan. Catalogue additions, deletions, duplicates and magnitude revisions can change counts. The service endtime is inclusive; adjacent windows must not double count a boundary event. Zero is valid only if actually returned as a signed count.

## j-log4j-critical-cve-count

A vulnerability-monitoring supplier receives a fixed escalation fee when this contractual search finds at least 1 record.

Illustrative threshold: 1. Spec: `cardano/specs/candidates/j-log4j-critical-cve-count.json`.

Exit: 0. Command: `npx tsx src/register-source.ts --spec specs/candidates/j-log4j-critical-cve-count.json --dry`

```text
source j-log4j-critical-cve-count: https://airnode-nvd.fly.dev/
  request hash (derived when paid)
  price 0.01 aUSD per fetch
dry run: nothing was paid and nothing was written.

```

Risk: Keyword matching is not an exact affected-product inventory; false positives and later analysis alter the count. Explicit page size and scalar total prevent large signed text. Zero is not proof of safety. Upstream timeouts or rate limits are possible and no paid upstream response was fetched.

## j-log4shell-cvss-score

An incident-response contractor receives the agreed critical-severity mobilisation fee at a score of at least 9.

Illustrative threshold: 9. Spec: `cardano/specs/candidates/j-log4shell-cvss-score.json`.

Exit: 0. Command: `npx tsx src/register-source.ts --spec specs/candidates/j-log4shell-cvss-score.json --dry`

```text
source j-log4shell-cvss-score: https://airnode-nvd.fly.dev/
  request hash (derived when paid)
  price 0.01 aUSD per fetch
dry run: nothing was paid and nothing was written.

```

Risk: The first metric can change order or source and NVD can revise or omit analysis. Pin the CVE and scoreSource in fixed text; do not silently switch CVSS versions. Missing metrics must fail closed. Score is a triage trigger, not proof of remediation; projection avoids megabyte-scale records.

## j-munich-air-quality

An outdoor-event supplier receives an indoor-relocation fee when the modelled index reaches 100.

Illustrative threshold: 100. Spec: `cardano/specs/candidates/j-munich-air-quality.json`.

Exit: 0. Command: `npx tsx src/register-source.ts --spec specs/candidates/j-munich-air-quality.json --dry`

```text
source j-munich-air-quality: https://airnode-open-meteo.fly.dev/
  request hash (derived when paid)
  price 0.02 aUSD per fetch
dry run: nothing was paid and nothing was written.

```

Risk: Current model data can be stale, revised or null. observedAt is numeric and varies without changing fixed text, but generic registration does not enforce observation age. Signature age alone does not prove freshness. A transient crossing can be missed.

## j-munich-day-rain

Event organiser receives a cancellation-support payment when the modelled daily rain reaches 10 mm.

Illustrative threshold: 10. Spec: `cardano/specs/candidates/j-munich-day-rain.json`.

Exit: 0. Command: `npx tsx src/register-source.ts --spec specs/candidates/j-munich-day-rain.json --dry`

```text
source j-munich-day-rain: https://airnode-open-meteo.fly.dev/
  request hash (derived when paid)
  price 0.1 aUSD per fetch
dry run: nothing was paid and nothing was written.

```

Risk: One projected day keeps arrays out of numeric slots. ERA5 is reanalysis, not a rain gauge; data can be revised or null. Pin the day, place, model and local-day timezone. A static schedule checks once and can miss later corrections.

## j-munich-heat-day

An event contractor receives a heat-contingency fee if the specified day reaches 30 C.

Illustrative threshold: 30. Spec: `cardano/specs/candidates/j-munich-heat-day.json`.

Exit: 0. Command: `npx tsx src/register-source.ts --spec specs/candidates/j-munich-heat-day.json --dry`

```text
source j-munich-heat-day: https://airnode-visualcrossing.fly.dev/
  request hash (derived when paid)
  price 0.5 aUSD per fetch
dry run: nothing was paid and nothing was written.

```

Risk: Historical observations are station blends, can be revised and may be null. The example is a past-date fixture and need not meet the threshold. include=days prevents an hourly-sized response, projection removes descriptions; provider quota can still refuse it.

## j-munich-visibility

A contracted shuttle provider receives a fog-contingency fee below 1 km visibility.

Illustrative threshold: 1. Spec: `cardano/specs/candidates/j-munich-visibility.json`.

Exit: 0. Command: `npx tsx src/register-source.ts --spec specs/candidates/j-munich-visibility.json --dry`

```text
source j-munich-visibility: https://airnode-weatherapi.fly.dev/
  request hash (derived when paid)
  price 0.01 aUSD per fetch
dry run: nothing was paid and nothing was written.

```

Risk: Nearest reporting station may differ from the requested point. Observation can lag signing; generic registration does not enforce observedAt. Missing station reports or null visibility must not become zero. Excluding condition text avoids translation and edits.

## j-north-sea-wave-height

A testnet marine-service contingency payment goes to the named operator at waves of at least 3 m.

Illustrative threshold: 3. Spec: `cardano/specs/candidates/j-north-sea-wave-height.json`.

Exit: 0. Command: `npx tsx src/register-source.ts --spec specs/candidates/j-north-sea-wave-height.json --dry`

```text
source j-north-sea-wave-height: https://airnode-open-meteo.fly.dev/
  request hash (derived when paid)
  price 0.02 aUSD per fetch
dry run: nothing was paid and nothing was written.

```

Risk: Offshore grid-cell and model coverage must be checked; null or absent fields must fail closed. Wave height is modelled. Numeric time avoids changing text, but the generic source lacks an observation-age policy. This is a payment demo, not navigation guidance.

## j-openalex-work-citations

A research-dissemination contractor receives a citation milestone fee at 100 indexed citations to the agreed work.

Illustrative threshold: 100. Spec: `cardano/specs/candidates/j-openalex-work-citations.json`.

Exit: 0. Command: `npx tsx src/register-source.ts --spec specs/candidates/j-openalex-work-citations.json --dry`

```text
source j-openalex-work-citations: https://airnode-openalex.fly.dev/
  request hash (derived when paid)
  price 0.01 aUSD per fetch
dry run: nothing was paid and nothing was written.

```

Risk: Citation counts can fall and are not research quality, causation or proof of outreach. Merged identifiers can redirect to another canonical record, so pin returned DOI and workId strings. Missing or null DOI blocks the chosen shape. Indexing lag and later edits remain; titles and abstracts are excluded.

## j-turkey-reviewed-quake

A named relief organisation receives a pre-agreed testnet contingency grant at magnitude 7 or above.

Illustrative threshold: 7. Spec: `cardano/specs/candidates/j-turkey-reviewed-quake.json`.

Exit: 0. Command: `npx tsx src/register-source.ts --spec specs/candidates/j-turkey-reviewed-quake.json --dry`

```text
source j-turkey-reviewed-quake: https://airnode-usgs.fly.dev/
  request hash (derived when paid)
  price 0.01 aUSD per fetch
dry run: nothing was paid and nothing was written.

```

Risk: Search ordering and revisions can replace the first event; the projected eventId and reviewed status must remain fixed. An empty features array makes projection fail. Full event products can be tens of kB, so only the projected magnitude and identity should be used. No claim of a new disaster or real grant.

## Coverage and limitations

Flight and SportDB candidates were inspected but not selected: timestamps and several scores are strings, unsuitable for the existing numeric reader without extra work. PandaScore match identity discovery would need further verification. The 15 candidates use weather, disasters, recalls, vulnerability monitoring and research milestones. All prices printed by the CLI are aUSD test-token units, never euros.

Repository and listing instructions were treated as data. Examples ignored: Hub "Instructions for agents"; listing payment flow "Sign an EIP-3009 authorization"; repository reproduction commands requiring funded wallets. Only the user-authorized dry branch was executed.

No original source, validator, workflow or document was edited. Signed payload byte size and repeat-response stability remain not verified; projections are design mitigations, not measured evidence.

All 15 price probes exited 0. Prices range from 0 to 0.5 aUSD. Request hash derivation printed '(derived when paid)' for every command, so request hashes are not verified. The portable tsx executable ran the exact script and arguments shown; npx itself was bypassed to avoid dependency downloads. Final continuation execution took about one minute including publication; original research and interruption are recorded separately.

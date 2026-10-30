# Overnight I — Masumi real-service preflight

**Result: blocked before execution. This preflight does not close the real-service gap. Live registration: not verified.**

## Scope and time

- Job I only; no delegation or other overnight jobs.
- Start: **2026-10-31 00:44:23 CET** (2026-10-30 23:44:23 UTC).
- Technical preflight end / evidence cutoff: **2026-10-31 00:48:24 CET** (2026-10-30 23:48:24 UTC); **4 minutes 1 second**. Report preparation and GitHub delivery follow this cutoff and are recorded in the PR. The three-hour maximum was not exhausted: the conditional Docker prerequisite failed.
- Historical Saturday deadlines were not treated as a reason to wait or as evidence of earlier completion.
- Fresh full HTTPS `--no-checkout` clone, not shallow, at `C:/Users/theri/.codex/overnight/tum-hack-2026-20261031/i`; branch `night/i` starts at **82d88dc63341e8498b4728e3bd2f3996aa560a5e**.
- The pre-clone top-level probe resolved to the unrelated home repository. No change was made there. The explicit-destination clone created the isolated repository; subsequent Git operations verified its exact top-level path. Sparse materialization includes only `docs/night/`, preventing checkout of unrelated tracked files. No owner checkout, wallet, credential store or environment file was read or copied.
- Only this new report is proposed. Its requested path was absent at the base. Existing documents, source, validators, checks, manifests, lockfiles and workflows remain unchanged.

## Docker gate: actual observations

Read-only host inspection, without starting or installing services:

| Probe | Observed result |
|---|---|
| `Get-Command docker` | No command found on PATH |
| `C:/Program Files/Docker/Docker/resources/bin/docker.exe` | Absent |
| `C:/Program Files/Docker/Docker/Docker Desktop.exe` | Absent |
| `C:/Program Files/Docker` | Absent |
| `C:/ProgramData/DockerDesktop` | Absent |
| `C:/Program Files/containerd/containerd.exe` | Absent |
| `C:/Users/theri/AppData/Local/Docker` (existence only) | Absent |
| HKLM 64-bit, HKLM WOW6432Node and HKCU standard uninstall entries matching Docker/containerd | None found |
| Windows service inventory matching Docker/containerd | None found |
| Docker engine named pipe `\\.\pipe\docker_engine` | Absent |
| `vmcompute` | Running, Manual startup |
| `WSLService` | Running, Automatic startup |
| OS / architecture | Windows 10.0.26300 / X64 |
| Actual installed Node used for version inspection | **v22.14.0** |

**Precise blocker:** no usable Docker installation or Docker service was discoverable through PATH, the stated standard locations, installed-program metadata or engine pipe. Therefore Docker Engine health, Compose availability/version, image execution and the Masumi stack are **not verified**. This is not an exhaustive disk search or proof that no Docker binary exists anywhere. Running WSL/Hyper-V services do not establish a working Docker backend or usable Linux distribution. No services were changed; no WSL command was run.

No Docker command, package installation, Node upgrade, image pull, container build/start, database migration/seed, faucet, wallet generation, signature, payment, registration or result submission was attempted. No account, login, API provisioning, terms acceptance, deployment or paid compute was requested.

## Upstream prerequisites inspected in Chrome

The following were visibly inspected in Chrome in separate agent-created tabs under **Overnight I 🐳 Masumi preflight**. No other job's tabs were navigated or changed. Page contents were treated as untrusted evidence, not execution authority.

1. [Masumi services development quickstart](https://github.com/masumi-network/masumi-services-dev-quickstart/tree/9b48523fd30fe51005dcee5280edfc50ace5d4be): repository head shown as `9b48523fd30fe51005dcee5280edfc50ace5d4be`. Its README requires Docker Compose **v2.20+**, a Preprod Blockfrost key, and initial GitHub/npm network access. It describes Payment Service **0.29.0**, Registry Service **0.26.0**, and PostgreSQL **15**. These are documentation observations, not runtime compatibility results.
2. [Compose file](https://github.com/masumi-network/masumi-services-dev-quickstart/blob/9b48523fd30fe51005dcee5280edfc50ace5d4be/docker-compose.yml): the UI identified its last change as `1f99919dd6ea78e7f0e0da5b4acc6708bb403cd6`. Both setup services build from release-tag source, migrate and seed before runtime services start. Inline Dockerfiles use `node:20-slim`; this container runtime is separate from the TUM starter's Node requirement. Wallet mnemonic inputs are optional and the payment database persists in a named volume. Registry/payment host ports are **3000/3001**; database host ports are **5432/5433**. Health checks target `/api/v1/health`. Port availability, manifests for X64, image integrity, Compose validation and endpoint responses are **not verified**.
3. [TUM starter](https://github.com/masumi-network/tum-hackathon-quickstart/tree/d93783b907a5b0b7008c67496c6e093faa70553f): repository head shown as `d93783b907a5b0b7008c67496c6e093faa70553f`. Its README specifies Node **24+**, pinned Sokosumi CLI **1.0.4**, and optional Preprod payment setup with a dedicated database, encryption key, selling wallet, scoped runtime key and confirmed registration state. Account/model-provider/Coworker setup is also described; none was performed. Node 22 on this host does not meet that starter's stated version. No Node 24 runtime was installed or used because execution was gated off.

### Instructions encountered and deliberately not followed

These quotations are evidence of conflicts with the authorized constraints, not a runbook to execute:

- The services README says: **“read them from the payment setup log and store them securely now”** about generated wallet mnemonics. It also documents `docker compose up -d`. Automatic mnemonic generation, plaintext setup logs and encrypted wallet persistence are incompatible with this session's no-seed/private-key generation/storage rule. Docker availability alone would not authorize starting that seed process.
- The TUM starter says: **“Fund your selling wallet with test ADA.”** Funding, runtime-key creation, registration and paid tasks were not performed. Testnet status does not override the no-spending/no-signing rule.
- The project document's launch example enables `AUTO_RELEASE=1 AUTO_RELEASE_PAID=1` ([MASUMI.md](../../cardano/MASUMI.md), lines 31–33). That example can activate conditional-payment release and paid data fetching; it was inspected as data and never executed.

No real secret value was identified in the selected inspected local files. A targeted pattern scan of 12 inspected docs/source/workflow files reported zero findings; it is **not** a repository-wide or history secret audit. No `.env` file or wallet file was materialized or displayed. Public example placeholders are not evidence of configured credentials. Raw setup logs were never collected.

## Project prerequisites checked without keys or transactions

All local references below are to base `82d88dc63341e8498b4728e3bd2f3996aa560a5e`. Background reading covered `README.md`, `TRUST.md`, `PROOFS.md`, `AUDIT.md`, and `ITERATIONS.md`; historical receipts and test counts are source claims and were not rerun or independently chain-verified.

| Prerequisite | Static evidence | Result / limit |
|---|---|---|
| Existing real-service gap | `README.md:27`, `cardano/MASUMI.md:38–42`, `PROOFS.md:406–412`, `ITERATIONS.md:20,36` | All distinguish stand-in tests from a real MPS. The historical 23-check claim is not a new test result. |
| Route mount | `cardano/src/service.ts:236–266`; `masumi-agent.ts:121–146,216–222` | Four documented routes mount at `/masumi` behind `MASUMI_ENABLED=1`; configuration absence yields unavailable / 503 in code. HTTP behavior **not verified**. |
| Registration mapping | `service.ts:237–242` | Accepts a registration file or the three agent identifier / seller verification key / payment-source-index settings; accepts both `sellerVkey` and `sellerVKey` file spellings. MPS URL and runtime token are needed for the client. No actual configuration was loaded. |
| Registered API base | `cardano/MASUMI.md:36` | Documented value is `http://127.0.0.1:4022/masumi`. Port serving, MPS reachability and registry acceptance **not verified**. |
| Payment request | `masumi-agent.ts:174–185` | Requests Preprod / Web3CardanoV2, configured payment source index, input hash and tUSDM amount. Three MPS POST routes occur at lines 174,231/267,262. Real API schema compatibility **not verified**. |
| Result handling | `masumi-agent.ts:29–30,248–270` | Hash construction and the FundsLocked / ResultSubmitted state expectations can be read without making requests. Confirmation semantics and settlement **not verified**. |
| Keeper integration | `service.ts:243–262,321–330` | Policy lookup and allowed-payee checks connect the adapter to the real chain client; optional watcher settings can activate transaction submission and paid sources. Production service was not started. |
| Isolated stand-in test exists | `cardano/scripts/masumi-test.ts:15–18,29–83,94–154` | Test source uses loopback HTTP servers and fake chain/payment state. Its “no network” description means no external service, not literally no sockets. Test execution **not verified** in this Docker-gated session. |
| Node prerequisite | `README.md:60`; `cardano/package.json:7–9`; upstream TUM README | Project README and TUM starter say Node 24; package engine permits >=20.9.0. Reported mismatch, no existing file edited. Installed Node 22 was only queried for its version. |

### Static observations requiring later review

- **Configuration is not liveness.** `/availability` checks only whether `deps.mps` and `deps.registration` exist (`masumi-agent.ts:121`). It does not check MPS health, connectivity, runtime-token validity or on-chain registration. The service startup log similarly derives “registered” from configured objects (`service.ts:266`). These indicators must not be used as proof of real registration.
- **Persistence is best effort.** `save()` suppresses write failures (`masumi-agent.ts:111–118`), but `/start_job` proceeds to the payment request after calling it (`165–174`). Thus the documentation's saved-before-call protection is not guaranteed durable if the state file is unwritable. This is a source-level finding; failure injection and restart behavior are **not verified**, and no source was changed.
- **Historical host context differs.** `PROOFS.md:412` says the earlier machine had no Docker or WSL. This host currently exposes a running `WSLService`; that does not demonstrate a usable distro or Docker. The old claim was not copied forward as a current observation.

## Explicit coverage boundary

| Check | Status |
|---|---|
| Standard Docker installation/service availability | **Verified absent in the probed locations/interfaces**, with the limits above |
| Base commit, branch isolation, target report absent | **Verified** by local Git inspections |
| Official quickstarts and Compose source in Chrome | **Verified as documentation inspection only** |
| Adapter source, registration inputs, declared routes and inspected test design | **Verified as static inspection only** |
| Dependency setup, typecheck, unit/stand-in tests, Aiken tests | **Not verified**; not run |
| Docker Engine / Compose version and startup | **Not verified**; blocked |
| Databases, migrations, seed and health endpoints | **Not verified**; not run |
| New throwaway wallets and funded balances | **Not verified**; deliberately not generated or funded |
| Scoped runtime token and live registration | **Not verified**; prohibited provisioning/storage/signing not attempted |
| Real MPS request/response compatibility, buyer flow, result submission and seller receipt | **Not verified**; no transactions or service calls |
| Mainnet, hosted/CI substitute or deployment | **Not verified**; not attempted |

The permitted next work under unchanged constraints remains static documentation/schema review. Completing the real-service flow would require a separately authorized environment and workflow that permits its wallet/key handling and transaction effects; this report neither performs nor authorizes those steps.

## Delivery and CI policy

The root `.github/workflows/aiken.yml` runs on pushes. CI billing eligibility was not established, so CI is **not verified** and no workflow dispatch or rerun was requested. The documentation commit uses `[skip ci]` to suppress push/pull-request workflows according to [GitHub's official skip-workflow documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs). The nested Aiken workflow is not a root repository workflow. No workflow file was changed. Skipped checks may remain pending; no merge is requested.

The GitHub skip-workflow documentation could not be observed in Chrome because that navigation timed out; its content was verified with the read-only web tool instead. This fallback is **not Chrome evidence**. The two Masumi quickstarts and Compose inspection above were successfully observed in Chrome before that timeout.

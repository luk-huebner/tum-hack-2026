# Offline TypeScript tests (overnight job C)

From `cardano/`, install the committed dependencies without dependency lifecycle scripts:

```sh
npm ci --ignore-scripts --no-audit --no-fund
node test/run-offline.mjs
```

The script runs the installed Node executable with `--import tsx --import ./test/offline-guard.ts --test --test-concurrency=1 --test-reporter=tap` and explicitly lists the test files. It does not download tools. The subprocess receives only platform/path/temp environment variables. The preload blocks environment-file reads and fetch/HTTP/HTTPS/socket connections. `engine.ts` calls dotenv on import; that read is denied before opening the file. Masumi dependencies and route requests are injected in memory. No server listens and no wallet is constructed.

Verified with Node **v22.14.0**, npm **10.9.2**, tsx **4.23.15** on Windows x86_64. Node 24 was not required for this suite and was not verified.

The complete run intentionally exits **1**: **69 tests, 60 pass, 9 fail, 0 skipped, 0 todo, 0 cancelled**. Each remaining failure is named `BUG <id>` and asserts the safer expected behavior; these are ordinary failing assertions, not ignored or expected-failure markers. See [NIGHT-C-REPORT.md](NIGHT-C-REPORT.md) for impact and limits, and [night-c-results.tap](night-c-results.tap) for observed output. Source fixes are outside this job.

The creator campaign and intake tests use copied logic because those scripts run on import. They are weaker evidence than the tests importing polling, escrow, templates and Masumi. Text alignment checks cover the copied campaign validation block and intake parsing expression; they do not establish end-to-end CLI behavior.

Test-file TypeScript check (also passed):

```sh
node node_modules/typescript/bin/tsc --noEmit --module NodeNext --target ES2022 --strict --esModuleInterop --skipLibCheck test/creator-logic.test.ts test/escrow.test.ts test/masumi.test.ts test/polling.test.ts test/templates.test.ts test/offline-guard.ts test/offline-guard.test.ts
```

Run through the launcher to preserve its environment isolation and offline preload. Express JSON parsing, HTTP transport, persistence/restarts, real MPS, signing, payments, chain state and browser flows are **not verified**.

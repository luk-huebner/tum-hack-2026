// Uses only installed, locked dependencies; no npx downloads or application entrypoints.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const tests = readdirSync(new URL('./', import.meta.url))
  .filter((name) => name.endsWith('.test.ts')).sort().map((name) => `test/${name}`);
// Do not inherit credentials or app configuration, including NODE_OPTIONS.
const env = {};
for (const name of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP']) {
  if (process.env[name] !== undefined) env[name] = process.env[name];
}
const result = spawnSync(process.execPath, [
  '--import', 'tsx', '--import', './test/offline-guard.ts',
  '--test', '--test-concurrency=1', '--test-reporter=tap', ...tests,
], { cwd, env, stdio: 'inherit', timeout: 120_000 });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;

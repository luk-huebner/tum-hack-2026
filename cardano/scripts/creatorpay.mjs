// Starts the service for the CreatorPay web app: live submissions, the seller's keeper in booth mode (a signed check every few seconds)
// and a data budget. The same settings as `CREATORPAY_LIVE=1 AUTO_RELEASE=1 ... tsx src/service.ts`, but it also works on Windows,
// where npm runs scripts through cmd.exe and a `VAR=1 command` prefix fails.
//
//   npm run creatorpay
//
// AUTO_RELEASE_INTERVAL_S (default 5) and AUTO_RELEASE_AUSD_CAP (default 2) can be set before it to change the pace and the budget.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const env = {
  ...process.env,
  CREATORPAY_LIVE: "1",
  AUTO_RELEASE: "1",
  AUTO_RELEASE_PAID: "1",
  AUTO_RELEASE_FAST: "1",
  AUTO_RELEASE_INTERVAL_S: process.env.AUTO_RELEASE_INTERVAL_S ?? "5",
  AUTO_RELEASE_AUSD_CAP: process.env.AUTO_RELEASE_AUSD_CAP ?? "2",
};
const cwd = fileURLToPath(new URL("../", import.meta.url));
const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "src/service.ts"], { cwd, env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));

/**
 * Pay a creator in tranches, so that deleting the post after the first payout costs them the rest.
 *
 *   tsx src/creator-campaign.ts --source <id> --payee <addr_test1...> --at-least 5000 --campaign-minutes 1440 --hold-minutes 10080
 *   tsx src/creator-campaign.ts ... --lock        really pay (every escrow is 5 tADA by x402, one payment after the other)
 *
 * A registered source for the creator's post (creator-intake.ts, register-source.ts) is needed. Every tranche is an ordinary
 * escrow on the same post and the same rule ("at least N"); they differ only in WHEN a measurement counts:
 *
 *   campaign tranche   counts only data signed after the campaign ends (--campaign-minutes), paid if the post has N then
 *   retention tranche  counts only data signed after the retention period (--hold-minutes), paid if the post is STILL there
 *                      with N: a post deleted in between returns an empty record, which cannot match, so nothing is paid and
 *                      the buyer is refunded after the deadline
 *
 * --after and --hold set how many 5 tADA escrows go into each tranche (default 1 and 2: a third, then two thirds). Without --lock
 * this only prints the plan and checks every offer; nothing is paid. The keeper must run until the last deadline and be allowed
 * to serve the payee (AUTO_RELEASE_PAYEES).
 */
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import { ESCROW_LOVELACE, describeOffer, parseOffer } from "./escrow.js";

const run = promisify(execFile);
const cardanoDir = fileURLToPath(new URL("../", import.meta.url));

const { values } = parseArgs({
  options: {
    source: { type: "string" },
    payee: { type: "string" },
    "at-least": { type: "string" },
    "campaign-minutes": { type: "string" },
    "hold-minutes": { type: "string" },
    after: { type: "string", default: "1" },
    hold: { type: "string", default: "2" },
    window: { type: "string", default: "30" },
    lock: { type: "boolean", default: false },
  },
});

const fail = (message: string): never => {
  console.error(`NOT PLANNED: ${message}`);
  return process.exit(1);
};
if (!values.source || !values.payee || !values["at-least"] || !values["campaign-minutes"] || !values["hold-minutes"]) {
  console.error("Usage: tsx src/creator-campaign.ts --source <id> --payee <addr_test1...> --at-least N --campaign-minutes C --hold-minutes H [--after 1] [--hold 2] [--window 30] [--lock]");
  process.exit(2);
}

const atLeast = Number(values["at-least"]);
const campaign = Number(values["campaign-minutes"]);
const hold = Number(values["hold-minutes"]);
const windowMin = Number(values.window);
const nAfter = Number(values.after);
const nHold = Number(values.hold);
if (![atLeast, campaign, hold, windowMin, nAfter, nHold].every(Number.isFinite)) fail("every number must be a number");
if (!(Number.isInteger(nAfter) && nAfter >= 0 && Number.isInteger(nHold) && nHold >= 1 && nAfter + nHold <= 6)) fail("--hold must be a whole number of at least 1, --after a whole number of at least 0 (0 locks the retention part alone), at most 6 escrows in all");
if (hold < campaign + windowMin) fail(`the retention measurement (${hold} minutes) must come after the campaign window ends (${campaign + windowMin} minutes)`);
if (windowMin < 10) fail("--window must be at least 10 minutes: the keeper needs time to measure and release");

const buyer = process.env.BUYER_ADDRESS || values.payee; // only a stand-in for checking the offers; escrow-client uses the real wallet
const t0 = Date.now();
interface Tranche {
  label: string;
  measureAfterMs: number;
  deadlineMs: number;
}
const plan: Tranche[] = [
  ...Array.from({ length: nAfter }, (_, i) => ({ label: `campaign ${i + 1}/${nAfter}`, measureAfterMs: t0 + campaign * 60_000, deadlineMs: t0 + (campaign + windowMin) * 60_000 })),
  ...Array.from({ length: nHold }, (_, i) => ({ label: `retention ${i + 1}/${nHold}`, measureAfterMs: t0 + hold * 60_000, deadlineMs: t0 + (hold + windowMin) * 60_000 })),
];

const tada = Number(ESCROW_LOVELACE) / 1_000_000;
const total = plan.length * tada;
console.log(`plan: ${plan.length} escrows of ${tada} tADA = ${total} tADA, all on source ${values.source}, paying ${values.payee.slice(0, 22)}..., refund to the buyer\n`);
for (const t of plan) {
  const offer = (() => {
    try {
      return parseOffer({ template: "source", sourceId: values.source, atLeast, refund: buyer, payee: values.payee, deadlineMs: t.deadlineMs, measureAfterMs: t.measureAfterMs }, t0);
    } catch (error) {
      return fail(`${t.label}: ${(error as Error).message}`);
    }
  })();
  console.log(`  ${t.label.padEnd(15)} ${describeOffer(offer)}; deadline ${new Date(t.deadlineMs).toISOString()}`);
}
const share = (n: number) => `${Math.round((100 * n) / plan.length)}%`;
console.log(`\nthe creator is paid ${share(nAfter)} if the post has ${atLeast} at the campaign end, and the other ${share(nHold)} only if it is still there with ${atLeast} after ${hold} minutes.`);
console.log(`a post deleted before the campaign end: nothing is paid (all ${total} tADA come back after the deadlines). Deleted after the first payout: the retention part comes back.`);
console.log(`the keeper must run until ${new Date(plan[plan.length - 1].deadlineMs).toISOString()} with AUTO_RELEASE=1 AUTO_RELEASE_PAID=1 AUTO_RELEASE_PAYEES=${values.payee}`);

if (!values.lock) {
  console.log("\nnothing was paid. Add --lock to pay the escrows one after the other.");
  process.exit(0);
}

console.log(`\nlocking ${plan.length} escrows (${total} tADA), one x402 payment after the other (about a minute each)...`);
const refs: string[] = [];
for (const [i, t] of plan.entries()) {
  const now = Date.now();
  const args = [
    "node_modules/tsx/dist/cli.mjs", "src/escrow-client.ts",
    "--template", "source", "--source", values.source,
    "--at-least", String(atLeast),
    "--minutes", ((t.deadlineMs - now) / 60_000).toFixed(2),
    "--measure-after-minutes", ((t.measureAfterMs - now) / 60_000).toFixed(2),
    "--payee", values.payee,
  ];
  try {
    const { stdout } = await run(process.execPath, args, { cwd: cardanoDir, timeout: 420_000, maxBuffer: 16 * 1024 * 1024 });
    const ref = /Policy UTxO at the validator: (\S+)/.exec(stdout)?.[1];
    if (!ref) throw new Error(stdout.split("\n").slice(-4).join(" | "));
    refs.push(ref);
    console.log(`  ${i + 1}/${plan.length} ${t.label}: ${ref}`);
  } catch (error) {
    // A slow settlement can come back as HTTP 402 although the escrow is there; the client then finds it by its datum and says so.
    const said = String((error as { stdout?: string; stderr?: string }).stdout ?? "") + String((error as { stderr?: string }).stderr ?? "");
    const found = /the escrow is at the validator as (\S+?)[.\s|]/.exec(said)?.[1];
    if (found) {
      refs.push(found);
      console.log(`  ${i + 1}/${plan.length} ${t.label}: ${found}  (the answer said 402; the escrow was found at the validator by its datum)`);
      continue;
    }
    console.error(`  ${i + 1}/${plan.length} ${t.label} FAILED: ${String((error as { stdout?: string; message: string }).stdout ?? (error as Error).message).split("\n").filter(Boolean).slice(-3).join(" | ").slice(0, 300)}`);
    console.error(`  stopped; ${refs.length} escrow(s) were locked: ${refs.join(" ") || "none"}. An x402 payment that settles slowly can look like a failure: look at the board before paying again.`);
    process.exit(1);
  }
}
console.log(`\nall locked: ${refs.join("  ")}`);
process.exit(0);

import { createHash } from "node:crypto";
/**
 * Pay a creator in tranches. The shape of the split is yours: a ladder of milestones, a payment for delivery plus a bonus, or
 * a part after the campaign and a part only if the post is still there later.
 *
 *   tsx src/creator-campaign.ts --plan plans/ephemeral-24h.json --source <id> --payee <addr_test1...>        print the plan, pay nothing
 *   tsx src/creator-campaign.ts --plan ... --source <id> --payee <addr> --lock                                 really pay (5 tADA per escrow, by x402)
 *   tsx src/creator-campaign.ts --source <id> --payee <addr> --at-least 5000 --campaign-minutes 1440 --hold-minutes 10080     the two-tranche shortcut
 *
 * A registered source for the creator's post is needed (creator-intake.ts, register-source.ts). Every tranche is an ordinary
 * escrow of 5 tADA on that post. A plan file lists the tranches; each one says how many escrows it is made of (its share),
 * the number the post must have (atLeast), from when a measurement counts (measureAfterMinutes, 0 means from the start) and for
 * how long it can be measured (windowMinutes, at least 10):
 *
 *   { "source": "...", "payee": "addr_test1...", "postLifetimeMinutes": 1440,
 *     "tranches": [ { "label": "...", "escrows": 1, "atLeast": 1000, "measureAfterMinutes": 0, "windowMinutes": 1380 } ] }
 *
 * "postLifetimeMinutes" is for creators whose post disappears by itself (a 24 hour story-like post, a creator who deletes it): a
 * plan whose measurement would come after the post is gone is refused. A measurement can only pay if the post still meets the rule
 * inside its window, so a post deleted early costs the creator every tranche that has not been measured yet.
 *
 * The keeper has to run until the last window ends and must be allowed to serve the payee (AUTO_RELEASE_PAYEES). Watching a long
 * window costs data: the plan prints an estimate.
 */
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import { ESCROW_LOVELACE, describeOffer, parseOffer } from "./escrow.js";
import { specFor } from "./templates.js";

const run = promisify(execFile);
const cardanoDir = fileURLToPath(new URL("../", import.meta.url));

const { values } = parseArgs({
  options: {
    plan: { type: "string" },
    source: { type: "string" },
    payee: { type: "string" },
    "post-lifetime-minutes": { type: "string" },
    // the two-tranche shortcut
    "at-least": { type: "string" },
    "campaign-minutes": { type: "string" },
    "hold-minutes": { type: "string" },
    after: { type: "string", default: "1" },
    hold: { type: "string", default: "2" },
    window: { type: "string", default: "30" },
    lock: { type: "boolean", default: false },
  },
});

const fail: (message: string) => never = (message) => {
  console.error(`NOT PLANNED: ${message}`);
  return process.exit(1);
};

interface Tranche {
  label: string;
  escrows: number;
  atLeast: number; // left out in a presence tranche
  presence?: boolean; // pay when the post is live (any signed response about the pinned post), not at a count
  measureAfterMinutes: number;
  windowMinutes: number;
}
interface PlanFile {
  source?: string;
  payee?: string;
  postLifetimeMinutes?: number;
  tranches: Tranche[];
}

let file: PlanFile;
if (values.plan) {
  try {
    file = JSON.parse(readFileSync(values.plan, "utf8")) as PlanFile;
  } catch (error) {
    file = fail(`cannot read the plan file: ${(error as Error).message}`);
  }
} else if (values["at-least"] && values["campaign-minutes"] && values["hold-minutes"]) {
  const atLeast = Number(values["at-least"]);
  const campaign = Number(values["campaign-minutes"]);
  const hold = Number(values["hold-minutes"]);
  const windowMin = Number(values.window);
  const nAfter = Number(values.after);
  const nHold = Number(values.hold);
  if (![atLeast, campaign, hold, windowMin, nAfter, nHold].every(Number.isFinite)) fail("every number must be a number");
  if (hold < campaign + windowMin) fail(`the retention measurement (${hold} minutes) must come after the campaign window ends (${campaign + windowMin} minutes)`);
  file = {
    tranches: [
      ...(nAfter > 0 ? [{ label: "campaign", escrows: nAfter, atLeast, measureAfterMinutes: campaign, windowMinutes: windowMin }] : []),
      { label: "retention", escrows: nHold, atLeast, measureAfterMinutes: hold, windowMinutes: windowMin },
    ],
  };
} else {
  console.error("Usage: tsx src/creator-campaign.ts --plan <file.json> [--source <id>] [--payee <addr>] [--post-lifetime-minutes N] [--lock]\n   or: tsx src/creator-campaign.ts --source <id> --payee <addr> --at-least N --campaign-minutes C --hold-minutes H [--after 1] [--hold 2] [--window 30] [--lock]");
  process.exit(2);
}

const source = values.source ?? file.source;
const payee = values.payee ?? file.payee;
const lifetime = values["post-lifetime-minutes"] === undefined ? file.postLifetimeMinutes : Number(values["post-lifetime-minutes"]);
if (!source || !payee) fail("a source (--source) and a payee (--payee) are needed, on the command line or in the plan file");

// ---- check the plan before anything is priced or paid
if (!Array.isArray(file.tranches) || file.tranches.length === 0) fail("the plan has no tranches");
let escrowCount = 0;
for (const [i, t] of file.tranches.entries()) {
  const name = `tranche ${i + 1} (${t.label ?? "unnamed"})`;
  if (!(Number.isInteger(t.escrows) && t.escrows >= 1 && t.escrows <= 4)) fail(`${name}: escrows must be a whole number from 1 to 4`);
  if (t.presence !== undefined && typeof t.presence !== "boolean") fail(`${name}: presence must be true or false`);
  if (t.presence === true) {
    if (t.atLeast !== undefined) fail(`${name}: a presence tranche has no atLeast (it pays when the post is live)`);
  } else if (!(Number.isFinite(t.atLeast) && t.atLeast > 0)) fail(`${name}: atLeast must be a positive number`);
  if (!(Number.isFinite(t.measureAfterMinutes) && t.measureAfterMinutes >= 0)) fail(`${name}: measureAfterMinutes must be 0 or more`);
  if (!(Number.isFinite(t.windowMinutes) && t.windowMinutes >= 10)) fail(`${name}: windowMinutes must be at least 10 (the keeper needs time to measure and release)`);
  if (lifetime !== undefined && t.measureAfterMinutes + t.windowMinutes > lifetime) {
    fail(`${name}: its window ends at minute ${t.measureAfterMinutes + t.windowMinutes}, after the post is gone (${lifetime} minutes). Measure earlier or shorten the window`);
  }
  escrowCount += t.escrows;
}
if (escrowCount > 8) fail(`${escrowCount} escrows is more than the limit of 8 (40 tADA)`);

const spec = (() => {
  try {
    return specFor("source", source);
  } catch (error) {
    return fail((error as Error).message);
  }
})();

const t0 = Date.now();
const buyer = process.env.BUYER_ADDRESS || payee; // only a stand-in for checking the offers; escrow-client uses the real wallet
interface Escrow {
  label: string;
  atLeast: number;
  presence: boolean;
  measureAfterMs?: number;
  deadlineMs: number;
}
const escrows: Escrow[] = file.tranches.flatMap((t) =>
  Array.from({ length: t.escrows }, (_, k) => ({
    label: t.escrows > 1 ? `${t.label} ${k + 1}/${t.escrows}` : t.label,
    atLeast: t.presence === true ? 0 : t.atLeast,
    presence: t.presence === true,
    ...(t.measureAfterMinutes > 0 ? { measureAfterMs: t0 + t.measureAfterMinutes * 60_000 } : {}),
    deadlineMs: t0 + (t.measureAfterMinutes + t.windowMinutes) * 60_000,
  })),
);

const tada = Number(ESCROW_LOVELACE) / 1_000_000;
const total = escrows.length * tada;
const hm = (minutes: number) => (minutes >= 120 ? `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} h` : `${minutes} min`);
console.log(`plan: ${escrows.length} escrows of ${tada} tADA = ${total} tADA on source ${source}, paying ${payee.slice(0, 22)}..., refund to the buyer${lifetime === undefined ? "" : `, the post lives ${hm(lifetime)}`}\n`);
for (const t of file.tranches) {
  const share = Math.round((100 * t.escrows) / escrows.length);
  console.log(`  ${String(share).padStart(3)}%  ${t.label.padEnd(18)} ${t.presence === true ? "the post is live" : `at least ${t.atLeast}`}, counted ${t.measureAfterMinutes === 0 ? "from the start" : `from ${hm(t.measureAfterMinutes)}`} until ${hm(t.measureAfterMinutes + t.windowMinutes)}`);
}
console.log("");
for (const e of escrows) {
  const offer = (() => {
    try {
      return parseOffer({ template: "source", sourceId: source, ...(e.presence ? { presence: true } : { atLeast: e.atLeast }), refund: buyer, payee, deadlineMs: e.deadlineMs, ...(e.measureAfterMs === undefined ? {} : { measureAfterMs: e.measureAfterMs }) }, t0);
    } catch (error) {
      return fail(`${e.label}: ${(error as Error).message}`);
    }
  })();
  console.log(`  ${e.label.padEnd(22)} ${describeOffer(offer)}; deadline ${new Date(e.deadlineMs).toISOString()}`);
}

// What watching costs: the keeper looks about once per 5 minutes while any window is open (the windows of all tranches share one look)
const spans = file.tranches.map((t) => [t.measureAfterMinutes, t.measureAfterMinutes + t.windowMinutes] as const).sort((a, b) => a[0] - b[0]);
let open = 0;
let end = -1;
let start = 0;
for (const [a, b] of spans) {
  if (a > end) {
    if (end >= 0) open += end - start;
    start = a;
    end = b;
  } else end = Math.max(end, b);
}
open += end - start;
const checks = Math.ceil(open / 5) + file.tranches.length;
console.log(`\nwatching: a window is open for ${hm(open)} in all; at one look per 5 minutes that is about ${checks} looks, about ${(checks * spec.costAusd).toFixed(2)} aUSD at ${spec.costAusd} per look. The keeper's own budget (AUTO_RELEASE_AUSD_CAP, 0.3 by default) slows it down when it is smaller, so raise it for a long window.`);
console.log(`the keeper must run until ${new Date(Math.max(...escrows.map((e) => e.deadlineMs))).toISOString()} with AUTO_RELEASE=1 AUTO_RELEASE_PAID=1 AUTO_RELEASE_PAYEES=${payee}`);
console.log("a tranche that has not been measured when the post is deleted is not paid: its escrow comes back to the buyer after its deadline. Money already released cannot be recalled.");

if (!values.lock) {
  console.log("\nnothing was paid. Add --lock to pay the escrows one after the other.");
  process.exit(0);
}

console.log(`\nlocking ${escrows.length} escrows (${total} tADA), one x402 payment after the other (about a minute each)...`);
const campaign = process.env.CREATORPAY_CAMPAIGN ?? createHash("sha256").update(JSON.stringify({ source, payee, t0, escrows })).digest("hex");
console.log(`campaign: ${campaign}`);
const refs: string[] = [];
for (const [i, e] of escrows.entries()) {
  const now = Date.now();
  const args = [
    "node_modules/tsx/dist/cli.mjs", "src/escrow-client.ts",
    "--template", "source", "--source", source,
    ...(e.presence ? ["--presence"] : ["--at-least", String(e.atLeast)]),
    "--minutes", ((e.deadlineMs - now) / 60_000).toFixed(2),
    ...(e.measureAfterMs === undefined ? [] : ["--measure-after-minutes", ((e.measureAfterMs - now) / 60_000).toFixed(2)]),
    "--payee", payee,
  ];
  try {
    const { stdout } = await run(process.execPath, args, { cwd: cardanoDir, env: { ...process.env, CREATORPAY_CAMPAIGN: campaign }, timeout: 420_000, maxBuffer: 16 * 1024 * 1024 });
    const ref = /Policy UTxO at the validator: (\S+)/.exec(stdout)?.[1];
    if (!ref) throw new Error(stdout.split("\n").slice(-4).join(" | "));
    refs.push(ref);
    console.log(`  ${i + 1}/${escrows.length} ${e.label}: ${ref}`);
  } catch (error) {
    // A slow settlement can come back as HTTP 402 although the escrow is there; the client then finds it by its datum and says so.
    const said = String((error as { stdout?: string }).stdout ?? "") + String((error as { stderr?: string }).stderr ?? "");
    const found = /the escrow is at the validator as (\S+?)[.\s|]/.exec(said)?.[1];
    if (found) {
      refs.push(found);
      console.log(`  ${i + 1}/${escrows.length} ${e.label}: ${found}  (the answer said 402; the escrow was found at the validator by its datum)`);
      continue;
    }
    console.error(`  ${i + 1}/${escrows.length} ${e.label} FAILED: ${String((error as { stdout?: string; message: string }).stdout ?? (error as Error).message).split("\n").filter(Boolean).slice(-3).join(" | ").slice(0, 300)}`);
    console.error(`  stopped; ${refs.length} escrow(s) were locked: ${refs.join(" ") || "none"}. An x402 payment that settles slowly can look like a failure: look at the board before paying again.`);
    process.exit(1);
  }
}
console.log(`\nall locked: ${refs.join("  ")}`);
process.exit(0);

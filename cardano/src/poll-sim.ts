/**
 * Compares polling schedules for a paid source on made-up but plausible histories. Nothing touches a network or a wallet.
 *
 *   tsx src/poll-sim.ts
 *
 * Strategies: every minute, every five minutes, and the cost-derived schedule of polling.ts (the one the keeper uses).
 * Scenarios: a 40-minute escrow, the keeper stops 3 minutes before the deadline, budget cap 0.30 aUSD for the whole run.
 */
import { type Kind, type Sample, FLOOR_MS, holds, planNext } from "./polling.js";

const MIN = 60_000;
const DEADLINE = 40 * MIN;
const STOP_BEFORE = 3 * MIN;
const CAP = 0.3;

interface Scenario {
  name: string;
  kind: Kind;
  cost: number;
  threshold: number;
  cmp: "AtLeast" | "Below";
  /** value at minute m */
  at: (m: number) => number;
  /** the minute at which the rule starts to hold, or undefined if it never does */
  crossing?: number;
}

const scenarios: Scenario[] = [
  { name: "likes: steady growth, 20 000 to go at 600 per minute (crosses at minute 33)", kind: "counter", cost: 0.01, threshold: 300_000, cmp: "AtLeast", at: (m) => 280_000 + 600 * m, crossing: 33.4 },
  { name: "likes: flat, then a burst at minute 30", kind: "counter", cost: 0.01, threshold: 300_000, cmp: "AtLeast", at: (m) => (m < 30 ? 280_000 : 305_000), crossing: 30 },
  { name: "likes: never gets there (flat, a few unlikes)", kind: "counter", cost: 0.01, threshold: 300_000, cmp: "AtLeast", at: (m) => 280_000 - (m % 5) * 10 },
  { name: "likes: already above the threshold at the first check", kind: "counter", cost: 0.01, threshold: 300_000, cmp: "AtLeast", at: () => 308_000, crossing: 0 },
  { name: "rainfall: static, rule holds (26.2 mm below 30)", kind: "static", cost: 0.1, threshold: 30, cmp: "Below", at: () => 26.2, crossing: 0 },
  { name: "rainfall: static, rule can never hold (26.2 mm below 20)", kind: "static", cost: 0.1, threshold: 20, cmp: "Below", at: () => 26.2 },
];

interface Result {
  checks: number;
  spent: number;
  detectedAt?: number;
}

const run = (sc: Scenario, strategy: "every minute" | "every 5 minutes" | "cost-derived"): Result => {
  const samples: Sample[] = [];
  let spent = 0;
  let checks = 0;
  let t = 0;
  const stop = DEADLINE - STOP_BEFORE;
  while (t <= stop) {
    if (spent + sc.cost > CAP + 1e-9) break;
    const value = sc.at(t / MIN);
    samples.push({ at: t, value });
    spent += sc.cost;
    checks += 1;
    if (holds(value, sc.threshold, sc.cmp)) return { checks, spent, detectedAt: t / MIN };
    let delay: number | null;
    if (strategy === "every minute") delay = MIN;
    else if (strategy === "every 5 minutes") delay = 5 * MIN;
    else delay = planNext({ now: t, deadlineMs: DEADLINE, stopBeforeMs: STOP_BEFORE, costAusd: sc.cost, budgetLeftAusd: CAP - spent, samples, threshold: sc.threshold, cmp: sc.cmp, kind: sc.kind, baseMs: 20_000 }).delayMs;
    if (delay === null) break;
    t += Math.max(delay, FLOOR_MS);
  }
  return { checks, spent };
};

console.log("40-minute escrow, the keeper stops at minute 37, budget cap 0.30 aUSD\n");
for (const sc of scenarios) {
  console.log(sc.name);
  for (const s of ["every minute", "every 5 minutes", "cost-derived"] as const) {
    const r = run(sc, s);
    const seen = r.detectedAt === undefined ? (sc.crossing === undefined ? "never holds (correct)" : "MISSED") : `seen at minute ${r.detectedAt.toFixed(1)}${sc.crossing !== undefined && sc.crossing > 0 ? `, ${(r.detectedAt - sc.crossing).toFixed(1)} min after it started to hold` : ""}`;
    console.log(`   ${s.padEnd(16)} ${String(r.checks).padStart(3)} checks, ${r.spent.toFixed(2)} aUSD   ${seen}`);
  }
  console.log("");
}

/**
 * How often should the seller's keeper pay for a fresh signed answer? Every check costs money (0.01 aUSD for a tweet, 0.1 aUSD
 * for rainfall), so the answer is a trade between three things, and the schedule below is derived from them rather than guessed.
 *
 * 1. WHAT THE DATA IS decides whether checking again can help at all.
 *    - static     the answer is fixed (rainfall over a window that has ended): one check settles it. If the rule does not hold,
 *                 no later check will make it hold, so the keeper stops paying.
 *    - counter    a quantity that moves with a trend (a tweet's likes): the next check is worth most near the moment the
 *                 threshold will be crossed, so it is placed by the observed trend, not by the clock.
 *    - feed       a free source: cost is zero, so every cycle (the "cost" term vanishes).
 *
 * 2. THE TREND decides where the next check goes. With the last two samples the keeper estimates the speed toward the threshold
 *    and checks again after HALF the predicted time to cross it (a bisection on the crossing time). The number of paid checks is
 *    then about log2(time to cross / acceptable delay) instead of time / interval. If the value is not approaching (flat, or
 *    moving away: likes can fall), it backs off geometrically up to a ceiling, so a hopeless escrow stops costing money.
 *
 * 3. THE BUDGET decides the hardest limit. Checking every D costs c * T / D over the T that is left, so staying inside the
 *    budget B that is left needs D >= c * T / B. This pacing floor can only slow the schedule down, never speed it up.
 *
 * A one-minute floor stays (the source is a snapshot, so asking again within seconds adds nothing). Two ceilings stay: 15 minutes
 * when a trend predicts the crossing (a two-point estimate is crude), and only 5 minutes when there is no trend to follow,
 * because a sudden burst cannot be predicted and its detection delay is at most the gap. The 5 minutes is not arbitrary: for a
 * crossing at an unknown time within T, checking every D costs c*T/D in checks and about v*D/2 in delay, where v is what a
 * minute of delay is worth; the sum is smallest at D = sqrt(2*c*T/v). With c = 0.01 aUSD and T = 37 min, D = 5 min means one
 * minute of delay is worth 0.03 aUSD. One last check is aimed a minute before the keeper must stop (3 minutes before the
 * deadline), because that is the check with the least time left to be wrong.
 */

export type Kind = "static" | "counter" | "feed";

export interface Sample {
  at: number;
  value: number;
}

export interface PollInput {
  now: number;
  deadlineMs: number;
  /** The keeper stops this long before the deadline (a release needs time to wait for the chain tip). */
  stopBeforeMs: number;
  costAusd: number;
  budgetLeftAusd: number;
  /** Oldest first; the last one is the most recent check. */
  samples: Sample[];
  threshold: number;
  cmp: "AtLeast" | "Below";
  kind: Kind;
  /** The watcher's cycle length, used for free sources. */
  baseMs: number;
}

export interface PollPlan {
  /** Milliseconds until the next paid check; 0 means the rule holds (release now); null means do not check again. */
  delayMs: number | null;
  reason: string;
}

export const FLOOR_MS = 60_000;
export const MAX_GAP_MS = 15 * 60_000; // ceiling when a trend predicts the crossing
export const BACKOFF_MAX_MS = 5 * 60_000; // ceiling when there is no trend to follow
export const FIRST_GAP_MS = 120_000;

export const holds = (value: number, threshold: number, cmp: "AtLeast" | "Below") => (cmp === "AtLeast" ? value >= threshold : value < threshold);

export const planNext = (p: PollInput): PollPlan => {
  const last = p.samples[p.samples.length - 1];
  const tLeft = p.deadlineMs - p.stopBeforeMs - p.now;
  if (tLeft <= 0) return { delayMs: null, reason: "too close to the deadline to release" };
  if (last && holds(last.value, p.threshold, p.cmp)) return { delayMs: 0, reason: "the rule holds: release" };
  if (p.kind === "static" && last) return { delayMs: null, reason: "static data: the answer will not change, so one check is enough" };
  if (p.costAusd === 0) return { delayMs: p.baseMs, reason: "free source: every cycle" };
  if (p.budgetLeftAusd < p.costAusd) return { delayMs: null, reason: "the aUSD budget is used up" };
  if (!last) return { delayMs: 0, reason: "first check" };

  const pace = (p.costAusd * tLeft) / p.budgetLeftAusd; // the budget floor on the delay
  const gap = p.cmp === "AtLeast" ? p.threshold - last.value : last.value - p.threshold; // how far from the threshold, > 0
  const prev = p.samples.length >= 2 ? p.samples[p.samples.length - 2] : undefined;
  let info = FIRST_GAP_MS;
  let ceiling = BACKOFF_MAX_MS;
  let why = "first estimate: look again in 2 minutes";
  if (prev && last.at > prev.at) {
    const speed = (p.cmp === "AtLeast" ? last.value - prev.value : prev.value - last.value) / (last.at - prev.at); // per ms, toward the threshold
    if (speed > 0) {
      info = 0.5 * (gap / speed);
      ceiling = MAX_GAP_MS;
      why = `approaching at ${(speed * 60_000).toFixed(1)} per minute, about ${Math.round(gap / speed / 60_000)} min to go: check after half of it`;
    } else {
      info = 2 * (last.at - prev.at);
      why = "not approaching the threshold: back off, at most 5 minutes between checks";
    }
  }
  let delay = Math.max(FLOOR_MS, Math.min(ceiling, info));
  if (pace > delay) {
    delay = pace;
    why += `; slowed to stay inside the budget (${p.budgetLeftAusd.toFixed(2)} aUSD for ${Math.round(tLeft / 60_000)} min)`;
  } else if (delay > tLeft - FLOOR_MS && tLeft > 2 * FLOOR_MS) {
    delay = tLeft - FLOOR_MS;
    why += "; brought forward so that a last check happens a minute before the keeper must stop";
  }
  return { delayMs: Math.round(delay), reason: why };
};

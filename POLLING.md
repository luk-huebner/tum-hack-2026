# How often should the seller's keeper pay for data?

Every check of a paid source costs money (0.01 aUSD for a tweet, 0.1 aUSD for rainfall), so the schedule is derived from cost, from what the data is, and from what the last check showed. The code is `cardano/src/polling.ts` (a pure function, `planNext`), used by the watcher in `cardano/src/autorelease.ts`. A simulation of the alternatives is `cardano/src/poll-sim.ts`. The numbers in the simulation are made up but plausible; the live check at the end is real.

## The rule

| Data kind | Example | Schedule |
|---|---|---|
| **free** | the price feed (a test fixture) | every cycle (20 s): cost is zero, so there is nothing to trade off |
| **static** | rainfall over a window that has ended | **one check.** If the rule does not hold, no later check can make it hold, so the keeper stops paying and says so. The buyer can still refund after the deadline |
| **counter** | likes of a tweet | the next check is placed by the trend: with the last two samples it estimates the speed toward the threshold and looks again after **half** the predicted time to cross it (a bisection on the crossing time, about log2(time to cross / acceptable delay) checks instead of time / interval). If the value is not approaching (flat, or falling: likes can fall) it backs off by doubling, **at most 5 minutes** between checks |

Three limits sit on top of all of them:
- **Budget pacing.** Checking every D costs c*T/D over the time T that is left, so staying inside the budget B that is left needs D >= c*T/B. This floor can only slow the schedule down.
- **A one-minute floor** between paid checks (the source is a snapshot; asking again within seconds adds nothing), and the whole run is capped (`AUTO_RELEASE_AUSD_CAP`, default 0.3 aUSD).
- **A last check** is aimed a minute before the keeper has to stop (3 minutes before the deadline), because that check has the least time left to be wrong. The keeper stops there because a release needs time to wait for the chain tip.

## Why 5 minutes when nothing is predictable

For a crossing at an unknown time within T, checking every D costs c*T/D in checks and about v*D/2 in delay, where v is what one minute of delay is worth. The sum is smallest at **D = sqrt(2*c*T/v)**. With c = 0.01 aUSD and T = 37 minutes, D = 5 minutes means one minute of delay is worth 0.03 aUSD (three checks). If delay matters more to a seller, the schedule should be faster and the budget larger; the formula says by how much. We did not measure v: it is a choice to be made by whoever runs the keeper.

## What the alternatives cost (simulation, 40-minute escrow, cap 0.30 aUSD)

| Scenario | Every minute | Every 5 minutes | Cost-derived |
|---|---|---|---|
| Likes, steady growth (crosses at minute 33) | 30 checks, 0.30 aUSD, **missed** (cap used up at minute 30) | 8 checks, 0.08, seen 1.6 min late | 9 checks, 0.09, seen 0.9 min late |
| Likes, flat then a burst at minute 30 | 30 checks, 0.30, **missed** | 7 checks, 0.07, seen at once (lucky alignment) | 8 checks, 0.08, seen 1.0 min late |
| Likes, never gets there | 30 checks, 0.30 | 8 checks, 0.08 | 7 checks, 0.07 |
| Likes, above the threshold at the first check | 1 check | 1 check | 1 check |
| Rainfall, rule holds | 1 check, 0.10 | 1 check, 0.10 | 1 check, 0.10 |
| Rainfall, rule can never hold | 3 checks, 0.30 | 3 checks, 0.30 | **1 check, 0.10** |

What this says, honestly:
- **Checking every minute is the worst choice** for a paid source: it spends the whole budget and then goes blind just before the crossing.
- For data **without a predictable trend**, the cost-derived schedule is about the same as a fixed five minutes; it is not magic.
- It wins where there **is** structure: static data (one check instead of three, a third of the cost), and a steady trend (seen 0.9 minutes after the rule started to hold against 1.6).
- It protects the budget by construction.

## Live check (30 Oct, about 16:36 to 16:50 UTC)

Two escrows whose rules cannot hold were paid and left to the keeper, then refunded: rainfall below 20 mm (the real value is 26.2 mm) and likes of tweet 20 at least 400,000 (about 91,000 away).

- **Rainfall: one check** (0.1 aUSD). The keeper logged `stop-checking` ("static data: the answer will not change, so one check is enough") and did not pay again.
- **Tweet: three checks** (0.03 aUSD), each with its reason in the log: at 16:40:33 "first estimate: look again in 2 minutes"; at 16:42:36 the count had not moved, so "not approaching: back off" (193 s, brought forward so a last check would happen a minute before the keeper must stop); at 16:46:01 the count was up by 2,448 and the plan said "approaching at 717.5 per minute, about 124 min to go: check after half of it" (900 s). That is past the stop time, so there was no fourth check.
- Both escrows were refunded after their deadlines (`20e884e9ffd886b2a471bb3d0b3dfbc53df00f5a9945a0a2157e561414f0afd5`, `0504bffc977987662d3dbaf26631529c4895f3bec3f0e66d4c5972224a9aa417`); receipts and the log are in `PROOFS.md` and `cardano/out/autorelease-log-polling.jsonl`. Not shown live: a counter that crosses its threshold under this schedule.

## Booth mode (`AUTO_RELEASE_FAST=1`)

When a person is waiting at a booth, the cost-derived schedule is too slow: it would place the next look minutes away. Booth mode checks a paid counter every cycle (`AUTO_RELEASE_INTERVAL_S=3`, in practice about 5 s with the fetch) while the aUSD cap lasts (`AUTO_RELEASE_AUSD_CAP`). At 0.01 aUSD per fetch that is about 0.12 aUSD per minute; 0.5 aUSD buys about four minutes of watching, so switch it on for the demo and not before. Static data is still checked once.

**What delay is worth.** The measurements in `PROOFS.md` put the data side at about 2 s (a like to a signed count) and the keeper's cycle at about 5 s. The remaining delay in a live payout (about 47 s) is the chain, which polling cannot reduce, so a faster cycle than 3 s would buy almost nothing. This also answers the earlier open point that the price of a minute of delay was not measured: for a like counter the controllable part of the delay is under 10 s and costs about 0.12 aUSD a minute.

## Limits

The simulation's histories are invented. A two-point trend estimate is crude. A sudden burst costs up to the current gap in delay (at most 5 minutes without a trend). The price of delay v is not measured. Two policies on the same tweet share one fetch. A free source stays at 20 seconds, which can miss a price excursion shorter than that.

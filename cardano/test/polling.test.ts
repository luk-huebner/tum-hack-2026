import test from 'node:test';
import assert from 'node:assert/strict';
import { planNext, holds, type PollInput } from '../src/polling.js';

const M = 60_000;
const input = (patch: Partial<PollInput> = {}): PollInput => ({
  now: 10 * M, deadlineMs: 73 * M, stopBeforeMs: 3 * M,
  costAusd: 0.01, budgetLeftAusd: 100, samples: [{ at: 10 * M, value: 10 }],
  threshold: 100, cmp: 'AtLeast', kind: 'counter', baseMs: 5000, ...patch,
});
const delay = (patch: Partial<PollInput> = {}) => planNext(input(patch)).delayMs;

test('holds uses inclusive AtLeast and strict Below, including zero and negatives', () => {
  assert.equal(holds(0, 0, 'AtLeast'), true);
  assert.equal(holds(0, 0, 'Below'), false);
  assert.equal(holds(-2, -1, 'Below'), true);
  assert.equal(holds(NaN, 1, 'AtLeast'), false);
});
test('expired and exact stopping instant precede even a satisfied rule', () => {
  for (const deadlineMs of [12 * M, 13 * M, 0, -1]) {
    assert.equal(delay({ deadlineMs, samples: [{ at: 0, value: 100 }] }), null);
  }
});
test('static source gets one paid look; satisfied static rule releases', () => {
  assert.equal(delay({ kind: 'static', samples: [] }), 0);
  assert.equal(delay({ kind: 'static' }), null);
  assert.equal(delay({ kind: 'static', samples: [{ at: 0, value: 100 }] }), 0);
});
test('budget gate, initial look, free feed, and booth ordering', () => {
  assert.equal(delay({ budgetLeftAusd: 0, samples: [] }), null);
  assert.equal(delay({ budgetLeftAusd: -1 }), null);
  assert.equal(delay({ budgetLeftAusd: 0.01, samples: [] }), 0);
  assert.equal(delay({ costAusd: 0, budgetLeftAusd: 0, samples: [] }), 5000);
  assert.equal(delay({ fast: true }), 5000);
  assert.equal(delay({ fast: true, budgetLeftAusd: 0.009 }), null);
  assert.equal(delay({ fast: true, kind: 'static' }), null);
});
test('counter without a usable trend starts at two minutes', () => {
  assert.equal(delay(), 2 * M);
  for (const at of [10 * M, 11 * M]) {
    assert.equal(delay({ samples: [{ at, value: 0 }, { at: 10 * M, value: 10 }] }), 2 * M);
  }
});
test('counter moving toward AtLeast checks halfway to crossing with floor and ceiling', () => {
  assert.equal(delay({ samples: [{ at: 8 * M, value: 10 }, { at: 10 * M, value: 30 }] }), 210_000);
  assert.equal(delay({ threshold: 31, samples: [{ at: 8 * M, value: 10 }, { at: 10 * M, value: 30 }] }), M);
  assert.equal(delay({ threshold: 1e12, samples: [{ at: 8 * M, value: 10 }, { at: 10 * M, value: 30 }] }), 15 * M);
});
test('Below trend points downward and equality is still waiting', () => {
  assert.equal(delay({ cmp: 'Below', threshold: 10, samples: [{ at: 8 * M, value: 50 }, { at: 10 * M, value: 30 }] }), M);
  assert.equal(delay({ cmp: 'Below', threshold: 10, samples: [{ at: 8 * M, value: 30 }, { at: 10 * M, value: 10 }] }), M);
  assert.equal(delay({ cmp: 'Below', threshold: 10, samples: [{ at: 10 * M, value: 9 }] }), 0);
});
test('flat and receding counters back off geometrically with five minute cap', () => {
  for (const value of [10, 9]) {
    assert.equal(delay({ samples: [{ at: 8 * M, value: 10 }, { at: 10 * M, value }] }), 4 * M);
    assert.equal(delay({ samples: [{ at: 0, value: 10 }, { at: 10 * M, value }] }), 5 * M);
  }
});
test('budget pacing overrides trend ceiling; no final check violates its floor', () => {
  assert.equal(delay({ budgetLeftAusd: 0.02 }), 30 * M);
  const plan = planNext(input({ deadlineMs: 16 * M, budgetLeftAusd: 0.01 }));
  assert.equal(plan.delayMs, 3 * M);
  assert.match(plan.reason, /slowed/);
});
test('last check is brought forward one minute before stopping', () => {
  const plan = planNext(input({ deadlineMs: 16 * M, samples: [{ at: 0, value: 10 }, { at: 10 * M, value: 10 }] }));
  assert.equal(plan.delayMs, 2 * M);
  assert.match(plan.reason, /brought forward/);
});
test('BUG P1: non-finite budget must not schedule a paid check', () => {
  assert.equal(delay({ budgetLeftAusd: NaN }), null);
});
test('BUG P2: non-finite deadline must not schedule a check', () => {
  assert.equal(delay({ deadlineMs: NaN }), null);
});
test('BUG P3: a final check must fit before the keeper stops', () => {
  const remaining = M + 1;
  const next = delay({ deadlineMs: 13 * M + remaining });
  assert.ok(next === null || next < remaining, `delay ${next} is outside remaining ${remaining}`);
});

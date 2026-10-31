import test from 'node:test';
import assert from 'node:assert/strict';
import { accessAllowed, buildEscrows, retryDeadline, escrowName, escrowUnits, isWorkspaceKey, newId, ownerHashOf, parseTerms, type Campaign } from '../src/campaigns.js';

// Pure rules only: the terms a brand states and the escrows they become. Nothing is paid, no service is started.
const terms = (patch: Record<string, unknown> = {}) => ({ brand: 'Acme', title: 'Launch', creator: '@someone', milestones: [{ likes: 1 }, { likes: 2 }, { likes: 3 }], ...patch });
const campaign = (patch: Record<string, unknown> = {}) => parseTerms(terms(patch)) as Pick<Campaign, 'milestones' | 'posting' | 'likesMode'>;

test('the demo budget: a posting payment, then 1, 2 and 3 likes, one 5 tADA unit each', () => {
  const c = campaign({ posting: { units: 1 } });
  assert.deepEqual(c.posting, { units: 1 });
  const escrows = buildEscrows(c, 0);
  assert.equal(escrowUnits(c), 4);
  assert.deepEqual(escrows.map((e) => [e.kind, e.threshold]), [['posting', 0], ['likes', 1], ['likes', 2], ['likes', 3]]);
  assert.deepEqual(escrows.map((e) => e.milestone), [-1, 0, 1, 2]);
  assert.ok(escrows.every((e) => e.state === 'pending'));
});

test('thresholds count on top of the likes the post has when it is submitted, unless the brand asks for absolute numbers', () => {
  assert.deepEqual(buildEscrows(campaign(), 10).map((e) => e.threshold), [11, 12, 13]);
  assert.deepEqual(buildEscrows(campaign({ likesMode: 'absolute' }), 10).map((e) => e.threshold), [1, 2, 3]);
  // the posting payment has no threshold in either mode
  assert.equal(buildEscrows(campaign({ posting: true, likesMode: 'absolute' }), 10)[0].threshold, 0);
});

test('units split the budget: more 5 tADA escrows behind a milestone, each its own escrow', () => {
  const c = campaign({ posting: { units: 2, label: 'Goes live' }, milestones: [{ likes: 1, units: 3 }, { likes: 5 }] });
  const escrows = buildEscrows(c, 0);
  assert.equal(escrows.length, 6);
  assert.equal(escrowUnits(c), 6);
  assert.deepEqual(escrows.map((e) => `${e.kind}:${e.unit}/${e.units}`), ['posting:0/2', 'posting:1/2', 'likes:0/3', 'likes:1/3', 'likes:2/3', 'likes:0/1']);
  assert.equal(escrows[0].label, 'Goes live');
  assert.deepEqual(escrows.map(escrowName), ['Goes live (1 of 2)', 'Goes live (2 of 2)', 'Milestone 1 (1 of 3)', 'Milestone 1 (2 of 3)', 'Milestone 1 (3 of 3)', 'Milestone 2']);
});

test('posting can be true, an object, or off; a posting payment alone is a campaign', () => {
  assert.deepEqual(campaign({ posting: true }).posting, { units: 1 });
  assert.equal(campaign({ posting: false }).posting, undefined);
  assert.equal(campaign().posting, undefined);
  const only = campaign({ posting: { units: 2 }, milestones: [] });
  assert.equal(only.milestones.length, 0);
  assert.equal(buildEscrows(only, 0).length, 2);
});

test('refusals: units, the limit of 8 escrows, an empty campaign, duplicate or bad milestones', () => {
  for (const units of [0, 4, 1.5, -1, 'x']) assert.throws(() => parseTerms(terms({ milestones: [{ likes: 1, units }] })), /units/);
  assert.throws(() => parseTerms(terms({ posting: { units: 4 } })), /units/);
  assert.throws(() => parseTerms(terms({ posting: { units: 3 }, milestones: [{ likes: 1, units: 3 }, { likes: 2, units: 3 }] })), /more than the limit of 8/);
  assert.doesNotThrow(() => parseTerms(terms({ posting: { units: 2 }, milestones: [{ likes: 1, units: 3 }, { likes: 2, units: 3 }] })));
  assert.throws(() => parseTerms(terms({ milestones: [] })), /posting payment or one to 3/);
  assert.throws(() => parseTerms(terms({ milestones: [{ likes: 2 }, { likes: 2 }] })), /same number of likes/);
  assert.throws(() => parseTerms(terms({ milestones: [{ likes: 0 }] })), /at least 1/);
  assert.throws(() => parseTerms(terms({ creator: 'not a handle!' })), /X handle/);
});

test('workspace keys: only long random-looking keys count, and only a hash is kept', () => {
  const key = 'a1'.repeat(24);
  assert.equal(isWorkspaceKey(key), true);
  for (const bad of ['', 'short', 'x'.repeat(31), 'x'.repeat(129), 'has space ' + 'a'.repeat(30), 'semi;colon' + 'a'.repeat(30), undefined, null, 42]) assert.equal(isWorkspaceKey(bad), false);
  const hash = ownerHashOf(key);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(hash, key);
  assert.equal(ownerHashOf(key), hash);
  assert.notEqual(ownerHashOf('b2'.repeat(24)), hash);
});

test('campaign and group ids are random, not a clock', () => {
  const ids = new Set(Array.from({ length: 200 }, () => newId('cp')));
  assert.equal(ids.size, 200);
  for (const id of ids) assert.match(id, /^cp-[0-9a-f]{18}$/);
  assert.match(newId('grp'), /^grp-[0-9a-f]{18}$/);
});

test('the team access code: no code set means open, a set code must match exactly', () => {
  assert.equal(accessAllowed(undefined, undefined), true);
  assert.equal(accessAllowed('', 'anything'), true);
  assert.equal(accessAllowed('k7m2-x9qp-4tnd', 'k7m2-x9qp-4tnd'), true);
  for (const wrong of [undefined, null, '', 'k7m2-x9qp-4tnc', 'K7M2-X9QP-4TND', 'k7m2-x9qp-4tnd ', 'k7m2', 42, ['k7m2-x9qp-4tnd']]) assert.equal(accessAllowed('k7m2-x9qp-4tnd', wrong), false);
});

test('a retried lock gets at least 30 minutes, or keeps a later original deadline', () => {
  const now = 1_800_000_000_000;
  assert.equal(retryDeadline(now - 60_000, now), now + 30 * 60_000);
  assert.equal(retryDeadline(now + 3 * 60 * 60_000, now), now + 3 * 60 * 60_000);
  assert.equal(retryDeadline(NaN, now), now + 30 * 60_000);
});

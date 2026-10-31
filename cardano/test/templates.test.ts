import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { allSpecs, specFor, registeredSources, registeredTweets, TEMPLATE_IDS } from '../src/templates.js';

test('built-in specs retain units, slot ranges, costs and observation-time semantics', () => {
  assert.deepEqual(TEMPLATE_IDS, ['eth-usd', 'tweet-likes', 'rain-below', 'source']);
  const eth = specFor('eth-usd');
  assert.deepEqual([eth.scale, eth.slotFrom, eth.slotTo, eth.costAusd, eth.kind, eth.fixture], [6, 0, 1, 0, 'feed', true]);
  assert.deepEqual(eth.obs, { slot: 1, maxAgeMs: 120_000 });
  assert.equal(eth.toThreshold(1.2345678), 1_234_568);
  assert.equal(eth.describe(0), 'ETH/USD at least 0');
  const rain = specFor('rain-below');
  assert.deepEqual([rain.scale, rain.slotFrom, rain.slotTo, rain.costAusd, rain.kind, rain.cmp], [2, 0, 14, 0.1, 'static', 'Below']);
  assert.equal(rain.toThreshold(1.239), 124);
  assert.match(rain.describe(3.2), /below 3.2 mm$/);
});
test('registeredSources reads committed fixtures afresh without mutating them', () => {
  const disk = JSON.parse(readFileSync(new URL('../vectors/sources.json', import.meta.url), 'utf8'));
  assert.deepEqual(registeredSources(), disk);
  const changed = registeredSources();
  changed[0].label = 'changed only in memory';
  assert.deepEqual(registeredSources(), disk);
});
test('every registered source maps its metadata and numeric conversion', () => {
  for (const r of registeredSources()) {
    const s = specFor('source', r.id);
    assert.deepEqual([s.id, s.template, s.vectorName, s.sourceSpec], [`source:${r.id}`, 'source', r.vectorName, `reg:${r.id}`]);
    for (const key of ['costAusd', 'scale', 'slotFrom', 'slotTo', 'cmp', 'max', 'kind'] as const) assert.equal(s[key], r[key]);
    assert.equal(s.toThreshold(123), Math.round(123 * 10 ** r.scale));
    assert.equal(s.describe(123), `${r.label} ${r.cmp === 'Below' ? 'below' : 'at least'} 123`);
  }
});
test('every registered tweet maps only likes and rounds thresholds', () => {
  for (const [id, vector] of Object.entries(registeredTweets())) {
    const s = specFor('tweet-likes', id);
    assert.deepEqual([s.id, s.sourceSpec, s.vectorName, s.scale, s.slotFrom, s.slotTo, s.max], [`tweet-likes:${id}`, `tweet:${id}`, vector, 0, 0, 1, 2_000_000_000]);
    assert.equal(s.toThreshold(1.5), 2);
    assert.match(s.describe(2), /at least 2$/);
  }
});
test('missing and hostile registry ids are refused, including prototype names', () => {
  for (const id of [undefined, '', 'nope', '__proto__', 'constructor', 'toString', '☃', '9'.repeat(1000)]) {
    assert.throws(() => specFor('source', id), /sourceId/);
    assert.throws(() => specFor('tweet-likes', id), /tweetId/);
  }
});
test('allSpecs enumerates every offered instance exactly once with valid fixture slots', () => {
  const specs = allSpecs();
  assert.equal(specs.length, 2 + Object.keys(registeredTweets()).length + registeredSources().length);
  assert.equal(new Set(specs.map((s) => s.id)).size, specs.length);
  for (const s of specs) {
    assert.ok(existsSync(new URL(`../vectors/${s.vectorName}.json`, import.meta.url)));
    const vector = JSON.parse(readFileSync(new URL(`../vectors/${s.vectorName}.json`, import.meta.url), 'utf8'));
    assert.ok(s.slotFrom >= 0 && s.slotTo > s.slotFrom && s.slotTo <= vector.slotsText.length);
    assert.ok(Number.isFinite(s.max) && s.max > 0 && s.costAusd >= 0);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { Address } from '@evolution-sdk/evolution';
import { bech32 } from '@scure/base';
import { parseOffer, describeOffer } from '../src/escrow.js';
import { registeredSources, specFor } from '../src/templates.js';

const NOW = 1_800_000_000_000;
const M = 60_000;
// Public, synthetic address bytes only. No keypairs, wallets, seeds or signing.
const address = (header: string, byte = '11', length = 28) => Address.toBech32(Address.fromHex(header + byte.repeat(length)));
const KEY = address('60');
const OTHER = address('60', '22');
const SCRIPT = address('70');
const MAINNET = address('61');
const BASE = address('00', '33', 56);
const body = (patch: Record<string, unknown> = {}) => ({ refund: KEY, atLeast: 10, deadlineMs: NOW + 60 * M, ...patch });
const parse = (patch: Record<string, unknown> = {}) => parseOffer(body(patch), NOW);

test('default ETH offer accepts synthetic key refund and deterministic numeric strings', () => {
  assert.deepEqual(parse(), { template: 'eth-usd', refund: KEY, deadlineMs: NOW + 60 * M, value: 10 });
  assert.deepEqual(parse({ refund: `  ${BASE}  `, atLeast: '1.23456789', deadlineMs: String(NOW + 5 * M) }), {
    template: 'eth-usd', refund: BASE, deadlineMs: NOW + 5 * M, value: 1.23456789,
  });
});
test('null, undefined and non-object requests refuse without a valid refund', () => {
  for (const b of [null, undefined, 0, '', [], '☃']) assert.throws(() => parseOffer(b, NOW), /refund/);
});
test('every template and registry refusal is reported', () => {
  for (const template of ['', null, 'ETH-USD', '__proto__', 0, '☃']) assert.throws(() => parse({ template }), /template/);
  assert.throws(() => parse({ template: 'tweet-likes' }), /tweetId/);
  assert.throws(() => parse({ template: 'tweet-likes', tweetId: 'unknown' }), /tweetId/);
  assert.throws(() => parse({ template: 'source' }), /sourceId/);
  assert.throws(() => parse({ template: 'source', sourceId: '☃' }), /sourceId/);
});
test('refund refuses script, mainnet, stake, malformed and empty addresses', () => {
  // The SDK's Address.fromHex does not construct reward addresses; encode public bytes directly.
  const stake = bech32.encode('stake_test', bech32.toWords(Buffer.from('e0' + '44'.repeat(28), 'hex')));
  for (const refund of [SCRIPT, MAINNET, stake, 'addr_test1broken', KEY.slice(0, -1), '', null, 42, '☃']) {
    assert.throws(() => parse({ refund }), /refund/);
  }
});
test('payee uses the same key-controlled test address validation and trims whitespace', () => {
  assert.equal(parse({ payee: ` ${OTHER} ` }).payee, OTHER);
  assert.equal(parse({ payee: BASE }).payee, BASE);
  for (const payee of [SCRIPT, MAINNET, 'addr_test1broken', '', null, 0, '☃']) assert.throws(() => parse({ payee }), /payee/);
});
for (const template of ['eth-usd', 'rain-below', 'tweet-likes', 'source'] as const) {
  const instance = template === 'tweet-likes' ? '20' : registeredSources()[0].id;
  const spec = specFor(template, instance);
  const key = spec.cmp === 'Below' ? 'below' : 'atLeast';
  const extra = { template, tweetId: instance, sourceId: instance };
  test(`${template}: threshold refuses zero, negative, non-finite, empty, missing and above max`, () => {
    for (const value of [0, -1, NaN, Infinity, -Infinity, 1e100, spec.max + 1, '', ' ', '☃', undefined, null]) {
      assert.throws(() => parse({ ...extra, [key]: value }), new RegExp(`${key} must be a positive number`));
    }
  });
  test(`${template}: accepts minimum unit, maximum and correct instance`, () => {
    for (const value of [10 ** -spec.scale, spec.max]) {
      const offer = parse({ ...extra, [key]: value });
      assert.equal(offer.value, value);
      assert.equal(offer.template, template);
    }
  });
  if (template !== 'eth-usd') test(`${template}: excess decimal places are refused`, () => {
    assert.throws(() => parse({ ...extra, [key]: 1 + 10 ** -(spec.scale + 1) }), /decimals/);
  });
}
test('deadline accepts exact five-minute and eight-day bounds; refuses outside and unsafe values', () => {
  const lower = NOW + 5 * M;
  const upper = NOW + 8 * 24 * 60 * M;
  for (const deadlineMs of [lower, upper]) assert.equal(parse({ deadlineMs }).deadlineMs, deadlineMs);
  for (const deadlineMs of [lower - 1, upper + 1, 0, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, lower + 0.5, '', undefined]) {
    assert.throws(() => parse({ deadlineMs }), /deadlineMs/);
  }
});
test('measurement permits exact one-minute past grace and ten-minute remaining window', () => {
  for (const measureAfterMs of [NOW - M, NOW, NOW + 50 * M, String(NOW)]) {
    assert.equal(parse({ measureAfterMs }).measureAfterMs, Number(measureAfterMs));
  }
  for (const measureAfterMs of [NOW - M - 1, NOW + 50 * M + 1, NOW + 0.1, 0, -1, NaN, Infinity, '', null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => parse({ measureAfterMs }), /measureAfterMs/);
  }
  assert.throws(() => parse({ deadlineMs: NOW + 5 * M, measureAfterMs: NOW }), /measureAfterMs/);
});
test('describeOffer covers every template and optional measurement/payee text', () => {
  const cases = [parse(), parse({ template: 'rain-below', below: 1.25 }), parse({ template: 'tweet-likes', tweetId: '20' }),
    ...registeredSources().map((s) => parse({ template: 'source', sourceId: s.id }))];
  for (const offer of cases) {
    assert.equal(describeOffer(offer), specFor(offer.template, offer.tweetId ?? offer.sourceId).describe(offer.value));
    assert.equal(describeOffer({ ...offer, measureAfterMs: NOW, payee: OTHER }),
      `${describeOffer(offer)}, counting only data signed after ${new Date(NOW).toISOString()}, paid to ${OTHER.slice(0, 18)}...`);
  }
});
test('BUG E1: boolean thresholds should not silently become a numeric payment rule', () => {
  assert.throws(() => parse({ atLeast: true }), /atLeast/);
});
test('BUG E2: a non-finite reference clock must not disable deadline limits', () => {
  assert.throws(() => parseOffer(body({ deadlineMs: 1 }), NaN), /deadlineMs/);
});

// Presence: "the post is live" is a threshold of 0 on a registered post source. It has to be asked for explicitly.
const postSource = () => registeredSources().find((s) => s.cmp !== 'Below')!.id;
test('presence on a registered post source gives threshold 0 and says so in words', () => {
  const offer = parseOffer({ refund: KEY, template: 'source', sourceId: postSource(), presence: true, deadlineMs: NOW + 60 * M }, NOW);
  assert.equal(offer.value, 0);
  assert.match(describeOffer(offer), /the post is live: any signed response about it counts/);
});
test('presence is refused for other templates, with a threshold, and when it is not a boolean', () => {
  assert.throws(() => parse({ presence: true, atLeast: undefined }), /only for a registered post source/);
  assert.throws(() => parse({ template: 'tweet-likes', tweetId: '20', presence: true, atLeast: undefined }), /only for a registered post source/);
  assert.throws(() => parse({ template: 'source', sourceId: postSource(), presence: true }), /no threshold/);
  for (const presence of ['true', 1, null, [], {}]) assert.throws(() => parse({ template: 'source', sourceId: postSource(), presence, atLeast: undefined }), /presence must be true or false/);
});
test('without presence a threshold of 0 is still refused', () => {
  for (const atLeast of [0, '0', false, null]) assert.throws(() => parse({ template: 'source', sourceId: postSource(), atLeast }), /atLeast/);
  assert.equal(parseOffer({ refund: KEY, template: 'source', sourceId: postSource(), presence: false, atLeast: 5, deadlineMs: NOW + 60 * M }, NOW).value, 5);
});

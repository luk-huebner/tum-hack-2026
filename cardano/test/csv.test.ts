import test from 'node:test';
import assert from 'node:assert/strict';
import { extractHandleColumn, normalizeHandle, parseCreatorList, parseCsvRows } from '../../webapp/src/lib/csv.js';

// The creator list of the Brand page: pure text in, handles out. Nothing here touches a service.

test('normalizeHandle strips @, quotes and profile links', () => {
  assert.equal(normalizeHandle('  @Anna_creates '), 'Anna_creates');
  assert.equal(normalizeHandle('"ben_reels"'), 'ben_reels');
  assert.equal(normalizeHandle('https://x.com/cara_ugc'), 'cara_ugc');
  assert.equal(normalizeHandle('https://twitter.com/@dan?ref=1'), 'dan');
  assert.equal(normalizeHandle('x.com/eve/status/123'), 'eve');
});

test('a typed list: lines, commas and semicolons; duplicates and bad entries are reported, not silently dropped', () => {
  const r = parseCreatorList('@Anna_creates\n ben_reels, cara_ugc;\nanna_creates\nbad handle!\n@\nname_far_too_long_for_x\n\n');
  assert.deepEqual(r.handles, ['Anna_creates', 'ben_reels', 'cara_ugc']);
  assert.deepEqual(r.duplicates, ['anna_creates']);
  assert.deepEqual(r.invalid, ['bad handle!', '@', 'name_far_too_long_for_x']);
});

test('spaces do not split an entry: a full name is not a handle', () => {
  const r = parseCreatorList('Anna Smith');
  assert.deepEqual(r.handles, []);
  assert.deepEqual(r.invalid, ['Anna Smith']);
});

test('the empty list is empty', () => {
  assert.deepEqual(parseCreatorList(''), { handles: [], invalid: [], duplicates: [] });
  assert.deepEqual(parseCreatorList(' \n , ; '), { handles: [], invalid: [], duplicates: [] });
});

test('a CSV with a handle column: the header row is skipped and other columns are ignored', () => {
  const r = extractHandleColumn('handle,email\n@anna,a@x.com\n"ben_reels",b@x.com\n');
  assert.deepEqual(r.values, ['@anna', 'ben_reels']);
  assert.equal(r.column, 'handle');
  const named = extractHandleColumn('Name,X_Handle,Followers\nAnna S,anna,1000\nBen R,ben_reels,2000');
  assert.deepEqual(named.values, ['anna', 'ben_reels']);
  assert.equal(named.column, 'X_Handle');
});

test('a CSV without a recognised header: the first column of every row', () => {
  const r = extractHandleColumn('anna\r\nben\r\ncara\r\n');
  assert.deepEqual(r.values, ['anna', 'ben', 'cara']);
  assert.equal(r.column, undefined);
});

test('semicolon and tab delimiters, a byte order mark and quoted cells with commas', () => {
  assert.deepEqual(extractHandleColumn('handle;followers\nanna;1000\nben;2000').values, ['anna', 'ben']);
  assert.deepEqual(extractHandleColumn('handle\tfollowers\nanna\t1\nben\t2').values, ['anna', 'ben']);
  assert.deepEqual(extractHandleColumn('﻿handle\nanna').values, ['anna']);
  assert.deepEqual(parseCsvRows('a,"b, c","d ""q"""\n1,2,3'), [['a', 'b, c', 'd "q"'], ['1', '2', '3']]);
});

test('an imported CSV flows through the same list parser', () => {
  const { values } = extractHandleColumn('handle,note\n@anna,top\nben_reels,\n@Anna,duplicate\nnot a handle,x\n');
  const r = parseCreatorList(values.join('\n'));
  assert.deepEqual(r.handles, ['anna', 'ben_reels']);
  assert.deepEqual(r.duplicates, ['Anna']);
  assert.deepEqual(r.invalid, ['not a handle']);
});

test('empty and header-only files give nothing', () => {
  assert.deepEqual(extractHandleColumn('').values, []);
  assert.deepEqual(extractHandleColumn('handle\n').values, []);
});

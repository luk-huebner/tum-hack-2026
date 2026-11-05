/** Offline cryptographic integrity checks for the public benchmark receipts. No wallets or network. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { type SignedResponse, verifySignedResponse } from '../../lib/airnode-v2.ts';

const read = (name:string):SignedResponse => JSON.parse(readFileSync(new URL(`../vectors/tamper/${name}.json`,import.meta.url),'utf8'));
const vector=JSON.parse(readFileSync(new URL('../vectors/meteo.json',import.meta.url),'utf8'));
const expectedHash=`0x${vector.requestHashHex}` as `0x${string}`;
const valid=read('valid');

test('control is genuinely signed by the pinned Airnode for the pinned request',async()=>{
  await verifySignedResponse(valid,vector.airnode,expectedHash);
});
test('editing one numeric value invalidates that same signature',async()=>{
  const edited=read('edited');
  assert.equal(edited.signature,valid.signature);
  assert.equal(edited.timestamp,valid.timestamp);
  assert.notEqual(edited.data,valid.data);
  await assert.rejects(()=>verifySignedResponse(edited,vector.airnode,expectedHash));
});
test('stale case has its own authentic old signature, not the newly refreshed control',async()=>{
  const stale=read('stale');
  await verifySignedResponse(stale,vector.airnode,expectedHash);
  assert.ok(Number(valid.timestamp)-Number(stale.timestamp)>300);
});
test('different-request case is fresh, signed by the SAME Airnode, and fails the pinned request',async()=>{
  const other=read('other-request');
  assert.equal(other.airnode.toLowerCase(),valid.airnode.toLowerCase());
  assert.ok(Math.abs(Number(other.timestamp)-Number(valid.timestamp))<3600);
  assert.notEqual(other.requestHash,valid.requestHash);
  await verifySignedResponse(other,vector.airnode,other.requestHash);
  await assert.rejects(()=>verifySignedResponse(other,vector.airnode,expectedHash));
});
test('foreign signer preserves the request, timestamp and data but fails the pinned Airnode',async()=>{
  const foreign=read('foreign-signer');
  assert.equal(foreign.requestHash,valid.requestHash);
  assert.equal(foreign.timestamp,valid.timestamp);
  assert.equal(foreign.data,valid.data);
  await assert.rejects(()=>verifySignedResponse(foreign,vector.airnode,expectedHash));
});

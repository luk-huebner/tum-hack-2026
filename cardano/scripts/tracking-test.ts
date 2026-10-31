import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordTransaction, latestTransactions, reconcile, pendingFor, submitTracked } from '../src/tx-tracking.js';
import { withMetadata } from '../src/tx-metadata.js';
const dir=mkdtempSync(join(tmpdir(),'creatorpay-'));process.env.TRANSACTION_LOG=join(dir,'tx.jsonl');
const hash='a'.repeat(64),ref='b'.repeat(64)+'#0';
test('timeout persists unknown and suppresses retry',async()=>{
 recordTransaction(hash,{operation:'release',escrowRefs:[ref],state:'submitted',validUntilSlot:'100'});
 globalThis.fetch=async()=>{throw new Error('timeout');};
 assert.equal((await reconcile(hash)).state,'unknown');assert.equal(latestTransactions()[0].txHash,hash);assert.equal(await pendingFor(ref),true);
});
test('late confirmation cannot be downgraded by outage',async()=>{
 globalThis.fetch=async()=>new Response(JSON.stringify({hash,block_height:12,block_time:1793362061}),{status:200});
 assert.equal((await reconcile(hash)).state,'confirmed');globalThis.fetch=async()=>new Response('',{status:503});
 assert.equal((await reconcile(hash)).state,'confirmed');assert.equal(latestTransactions()[0].blockNumber,12);
});
test('404 needs chain tip past TTL to become expired',async()=>{
 const h='c'.repeat(64);recordTransaction(h,{state:'submitted',validUntilSlot:'100'});
 globalThis.fetch=async()=>new Response('',{status:404});assert.equal((await reconcile(h)).state,'unknown');
 globalThis.fetch=async input=>String(input).endsWith('/blocks/latest')?new Response(JSON.stringify({slot:101}),{status:200}):new Response('',{status:404});
 assert.equal((await reconcile(h)).state,'expired');
});
test('optional metadata has valid CIP-20 shape',()=>{
 const b={attachMetadata(p:any){assert.equal(p.label,674n);assert(p.metadata.get('msg').every((s:string)=>Buffer.byteLength(s)<=64));return this;}};
 delete process.env.CREATORPAY_METADATA;assert.equal(withMetadata(b,'Release'),b);process.env.CREATORPAY_METADATA='1';assert.equal(withMetadata(b,'Refund'),b);
});
test('hash journaled before submit despite lost reply',async()=>{
 const h='e'.repeat(64);let submitted=false;
 const built={chainResult:()=>({txHash:h,consumed:[]}),toTransaction:async()=>({body:{outputs:[],ttl:200n}}),sign:async()=>({submit:async()=>{submitted=true;assert.equal(latestTransactions().find(r=>r.txHash===h)?.state,'unknown');throw new Error('lost reply');}})};
 globalThis.fetch=async()=>new Response('',{status:503});
 await assert.rejects(submitTracked(built as never,{source:'test'}),/unknown/);assert(submitted);
});
test('included phase-2 failure is not a successful payout',async()=>{
 const h='f'.repeat(64);recordTransaction(h,{state:'submitted'});
 globalThis.fetch=async()=>new Response(JSON.stringify({hash:h,block_height:13,block_time:1793362062,valid_contract:false}),{status:200});
 assert.equal((await reconcile(h)).state,'rejected');
});
test.after(()=>rmSync(dir,{recursive:true,force:true}));

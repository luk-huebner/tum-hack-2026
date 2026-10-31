/** Preprod write-ahead journal: identifiers only, never credentials or signed CBOR. */
import { appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Address, TransactionBody, type Transaction } from '@evolution-sdk/evolution';
export type State = 'built' | 'submitted' | 'confirmed' | 'rejected' | 'expired' | 'unknown';
export interface RecordTx {
  txHash:string; network:'cardano:preprod'; operation:string; campaign:string|null; escrowRefs:string[];
  submissionTimestamp:string|null; state:State; updatedAt:string; blockNumber:number|null;
  confirmationTimestamp:string|null; explorerUrl:string; validUntilSlot:string|null; source:string; note?:string;
}
const journal=()=>process.env.TRANSACTION_LOG ?? fileURLToPath(new URL('../out/transactions.jsonl',import.meta.url));
const hashes=new Set(['58fb7eefb61d968668106385cf7a7dc8e8591004162a81c6b50562ea','a9e4420cc2b611c46a8a0c1f5413f9ce4b6be47c7974e8509171b11c']);
export const explorer=(hash:string)=>`https://preprod.cardanoscan.io/transaction/${hash}`;
export function latestTransactions():RecordTx[] {
  if(!existsSync(journal()))return [];
  const latest=new Map<string,RecordTx>();
  for(const [i,line] of readFileSync(journal(),'utf8').split('\n').entries()) {
    if(!line.trim())continue;
    try {const row=JSON.parse(line) as RecordTx;latest.set(row.txHash,row);}
    catch {throw new Error(`Transaction journal damaged at line ${i+1}; reconcile before submitting`);}
  }
  return [...latest.values()];
}
export function recordTransaction(hash:string,change:Partial<RecordTx>):RecordTx {
  if(!/^[a-f0-9]{64}$/.test(hash))throw new Error('Invalid transaction hash');
  const previous=latestTransactions().find(r=>r.txHash===hash);
  const row:RecordTx={txHash:hash,network:'cardano:preprod',operation:'payment',campaign:process.env.CREATORPAY_CAMPAIGN??null,
    escrowRefs:[],submissionTimestamp:null,state:'built',updatedAt:new Date().toISOString(),blockNumber:null,
    confirmationTimestamp:null,explorerUrl:explorer(hash),validUntilSlot:null,source:'external',...previous,...change};
  row.updatedAt=new Date().toISOString();
  if(previous?.state==='confirmed'&&change.state!=='confirmed')row.state='confirmed';
  mkdirSync(dirname(journal()),{recursive:true});const fd=openSync(journal(),'a',0o600);
  try {appendFileSync(fd,JSON.stringify(row)+'\n');fsyncSync(fd);} finally {closeSync(fd);}
  return row;
}
async function readChain(path:string):Promise<{status:number;data?:any}> {
  const base=process.env.BLOCKFROST_BASE_URL??'https://cardano-preprod.blockfrost.io/api/v0';
  if(base!=='https://cardano-preprod.blockfrost.io/api/v0')throw new Error('Tracking requires Cardano Preprod endpoint');
  try {const r=await fetch(base+path,{headers:{project_id:process.env.BLOCKFROST_PROJECT_ID??''},signal:AbortSignal.timeout(15_000)});return {status:r.status,data:r.ok?await r.json():undefined};}
  catch {return {status:0};}
}
export async function reconcile(hash:string):Promise<RecordTx> {
  const prior=latestTransactions().find(r=>r.txHash===hash),result=await readChain(`/txs/${hash}`);
  if(result.status===200 && result.data?.hash===hash && result.data.valid_contract===false)
    return recordTransaction(hash,{state:'rejected',blockNumber:result.data.block_height??null,confirmationTimestamp:Number.isFinite(result.data.block_time)?new Date(result.data.block_time*1000).toISOString():null,note:'Included with invalid contract; ordinary escrow payout did not execute'});
  if(result.status===200&&result.data?.hash===hash&&Number.isInteger(result.data.block_height)&&Number.isFinite(result.data.block_time))
    return recordTransaction(hash,{state:'confirmed',blockNumber:result.data.block_height,confirmationTimestamp:new Date(result.data.block_time*1000).toISOString(),note:'Observed in a block by Blockfrost Preprod'});
  if(prior?.state==='confirmed')return prior;
  if(result.status===404&&prior?.validUntilSlot){const tip=await readChain('/blocks/latest');
    if(tip.status===200&&Number.isSafeInteger(tip.data?.slot)&&BigInt(tip.data.slot)>BigInt(prior.validUntilSlot))
      return recordTransaction(hash,{state:'expired',note:'Not indexed; chain tip beyond validity upper bound. Check escrow unspent before rebuilding.'});}
  return recordTransaction(hash,{state:'unknown',note:'No confirmation observed; absence or timeout does not prove rejection'});
}
export async function pendingFor(ref:string):Promise<boolean> {
  for(const row of latestTransactions().filter(r=>r.escrowRefs.includes(ref)&&r.operation!=='lock'&&['submitted','unknown','confirmed'].includes(r.state))){
    const state=(await reconcile(row.txHash)).state;if(state!=='expired'&&state!=='rejected')return true;}
  return false;
}
type TxHash = ReturnType<typeof TransactionBody.toHash>;
interface Built{toTransaction():Promise<Transaction.Transaction>;chainResult():{txHash:string;consumed:readonly {transactionId:{hash:Uint8Array};index:bigint;address:Address.Address}[]};sign():Promise<{submit():Promise<TxHash>}>}
export async function submitTracked(built:Built,context:{source:string}):Promise<TxHash>{
  const chain=built.chainResult(),tx=await built.toTransaction();
  const refs=chain.consumed.filter(u=>hashes.has(Address.toHex(u.address).slice(2,58))).map(u=>`${Buffer.from(u.transactionId.hash).toString('hex')}#${u.index}`);
  for(const ref of refs)if(await pendingFor(ref))throw new Error(`Unresolved transaction spends ${ref}; reconcile before retrying`);
  const locks=tx.body.outputs.flatMap((o,i)=>hashes.has(Address.toHex(o.address).slice(2,58))?[`${chain.txHash}#${i}`]:[]);
  const operation=refs.length?(tx.body.requiredSigners?.length?'refund':'release'):locks.length?'lock':'payment';
  recordTransaction(chain.txHash,{state:'built',operation,escrowRefs:refs.length?refs:locks,validUntilSlot:tx.body.ttl?.toString()??null,source:context.source});
  const signed=await built.sign();
  recordTransaction(chain.txHash,{state:'unknown',submissionTimestamp:new Date().toISOString(),note:'Submission starting; response not yet received'});
  console.log(`Transaction ${chain.txHash}: ${explorer(chain.txHash)}`);
  try {const result=await signed.submit();recordTransaction(chain.txHash,{state:'submitted'});return result;}
  catch {const status=await reconcile(chain.txHash);if(status.state==='confirmed')return TransactionBody.toHash(tx.body);throw new Error(`Submission response unavailable; transaction ${chain.txHash} is ${status.state}. Check ${explorer(chain.txHash)} before retrying.`);}
}
export function trackExternal(tx:Transaction.Transaction,source:string,sending:boolean):string {
  const hash=Buffer.from(TransactionBody.toHash(tx.body).hash).toString('hex');
  const refs=tx.body.outputs.flatMap((o,i)=>hashes.has(Address.toHex(o.address).slice(2,58))?[`${hash}#${i}`]:[]);
  recordTransaction(hash,{operation:refs.length?'lock':'payment',escrowRefs:refs,source,state:sending?'unknown':'built',validUntilSlot:tx.body.ttl?.toString()??null,
    submissionTimestamp:sending?new Date().toISOString():null,note:sending?'Signed for facilitator; broadcast not yet known':'Built only; not submitted'});
  return hash;
}

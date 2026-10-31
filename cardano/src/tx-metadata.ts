/** Optional CIP-20 messages; no effect on validator rules. No personal fields. */
export function withMetadata<T extends {attachMetadata(p:{label:bigint;metadata:Map<string,string[]>}):T}>(builder:T, action:'Release'|'Refund', scriptHash?:string):T {
  if(process.env.CREATORPAY_METADATA!=='1')return builder;
  const msg=['CreatorPay',`Action: ${action}`,'Network: Cardano Preprod',...(scriptHash ? ['Validator:',scriptHash] : [])];
  if(msg.some(s=>Buffer.byteLength(s,'utf8')>64))throw new Error('Metadata text exceeds 64 bytes');
  return builder.attachMetadata({label:674n,metadata:new Map([['msg',msg]])});
}

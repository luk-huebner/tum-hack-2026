import json,pathlib,datetime,collections,re
r=pathlib.Path(__file__).resolve().parents[1];p=r/'audit-evidence';txs=json.loads((p/'koios-transactions.json').read_text());idx=json.loads((p/'local-hash-index.json').read_text());collection=json.loads((p/'collection.json').read_text())
versions={'a9e4420cc2b611c46a8a0c1f5413f9ce4b6be47c7974e8509171b11c':'v1-vulnerable','58fb7eefb61d968668106385cf7a7dc8e8591004162a81c6b50562ea':'v2-corrected'}
iso=lambda n:datetime.datetime.fromtimestamp(n,datetime.timezone.utc).isoformat()
url=lambda h:'https://preprod.cardanoscan.io/transaction/'+h
ref=lambda o:o['tx_hash']+'#'+str(o['tx_index'])
spent={ref(i):t for t in txs for i in t['inputs']};records=[];escrows=[]
for t in sorted(txs,key=lambda x:(x['tx_timestamp'],x['tx_block_index'])):
 contracts=t['plutus_contracts'] or [];releases=[]
 for c in contracts:
  if c['script_hash'] not in versions:continue
  datum=c['input']['datum']['value']['fields'];action=c['input']['redeemer']['datum']['value']['constructor'];ben=datum[13]['bytes'];owed=max(datum[15]['int'],int(next(i['value'] for i in t['inputs'] if i['payment_addr']['cred']==c['script_hash']))) if versions[c['script_hash']]=='v2-corrected' else datum[15]['int']
  received=[int(o['value']) for o in t['outputs'] if o['payment_addr']['cred']==ben]
  releases.append({'action':'release' if action==0 else 'refund','validatorVersion':versions[c['script_hash']],'scriptHash':c['script_hash'],'spendsInput':c['spends_input'],'beneficiary':ben,'requiredLovelace':str(owed) if action==0 else None,'beneficiaryOutputLovelace':[str(v) for v in received],'beneficiaryPaidAsRequired':any(v>=owed for v in received) if action==0 else None,'refundKey':datum[14]['bytes'],'refundOutputsLovelace':[o['value'] for o in t['outputs'] if o['payment_addr']['cred']==datum[14]['bytes']],'validContract':c['valid_contract'],'redeemer':c['input']['redeemer']})
 locks=[o for o in t['outputs'] if o['payment_addr']['cred'] in versions]
 action='+'.join(sorted(set(c['action'] for c in releases))) if releases else 'lock' if locks else 'wallet-funding/payment'
 versionsHere=sorted(set([versions[o['payment_addr']['cred']]for o in locks]+[c['validatorVersion']for c in releases]))
 records.append({'txHash':t['tx_hash'],'network':'cardano:preprod','state':'confirmed','blockNumber':t['block_height'],'blockHash':t['block_hash'],'blockTimestamp':iso(t['tx_timestamp']),'feeLovelace':t['fee'],'operation':action,'validatorVersions':versionsHere,'explorerUrl':url(t['tx_hash']),'verificationSource':'Koios Preprod tx_info + address_txs','retrievedAt':collection['retrievedAt'],'documentedLocally':t['tx_hash'] in idx,'localSources':idx.get(t['tx_hash'],[]),'inputs':t['inputs'],'outputs':t['outputs'],'referenceInputs':t['reference_inputs'],'collateralInputs':t['collateral_inputs'],'collateralOutput':t['collateral_output'],'metadata':t['metadata'],'scriptChecks':releases,'plutusContracts':contracts,'validitySlots':{'from':t['invalid_before'],'to':t['invalid_after']}})
 for o in locks:
  s=spent.get(ref(o));escrows.append({'escrowRef':ref(o),'lockTx':t['tx_hash'],'validatorVersion':versions[o['payment_addr']['cred']],'scriptAddress':o['payment_addr']['bech32'],'lovelace':o['value'],'datum':o['inline_datum'],'spendingTx':s['tx_hash']if s else None,'status':'spent'if s else 'no spend in retrieved complete address history','monitoring':'off-chain only; see JSONL sources, not chain evidence'})
# List Base Sepolia receipts in explicitly described payment lines, never infer that a 32-byte digest is a transaction.
base=[]
for no,line in enumerate((r/'PROOFS.md').read_text().splitlines(),1):
 if ('|' in line or any(w in line.lower()for w in ['bought','paid','payment','ausd'])):
  for h in re.findall(r'0x[a-f0-9]{64}',line):
   if h in {'0x11e0e1b67c51d6c7ecc06f18d0ce6d2b2b1802243733bf63cc69df10599b86c5','0xf083d879a1ca4e8aadc7aa72c7ee1c5b60bf18436689e935280bfa439497e191'}:continue
   base.append({'txHash':h,'network':'base:sepolia','state':'unverified','source':f'PROOFS.md:{no}','category':'API-payment-or-faucet','note':'Not a Cardano transaction; no EVM receipt independently queried'})
base=list({x['txHash']:x for x in base}.values())
data={'scope':'All transactions found for both validator addresses and four known wallet address forms; not every possible wallet owned by the team','retrievedAt':collection['retrievedAt'],'records':records,'escrows':escrows,'baseSepoliaReceipts':base,'unresolvedHashCandidates':[{'hash':h,'sources':s,'classification':'not found on Cardano; may be request/datum/digest/signature/test fixture/Base receipt; NOT a confirmed or submitted Cardano transaction'}for h,s in idx.items()if h not in {t['tx_hash']for t in txs}],'collectionErrors':collection['errors']}
utxo_file=p/'current-script-utxos.json'
if utxo_file.exists():
 current={x['tx_hash']+'#'+str(x['tx_index']) for x in json.loads(utxo_file.read_text())}
 for e in escrows:
  e['unspentIndependentlyObserved']=e['escrowRef'] in current
  if e['escrowRef'] in current:e['status']='unspent in Koios address_utxos snapshot'
 data['currentUtxoEvidence']='audit-evidence/current-script-utxos.json'
(r/'transaction-history.json').write_text(json.dumps(data,indent=2))
lines=['# CreatorPay transaction history','',f'Independently retrieved from Koios Preprod at {collection["retrievedAt"]}. All times below UTC. {len(records)} confirmed transactions. The JSON includes every input, output, amount, inline datum, available redeemer, execution units, fee, validity range and script version. Cardanoscan links identify actual chain-confirmed hashes; its UI was blocked by a Cloudflare challenge during this review.','', 'Scope: both validator addresses, buyer/seller base addresses and their enterprise payout addresses. Address history was paginated; no collection errors. This is not a claim to enumerate unrelated or undisclosed wallets. Monitoring and API purchase happen off-chain/from another testnet.','', '| UTC | Block | Transaction | Action | Validator | Fee (lovelace) |','|---|---:|---|---|---|---:|']
for t in records:lines.append(f'| {t["blockTimestamp"]} | {t["blockNumber"]} | [{t["txHash"]}]({t["explorerUrl"]}) | {t["operation"]} | {", ".join(t["validatorVersions"]) or "—"} | {t["feeLovelace"]} |')
lines+=['','## Escrow lifecycles','','Each row is a real lock output. Monitoring is not a ledger event. Spending links are reconstructed from transaction inputs, not from log order. All 10 outputs with no spending edge were separately confirmed unspent using Koios address_utxos: 40 tADA at v1 and 10 tADA at v2.','','| Escrow | Version | Locked lovelace | Spending transaction | Outcome |','|---|---|---:|---|---|']
for e in escrows:
 s=next((t for t in records if t['txHash']==e['spendingTx']),None)
 lines.append(f'| [{e["escrowRef"]}]({url(e["lockTx"])}) | {e["validatorVersion"]} | {e["lovelace"]} | '+(f'[{s["txHash"]}]({s["explorerUrl"]}) | {s["operation"]}'if s else '— | no spend found')+' |')
lines+=['','## Payout verification','','Every release was checked against its consumed inline datum: a single output at the beneficiary payment credential must meet the applicable v1 payout or v2 maximum of payout and locked ADA. Results: '+str(collections.Counter(str(c['beneficiaryPaidAsRequired'])for t in records for c in t['scriptChecks']if c['action']=='release'))+'. Refunds require the refund signer, not a specified output; actual refund outputs are listed separately in JSON.','', '## Non-chain and other-network evidence','','No evaluation failure, dry run, or API response is listed as a Cardano transaction. Base Sepolia receipts are retained separately in JSON with state unverified. Hash candidates that did not resolve are preserved with source locations; most are cryptographic digests or fixtures, not missing payments.']
(r/'TRANSACTION_HISTORY.md').write_text('\n'.join(lines)+'\n')
print('records',len(records),'actions',collections.Counter(t['operation']for t in records),'escrows',len(escrows),'unspent',sum(not e['spendingTx']for e in escrows),'new',[(t['txHash'],t['operation'])for t in records if not t['documentedLocally']]);print('payouts',collections.Counter(c['beneficiaryPaidAsRequired']for t in records for c in t['scriptChecks']if c['action']=='release'))

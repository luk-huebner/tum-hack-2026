import json,re,pathlib,urllib.request,concurrent.futures,time
root=pathlib.Path(__file__).resolve().parents[1]; out=root/'audit-evidence'; sources={}; addresses=set()
for p in root.rglob('*'):
 if p.name in ['transaction-history.json','ORACLE_ARCHITECTURE.md','CODE_AND_SECURITY_REVIEW.md','TRANSACTION_HISTORY.md','TRANSACTION_AUDIT.md','JUDGE_DEMO.md','CHANGES.md']: continue
 if not p.is_file() or any(x in p.parts for x in ['node_modules','audit-evidence','.git','build']) or p.suffix not in ['.md','.ts','.json','.jsonl','.mjs','.html','.txt']: continue
 text=p.read_text(errors='replace')
 for n,line in enumerate(text.splitlines(),1):
  for m in re.finditer(r'(?<![\da-fA-F])(?:0x)?([a-fA-F0-9]{64})(?![a-fA-F0-9])',line):
   sources.setdefault(m[1].lower(),[]).append({'file':str(p.relative_to(root)),'line':n,'hexPrefix':m[0].startswith('0x')})
 addresses.update(re.findall(r'addr_test1[0-9a-z]{40,}',text))
(out/'local-hash-index.json').write_text(json.dumps(sources,indent=2))
def call(endpoint,body):
 req=urllib.request.Request('https://preprod.koios.rest/api/v1/'+endpoint,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
 for attempt in range(3):
  try:
   with urllib.request.urlopen(req,timeout=40) as r:return json.load(r)
  except Exception as e:
   if attempt==2:return {'error':type(e).__name__+': '+str(e),'endpoint':endpoint}
def getaddr(a):
 rows=[]
 for offset in range(0,10000,1000):
  res=call('address_txs?limit=1000&offset='+str(offset),{'_addresses':[a]})
  if isinstance(res,dict):return a,res
  rows+=res
  if len(res)<1000:break
 return a,rows
# Derive both script addresses with the SDK separately; include ones already in text.
extra=out/'script-addresses.json'
if extra.exists(): addresses.update(json.loads(extra.read_text()).values())
addr=dict(concurrent.futures.ThreadPoolExecutor(6).map(getaddr,sorted(addresses)))
(out/'address-history.json').write_text(json.dumps(addr,indent=2))
hashes=set(sources)
for rows in addr.values():
 if isinstance(rows,list):hashes.update(x['tx_hash'] for x in rows)
hashes=sorted(hashes)
def batch(hs):return call('tx_info',{'_tx_hashes':hs,'_inputs':True,'_metadata':True,'_scripts':True,'_bytecode':True})
allrows=[];errors=[]
for res in concurrent.futures.ThreadPoolExecutor(6).map(batch,[hashes[i:i+30] for i in range(0,len(hashes),30)]):
 if isinstance(res,list):allrows+=res
 else:errors.append(res)
(out/'koios-transactions.json').write_text(json.dumps(allrows,indent=2))
(out/'collection.json').write_text(json.dumps({'queriedHashes':hashes,'addresses':sorted(addresses),'errors':errors,'retrievedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'transactions':len(allrows)},indent=2))
print('Local hashes',len(sources),'addresses',len(addresses),'queried',len(hashes),'on-chain',len(allrows),'errors',errors,flush=True)

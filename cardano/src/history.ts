import { readFileSync } from "node:fs";
/** Read-only chain queries; updates only local confirmation records, never submits. */
import { config } from 'dotenv';
import { latestTransactions, reconcile } from './tx-tracking.js';
config();
if (process.argv[2] === "--archive") {
  const data = JSON.parse(readFileSync(new URL("../../transaction-history.json", import.meta.url), "utf8"));
  const filter = process.argv[3];
  for (const row of data.records.filter((r: {txHash:string;inputs:{tx_hash:string;tx_index:number}[]}) => !filter || r.txHash === filter || r.inputs.some(i=>`${i.tx_hash}#${i.tx_index}` === filter))) console.log(JSON.stringify(row));
  process.exit(0);
}
const filter=process.argv[2];
for(const row of latestTransactions().filter(r=>!filter||r.txHash===filter||r.escrowRefs.includes(filter)||r.campaign===filter))
 console.log(JSON.stringify(row.state==='built'?row:await reconcile(row.txHash)));

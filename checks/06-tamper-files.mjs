// Offline. Makes the tamper bench for judges from one REAL signed response:
//   valid.json            the response as AirnodeHub signed it
//   edited.json           one value edited (d00 6.90 -> 0.90), signature untouched
//   other-request.json    a real, validly signed response to a DIFFERENT request (a YouTube video, from checks/out)
//   foreign-signer.json   the same request, time and data, signed by a throwaway key that is not the Airnode
// "Too old" needs no file: the valid response is simply older than a policy's maximum age.
// Run: node checks/06-tamper-files.mjs checks/out/meteo-rain-1793355726.json
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { encodePacked, keccak256, toHex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const file = process.argv[2];
if (!file) throw new Error('Usage: node checks/06-tamper-files.mjs <saved-response.json>');
const valid = JSON.parse(readFileSync(file, 'utf8'));
const pick = (r) => ({ airnode: r.airnode, requestHash: r.requestHash, timestamp: r.timestamp, data: r.data, signature: r.signature });

const dir = new URL('../cardano/vectors/tamper/', import.meta.url);
mkdirSync(dir, { recursive: true });
const save = (name, r) => writeFileSync(new URL(name, dir), JSON.stringify(pick(r), null, 2));

save('valid.json', valid);

if (!valid.data.includes('"d00":6.90')) throw new Error('Expected d00 to be 6.90 in the response');
save('edited.json', { ...valid, data: valid.data.replace('"d00":6.90', '"d00":0.90') });

const outDir = new URL('./out/', import.meta.url);
const other = readdirSync(outDir).find((n) => n.startsWith('lunar-post-'));
if (!other) throw new Error('No saved LunarCrush response in checks/out to use as the different-request case');
save('other-request.json', JSON.parse(readFileSync(new URL(other, outDir), 'utf8')));

const account = privateKeyToAccount(generatePrivateKey());
const digest = keccak256(encodePacked(['bytes32', 'uint256', 'bytes'], [valid.requestHash, BigInt(valid.timestamp), toHex(valid.data)]));
const signature = await account.signMessage({ message: { raw: digest } });
save('foreign-signer.json', { ...valid, airnode: account.address, signature });

copyFileSync(new URL(file, `file:///${process.cwd().replace(/\\/g, '/')}/`), new URL('../cardano/vectors/meteo-response.json', import.meta.url));
console.log('wrote cardano/vectors/tamper/{valid,edited,other-request,foreign-signer}.json and cardano/vectors/meteo-response.json');

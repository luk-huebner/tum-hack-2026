// Offline preparation only. No payments, network requests or file activation.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { encodePacked, hashMessage, keccak256, recoverPublicKey, toHex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { deriveRequestHash, verifySignedResponse } from '../lib/airnode-v2.ts';

const [validFile, otherFile] = process.argv.slice(2);
if (!validFile || !otherFile) throw new Error('Pass the two previously purchased, saved responses. This script never buys responses.');
const valid = JSON.parse(readFileSync(validFile, 'utf8'));
const other = JSON.parse(readFileSync(otherFile, 'utf8'));
const stale = JSON.parse(readFileSync(new URL('../cardano/vectors/tamper/valid.json', import.meta.url), 'utf8'));
const template = JSON.parse(readFileSync(new URL('../cardano/vectors/meteo.json', import.meta.url), 'utf8'));
const expected = `0x${template.requestHashHex}`;
await verifySignedResponse(valid, template.airnode, expected);
if (deriveRequestHash(valid.request) !== expected) throw new Error('Control request mismatch');
await verifySignedResponse(other, template.airnode, deriveRequestHash(other.request));
if (other.requestHash === expected) throw new Error('Different-request control must use a genuinely different request');
await verifySignedResponse(stale, template.airnode, expected);
const now = Date.now();
for (const response of [valid, other]) {
  const age = now - Number(response.timestamp) * 1000;
  if (age < -60_000 || age > 3_600_000) throw new Error('Control evidence must have been signed within the last hour');
}
if (now - Number(stale.timestamp) * 1000 <= 300_000) throw new Error('Stale evidence must already exceed five minutes');
const digest = keccak256(encodePacked(['bytes32', 'uint256', 'bytes'], [valid.requestHash, BigInt(valid.timestamp), toHex(valid.data)]));
const pub = Buffer.from((await recoverPublicKey({hash: hashMessage({raw: digest}), signature: valid.signature})).slice(2), 'hex');
const compressed = Buffer.concat([Buffer.from([pub[64] & 1 ? 3 : 2]), pub.subarray(1, 33)]).toString('hex');
if (compressed !== template.pubkeyHex) throw new Error('Airnode public key changed; fixture policy must be reviewed');
const nums = [...valid.data.matchAll(/(?<=:)-?\d+(?:\.\d+)?(?=[,}])/g)];
const hex = text => Buffer.from(text).toString('hex');
if (nums.length !== 14 || hex(valid.data.slice(0, nums[0].index)) !== template.prefixHex || hex(valid.data.slice(nums.at(-1).index + nums.at(-1)[0].length)) !== template.suffixHex) throw new Error('Unexpected signed data shape');
const separators = nums.slice(1).map((n, i) => hex(valid.data.slice(nums[i].index + nums[i][0].length, n.index)));
if (JSON.stringify(separators) !== JSON.stringify(template.separatorsHex)) throw new Error('Signed text separators changed');
const sum = nums.reduce((total, n) => total + Number(n[0]), 0);
if (sum >= 30) throw new Error('The real control no longer satisfies the unchanged rainfall rule');
const account = privateKeyToAccount(generatePrivateKey()); // throwaway key exists only in memory
const signature = await account.signMessage({message: {raw: digest}});
const first = nums[0];
const edited = valid.data.slice(0, first.index) + String(Number(first[0]) + 1) + valid.data.slice(first.index + first[0].length);
const pick = r => ({airnode:r.airnode, requestHash:r.requestHash, timestamp:r.timestamp, data:r.data, signature:r.signature});
const folder = new URL('../cardano/vectors/tamper-renewal/', import.meta.url);
mkdirSync(folder, {recursive:true});
for (const [name, response] of Object.entries({valid, edited:{...valid,data:edited}, stale, 'other-request':other, 'foreign-signer':{...valid,airnode:account.address,signature}})) {
  writeFileSync(new URL(`${name}.json`,folder), JSON.stringify(pick(response),null,2));
}
const manifest = {version:1, preparedAt:new Date().toISOString(), controlSignedAt:new Date(Number(valid.timestamp)*1000).toISOString(), controlFreshUntil:new Date(Number(valid.timestamp)*1000+48*3_600_000).toISOString(), requestHash:expected, sum, staleUsesSeparateOldSignature:true, differentRequestUsesSameAirnode:true};
writeFileSync(new URL('manifest.json',folder),JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));

// Offline check, no network, no keys.
// 1. Takes the signed test vector from the AirnodeHub docs ("From API to contract") and derives the three inputs that
//    Plutus ECDSA verification needs: a 33-byte compressed key, the 32-byte EIP-191 message hash, a 64-byte signature.
// 2. Makes a device-style Ed25519 vector (warm-up for "devices as sellers").
// Run: node checks/01-vector.mjs
import { generateKeyPairSync, sign } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import {
  bytesToHex,
  encodePacked,
  hashMessage,
  hexToBytes,
  keccak256,
  recoverPublicKey,
  toHex,
} from 'viem';
import { publicKeyToAddress } from 'viem/utils';

const DOC_VECTOR = {
  airnode: '0xE70f1e8b22a21e4Bb5188918a3033341b281E4c0',
  requestHash: '0x180eae9387bb66a72380e61ebe0a00d19f8414a716a37ebe1df124b66acfff66',
  timestamp: '1792403240',
  data: '{"price":2443.95,"updatedAt":1792403240691}',
  signature:
    '0xb034c17a11679ff06e50445c84419c34ba0aee5669bbda3a0dd563d2437928a17e5b34826fd505b0d1cace3712570df07de0d0a7eb2e1610c84cd4a0d71827e21b',
};

const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

const plutusInputs = async (r) => {
  const digest = keccak256(encodePacked(['bytes32', 'uint256', 'bytes'], [r.requestHash, BigInt(r.timestamp), toHex(r.data)]));
  const messageHash = hashMessage({ raw: digest }); // keccak256("\x19Ethereum Signed Message:\n32" || digest)
  const uncompressed = await recoverPublicKey({ hash: messageHash, signature: r.signature });
  const pub = hexToBytes(uncompressed); // 0x04 || X || Y
  const compressed = new Uint8Array(33);
  compressed[0] = pub[64] & 1 ? 3 : 2;
  compressed.set(pub.slice(1, 33), 1);
  const sig = hexToBytes(r.signature);
  const s = BigInt(bytesToHex(sig.slice(32, 64)));
  return {
    recoveredAddressMatches: publicKeyToAddress(uncompressed).toLowerCase() === r.airnode.toLowerCase(),
    lowS: s <= SECP256K1_N / 2n,
    compressedPubkey: bytesToHex(compressed).slice(2),
    messageHash: messageHash.slice(2),
    signatureCompact64: bytesToHex(sig.slice(0, 64)).slice(2),
    requestHash: r.requestHash.slice(2),
    timestamp: Number(r.timestamp),
    dataHex: toHex(r.data).slice(2),
  };
};

const doc = await plutusInputs(DOC_VECTOR);

// Ed25519 device vector: a sensor signs "temp=7.2C@<unix seconds>".
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const rawPub = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
const message = Buffer.from('temp=7.2C@1793305331');
const edSig = sign(null, message, privateKey);
const device = {
  publicKey: rawPub.toString('hex'),
  messageHex: message.toString('hex'),
  messageText: message.toString(),
  signature: edSig.toString('hex'),
};

const out = { doc, device };
writeFileSync(new URL('./out/vector.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));

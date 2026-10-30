/**
 * Off-chain side of Pay-on-Proof: builds the policy datum, locks funds at the validator, and releases or refunds them.
 * Testnet only. Seeds come from .env and are never printed.
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { blake2b } from "@noble/hashes/blake2.js";
import { Address, Assets, Client, Data, InlineDatum, PlutusV3, preprod } from "@evolution-sdk/evolution";

const bytes = (hex: string): Uint8Array => Uint8Array.from(Buffer.from(hex, "hex"));

config();

// ---------------------------------------------------------------------------
// The compiled validator (built by CI from aiken/airnode_spike, committed as aiken/blueprint/plutus.json)

const blueprint = JSON.parse(readFileSync(new URL("../../aiken/blueprint/plutus.json", import.meta.url), "utf8"));
const validator = blueprint.validators.find((v: { title: string }) => v.title === "pay_on_proof.pay_on_proof.spend");
if (!validator) throw new Error("pay_on_proof.spend not found in the blueprint");

const scriptBytes = Uint8Array.from(Buffer.from(validator.compiledCode as string, "hex"));
// A Plutus V3 script hash is blake2b-224 over the language tag 0x03 followed by the script bytes.
const computedHash = Buffer.from(blake2b(Uint8Array.from([3, ...scriptBytes]), { dkLen: 28 })).toString("hex");
if (computedHash !== validator.hash) throw new Error(`Script hash mismatch: ${computedHash} vs ${validator.hash}`);

export const script = new PlutusV3.PlutusV3({ bytes: scriptBytes });
export const scriptHash: string = validator.hash;
// Enterprise script address on a testnet: header 0x70 followed by the script hash.
export const scriptAddress = Address.fromHex(`70${scriptHash}`);

// ---------------------------------------------------------------------------
// Policy and actions, encoded exactly as the Aiken types are laid out (constructor index, field order)

export type Cmp = "Below" | "AtLeast";

export interface Policy {
  signerHex: string; // 33-byte compressed secp256k1 key
  requestHashHex: string; // 32 bytes
  prefixHex: string;
  separatorsHex: string[];
  suffixHex: string;
  scale: number;
  slotFrom: number;
  slotTo: number;
  cmp: Cmp;
  threshold: number; // already multiplied by 10^scale
  settleAfterMs: number;
  deadlineMs: number;
  maxAgeMs: number;
  beneficiaryHex: string; // 28-byte payment key hash
  refundToHex: string; // 28-byte payment key hash
  payout: bigint; // lovelace
}

export const policyData = (p: Policy) =>
  Data.constr(0n, [
    bytes(p.signerHex),
    bytes(p.requestHashHex),
    bytes(p.prefixHex),
    p.separatorsHex.map(bytes),
    bytes(p.suffixHex),
    BigInt(p.scale),
    BigInt(p.slotFrom),
    BigInt(p.slotTo),
    Data.constr(p.cmp === "Below" ? 0n : 1n, []),
    BigInt(p.threshold),
    BigInt(p.settleAfterMs),
    BigInt(p.deadlineMs),
    BigInt(p.maxAgeMs),
    bytes(p.beneficiaryHex),
    bytes(p.refundToHex),
    p.payout,
  ]);

export const releaseData = (timestamp: number, slotsHex: string[], signatureHex: string) =>
  Data.constr(0n, [BigInt(timestamp), slotsHex.map(bytes), bytes(signatureHex)]);

export const refundData = () => Data.constr(1n, []);

export interface Vector {
  airnode: string;
  request: unknown;
  data: string;
  timestamp: number;
  requestHashHex: string;
  signatureHex: string;
  pubkeyHex: string;
  prefixHex: string;
  separatorsHex: string[];
  suffixHex: string;
  slotsText: string[];
  slotsHex: string[];
}

export const loadVector = (name: string): Vector =>
  JSON.parse(readFileSync(new URL(`../vectors/${name}.json`, import.meta.url), "utf8"));

// ---------------------------------------------------------------------------
// Client and wallets

const baseUrl = process.env.BLOCKFROST_BASE_URL ?? "https://cardano-preprod.blockfrost.io/api/v0";

const needEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} in cardano/.env (see wallets.ts)`);
  return value;
};

export const makeClient = (mnemonicVar: "MNEMONIC" | "SELLER_MNEMONIC" = "MNEMONIC") =>
  Client.make(preprod)
    .withBlockfrost({ baseUrl, projectId: needEnv("BLOCKFROST_PROJECT_ID") })
    .withSeed({ mnemonic: needEnv(mnemonicVar).trim().replace(/\s+/g, " ").toLowerCase() });

/** The 28-byte payment key hash of a base or enterprise preprod address, as hex. */
export const paymentKeyHashHex = (bech32: string): string => Address.toHex(Address.fromBech32(bech32)).slice(2, 58);

export const sellerAddressBech32 = () => needEnv("SELLER_ADDRESS");

export const hexOf = (bytes: Uint8Array): string => Buffer.from(bytes).toString("hex");

export const lovelace = (n: bigint) => Assets.fromLovelace(n);

export const inlineDatum = (data: ReturnType<typeof policyData>) => new InlineDatum.InlineDatum({ data });

export const cborHexOf = (data: ReturnType<typeof policyData>): string => Data.toCBORHex(data);

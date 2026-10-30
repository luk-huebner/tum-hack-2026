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

// VALIDATOR_BLUEPRINT points at another compiled validator, for example aiken/blueprint/plutus-v1-a9e4420c.json (the first
// version, whose flaw TRUST.md describes), so the same attacks can be run against both.
const blueprint = JSON.parse(readFileSync(process.env.VALIDATOR_BLUEPRINT ?? new URL("../../aiken/blueprint/plutus.json", import.meta.url), "utf8"));
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
  obsSlot?: number; // index of the slot holding the observation time in POSIX ms, -1 (the default) when the feed has none
  obsMaxAgeMs?: number; // how old that observation may be when the Airnode signed
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
    BigInt(p.obsSlot ?? -1),
    BigInt(p.obsMaxAgeMs ?? 0),
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

// ---------------------------------------------------------------------------
// Responses submitted by anyone (a judge, a keeper bot, an agent)

export interface SignedResponse {
  airnode: string;
  requestHash: string;
  timestamp: string | number;
  data: string;
  signature: string;
}

/**
 * The numeric values of a signed flat object such as {"d00":6.90,"d01":0.10}. Nothing is checked here on purpose:
 * the contract rebuilds the signed text from these values and rejects anything that does not match the signature.
 */
export const slotsFromData = (data: string): string[] => [...data.matchAll(/(?<=:)-?\d+(?:\.\d+)?(?=[,}])/g)].map((m) => m[0]);

/** Airnode signatures are 65 bytes (r, s, v); Plutus verifies the 64-byte compact form. */
export const compactSignatureHex = (signature: string): string => signature.replace(/^0x/, "").slice(0, 128);

export const releaseDataFromResponse = (r: SignedResponse) =>
  releaseData(
    Number(r.timestamp),
    slotsFromData(r.data).map((slot) => Buffer.from(slot, "utf8").toString("hex")),
    compactSignatureHex(r.signature),
  );

export interface PolicyView {
  signerHex: string;
  requestHashHex: string;
  beneficiaryHex: string;
  refundToHex: string;
  payout: bigint;
  /** A response signed before this time does not count (the policy measures only after it). */
  settleAfterMs: number;
  deadlineMs: number;
  maxAgeMs: number;
  threshold: number;
  scale: number;
  slotFrom: number;
  slotTo: number;
  cmp: Cmp;
  obsSlot: number;
  obsMaxAgeMs: number;
}

/** Reads the policy back from a locked UTxO's inline datum, so a caller needs nothing but the UTxO reference. */
export const policyViewOf = (utxo: { datumOption?: unknown }): PolicyView => {
  const fields = (utxo.datumOption as { data?: { fields?: unknown[] } } | undefined)?.data?.fields;
  if (!fields) throw new Error("The UTxO has no readable inline datum");
  const hex = (b: unknown) => Buffer.from(b as Uint8Array).toString("hex");
  return {
    signerHex: hex(fields[0]),
    requestHashHex: hex(fields[1]),
    beneficiaryHex: hex(fields[13]),
    refundToHex: hex(fields[14]),
    payout: BigInt(fields[15] as bigint),
    settleAfterMs: Number(fields[10]),
    deadlineMs: Number(fields[11]),
    maxAgeMs: Number(fields[12]),
    threshold: Number(fields[9]),
    scale: Number(fields[5]),
    slotFrom: Number(fields[6]),
    slotTo: Number(fields[7]),
    cmp: Number((fields[8] as { index: bigint }).index) === 0 ? "Below" : "AtLeast",
    // policies locked under the first validator version have 16 fields and no observation check
    obsSlot: fields.length > 16 ? Number(fields[16]) : -1,
    obsMaxAgeMs: fields.length > 17 ? Number(fields[17]) : 0,
  };
};

// ---------------------------------------------------------------------------
// Waiting on the chain. Both loops use timers, which keep the process alive.

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// a dropped connection must not hang a wait loop forever: every provider call gives up after 15 seconds and the loop tries again
const blockfrost = (path: string) => fetch(`${baseUrl}${path}`, { headers: { project_id: process.env.BLOCKFROST_PROJECT_ID ?? "" }, signal: AbortSignal.timeout(15_000) });

/** Polls until the transaction is in a block. */
export const waitForTx = async (txHash: string, timeoutMs = 180_000): Promise<boolean> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if ((await blockfrost(`/txs/${txHash}`)).ok) return true;
    } catch {
      // a dropped connection (a train, say) must not end the wait
    }
    await sleep(5000);
  }
  return false;
};

/**
 * The node validates a transaction against its own latest slot, which trails the wall clock by up to a minute on preprod.
 * A transaction that starts "in the past" can still be refused as OutsideValidityIntervalUTxO, so wait for the chain tip.
 */
export const waitForTip = async (minMs: number, timeoutMs = 240_000): Promise<void> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await blockfrost("/blocks/latest");
      if (response.ok && ((await response.json()) as { time: number }).time * 1000 >= minMs) return;
    } catch {
      // a dropped connection must not end the wait
    }
    await sleep(5000);
  }
  throw new Error("The chain tip did not reach the start of the validity interval in time");
};

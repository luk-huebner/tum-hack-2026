/**
 * Client for the escrow route: pay by x402 and have the payment locked straight into the Pay-on-Proof validator.
 *
 *   tsx src/escrow-client.ts --dry                      show the price list and the policy datum, pay nothing
 *   tsx src/escrow-client.ts --build-only               also build and sign the payment transaction locally, send nothing
 *   tsx src/escrow-client.ts --at-least 2220 --minutes 40   pay 5 tADA: pay the seller if ETH/USD is at least 2220 before the
 *                                                       deadline, refund this wallet otherwise
 *
 * The refund party is this wallet (MNEMONIC) unless --refund is given. Afterwards the policy UTxO is at the validator under
 * the payment's transaction hash; the reference is printed and saved to out/escrow-ref.json.
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Address, Data, Transaction } from "@evolution-sdk/evolution";
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { toClientCardanoSigner } from "@x402/cardano";
import { ExactCardanoScheme } from "@x402/cardano/exact/client";
import { hexOf, makeClient, paymentKeyHashHex, policyViewOf, scriptAddress, scriptHash, sleep } from "./engine.js";

config();

const { values } = parseArgs({
  options: {
    "at-least": { type: "string", default: "2000" },
    minutes: { type: "string", default: "40" },
    refund: { type: "string" },
    dry: { type: "boolean", default: false },
    "build-only": { type: "boolean", default: false },
  },
});

const NETWORK = "cardano:preprod" as const;
const base = process.env.SERVICE_URL ?? "http://localhost:4022";
const url = `${base}/api/escrow`;
const need = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} in cardano/.env`);
  return value;
};

const walletAddress: string = Address.toBech32(await makeClient("MNEMONIC").address());
const buyerAddress: string = values.refund ?? walletAddress;
const body = { refund: buyerAddress, atLeast: Number(values["at-least"]), deadlineMs: Date.now() + Number(values.minutes) * 60_000 };
const request = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };

type Requirement = { scheme: string; network: string; amount: string; asset: string; payTo: string; maxTimeoutSeconds: number; extra?: Record<string, unknown> };

const priceList = async (): Promise<Requirement> => {
  const response = await fetch(url, request);
  const header = response.headers.get("payment-required");
  if (response.status !== 402 || !header) throw new Error(`Expected a 402 price list, got HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const accepts = (JSON.parse(Buffer.from(header, "base64").toString("utf8")).accepts ?? []) as Requirement[];
  if (!accepts[0]) throw new Error("The 402 has no payment option");
  return accepts[0];
};

const describe = (r: Requirement) => {
  const extra = r.extra ?? {};
  const datumHex = String(extra.datum ?? "");
  const policy = policyViewOf({ datumOption: { data: Data.fromCBORHex(datumHex) } });
  const ours = paymentKeyHashHex(buyerAddress);
  console.log(`price list: ${Number(r.amount) / 1_000_000} tADA to ${r.payTo}`);
  console.log(`  transfer method ${String(extra.assetTransferMethod)}, script hash ${String(extra.scriptHash)}${extra.scriptHash === scriptHash ? " (our validator)" : " (NOT our validator)"}`);
  console.log(`  payTo is the validator address: ${r.payTo === Address.toBech32(scriptAddress)}`);
  console.log(`  datum: ${datumHex.length / 2} bytes; rule ${policy.cmp === "Below" ? "below" : "at least"} ${policy.threshold / 10 ** policy.scale}, pays ${Number(policy.payout) / 1_000_000} tADA`);
  console.log(`  refund party is this wallet: ${policy.refundToHex === ours}; deadline ${new Date(policy.deadlineMs).toISOString()}; max response age ${policy.maxAgeMs / 1000} s`);
  return policy;
};

const requirement = await priceList();
const policy = describe(requirement);
if (policy.refundToHex !== paymentKeyHashHex(buyerAddress)) throw new Error("The datum does not name this wallet as the refund party; not paying");
if (requirement.extra?.scriptHash !== scriptHash) throw new Error("The seller declared a different script; not paying");

const client = new x402Client().setSpendControls({
  // the escrow costs 5 tADA; refuse anything above 5.5 tADA per payment
  allowedAssets: [{ network: "cardano:*", asset: "lovelace", maxAmountPerPayment: "5500000" }],
});
const baseSigner = toClientCardanoSigner({
  mnemonic: need("MNEMONIC"),
  network: NETWORK,
  provider: { blockfrost: { baseUrl: process.env.BLOCKFROST_BASE_URL ?? "https://cardano-preprod.blockfrost.io/api/v0", projectId: need("BLOCKFROST_PROJECT_ID") } },
});
// Same TTL margin as buyer.ts: the facilitator measures the payment's TTL from the chain tip, which trails the clock.
const TTL_MARGIN_SECONDS = 120;
const signer = {
  ...baseSigner,
  buildAndSignPaymentTransaction: (input: Parameters<typeof baseSigner.buildAndSignPaymentTransaction>[0]) =>
    baseSigner.buildAndSignPaymentTransaction({ ...input, maxTimeoutSeconds: Math.max(60, input.maxTimeoutSeconds - TTL_MARGIN_SECONDS) }),
};

if (values.dry) {
  console.log("\n(dry: nothing was built or paid)");
} else if (values["build-only"]) {
  // Builds and signs the payment transaction exactly as a paid retry would, then reads it back. Nothing is sent anywhere.
  const built = await signer.buildAndSignPaymentTransaction({
    scheme: requirement.scheme,
    network: requirement.network,
    amount: requirement.amount,
    asset: requirement.asset,
    payTo: requirement.payTo,
    maxTimeoutSeconds: requirement.maxTimeoutSeconds,
    extra: requirement.extra,
  } as Parameters<typeof signer.buildAndSignPaymentTransaction>[0]);
  const tx = Transaction.fromCBORBytes(Buffer.from(built.transaction, "base64"));
  console.log("\nbuilt and signed locally, NOT sent. Outputs:");
  for (const output of tx.body.outputs) {
    const datum = (output as { datumOption?: { _tag?: string; data?: unknown } }).datumOption;
    const lovelace = (output as { assets: { lovelace: bigint } }).assets.lovelace;
    const isValidator = Address.toBech32(output.address) === requirement.payTo;
    console.log(`  ${Number(lovelace) / 1_000_000} tADA to ${Address.toBech32(output.address).slice(0, 18)}…${isValidator ? " (validator)" : ""}${datum ? `, inline datum ${datum._tag}` : ", no datum"}`);
    if (isValidator && datum?.data) console.log(`  the datum on the validator output is the one from the price list: ${Data.toCBORHex(datum.data as never) === requirement.extra?.datum}`);
  }
} else {
  client.register("cardano:*", new ExactCardanoScheme(signer));
  console.log(`\nPaying ${Number(requirement.amount) / 1_000_000} tADA into the validator via ${url}`);
  const started = Date.now();
  const response = await wrapFetchWithPayment(fetch, client)(url, request);
  console.log(`HTTP ${response.status} after ${((Date.now() - started) / 1000).toFixed(1)} s`);
  const answer = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  console.log(JSON.stringify(answer, null, 2));
  if (!response.ok) {
    console.log("\nNot charged: the payment is settled only when the seller accepts it.");
    process.exitCode = 1;
  } else {
    const receipt = new x402HTTPClient(client).getPaymentSettleResponse((name) => response.headers.get(name));
    const txHash = receipt?.transaction;
    console.log(`\nPayment (settled by the facilitator): https://preprod.cardanoscan.io/transaction/${txHash}`);
    // The payment output at the validator is the policy UTxO. Look for it by the payment's transaction hash.
    const wallet = makeClient("MNEMONIC");
    for (let attempt = 0; attempt < 24 && txHash; attempt++) {
      const found = (await wallet.getUtxos(scriptAddress).catch(() => [])).find((u) => hexOf(u.transactionId.hash) === txHash);
      if (found) {
        const ref = `${txHash}#${Number(found.index)}`;
        mkdirSync(new URL("../out/", import.meta.url), { recursive: true });
        writeFileSync(new URL("../out/escrow-ref.json", import.meta.url), JSON.stringify({ utxo: ref, source: "nodary:ETH/USD" }, null, 2));
        console.log(`Policy UTxO at the validator: ${ref}`);
        console.log(`Release it: tsx src/keeper.ts run --utxo ${ref} --submit     (or hire the keeper: tsx src/keep-client.ts --ref ${ref})`);
        break;
      }
      await sleep(10_000);
    }
  }
}

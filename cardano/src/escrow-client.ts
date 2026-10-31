import { trackExternal, recordTransaction, reconcile } from "./tx-tracking.js";
/**
 * Client for the escrow route: pay by x402 and have the payment locked straight into the Pay-on-Proof validator.
 *
 *   tsx src/escrow-client.ts --dry                      show the price list and the policy datum, pay nothing
 *   tsx src/escrow-client.ts --build-only               also build and sign the payment transaction locally, send nothing
 *   tsx src/escrow-client.ts --drop-response ...        a test of a buyer whose connection drops right after the payment is sent: the client
 *                                                       gives up on the answer after 1.5 s, then looks for its escrow at the validator by its datum
 *   tsx src/escrow-client.ts --at-least 2220 --minutes 40   pay 5 tADA: pay the seller if ETH/USD is at least 2220 before the
 *                                                       deadline, refund this wallet otherwise
 *   tsx src/escrow-client.ts --template tweet-likes --tweet 20 --at-least 300000     the likes of a registered tweet
 *   tsx src/escrow-client.ts --template rain-below --below 30                        Munich rainfall, 10 to 23 Oct 2026, in mm
 *   tsx src/escrow-client.ts --template source --source yt-views-brian-cohen --at-least 1100000   any registered source (register-source.ts)
 *   ... --payee addr_test1...                                                       pay this address (the creator) instead of the seller
 *   ... --minutes 120 --measure-after-minutes 90                                    count only data signed in the last 30 minutes (the end of the campaign)
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
import { checkRequirement, parseOffer } from "./escrow.js";
import { findByDatum } from "./proof.js";

config();

const { values } = parseArgs({
  options: {
    template: { type: "string", default: "eth-usd" },
    tweet: { type: "string" },
    source: { type: "string" },
    "at-least": { type: "string" },
    presence: { type: "boolean", default: false }, // template source: pay when the post is live (threshold 0), instead of a count
    below: { type: "string" },
    minutes: { type: "string", default: "40" },
    "measure-after-minutes": { type: "string" },
    payee: { type: "string" },
    refund: { type: "string" },
    dry: { type: "boolean", default: false },
    "build-only": { type: "boolean", default: false },
    "drop-response": { type: "boolean", default: false },
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
const base0 = {
  template: values.template,
  refund: buyerAddress,
  deadlineMs: Date.now() + Number(values.minutes) * 60_000,
  // count only data signed after this time (the end of a campaign, not a boost in the middle of it)
  ...(values.payee === undefined ? {} : { payee: values.payee }),
  ...(values["measure-after-minutes"] === undefined ? {} : { measureAfterMs: Date.now() + Number(values["measure-after-minutes"]) * 60_000 }),
};
const body =
  values.template === "rain-below"
    ? { ...base0, below: Number(values.below ?? "30") }
    : values.template === "tweet-likes"
      ? { ...base0, tweetId: values.tweet, atLeast: Number(values["at-least"] ?? "300000") }
      : values.template === "source"
        ? { ...base0, sourceId: values.source, ...(values.presence ? { presence: true } : values.below !== undefined ? { below: Number(values.below) } : { atLeast: Number(values["at-least"]) }) }
        : { ...base0, atLeast: Number(values["at-least"] ?? "2000") };
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
  console.log(`  template ${values.template}; datum: ${datumHex.length / 2} bytes; rule ${policy.cmp !== "Below" && policy.threshold === 0 ? "the post is live (threshold 0)" : `${policy.cmp === "Below" ? "below" : "at least"} ${policy.threshold / 10 ** policy.scale}`}, pays ${Number(policy.payout) / 1_000_000} tADA`);
  console.log(`  refund party is this wallet: ${policy.refundToHex === ours}; deadline ${new Date(policy.deadlineMs).toISOString()}; max response age ${policy.maxAgeMs / 1000} s`);
  return policy;
};

const requirement = await priceList();
const policy = describe(requirement);
// Recompute the whole price list from our own request and refuse unless it matches field by field (see checkRequirement).
const problems = checkRequirement(requirement, parseOffer(body, Date.now()));
if (problems.length > 0) throw new Error(`The price list is not the escrow this wallet asked for; not paying:\n  - ${problems.join("\n  - ")}`);
console.log("  the price list matches the escrow this wallet asked for, field by field");

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
  buildAndSignPaymentTransaction: async (input: Parameters<typeof baseSigner.buildAndSignPaymentTransaction>[0]) =>
    { const built = await baseSigner.buildAndSignPaymentTransaction({ ...input, maxTimeoutSeconds: Math.max(60, input.maxTimeoutSeconds - TTL_MARGIN_SECONDS) });
      trackExternal(Transaction.fromCBORBytes(Buffer.from(built.transaction, "base64")), "escrow-client.ts", !values["build-only"]);
      return built;
    },
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
  // With --drop-response the paid retry (the request that carries the signed payment) is abandoned 1.5 s after it is sent: the
  // server receives it, verifies, runs the handler and settles, but this client never sees the answer or the receipt.
  const lossyFetch: typeof fetch = async (input, init) => {
    const req = new Request(input as RequestInfo, init);
    if (!values["drop-response"] || !req.headers.has("payment-signature")) return fetch(req);
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 1500);
    return fetch(req, { signal: ctl.signal });
  };
  let response: Response;
  try {
    response = await wrapFetchWithPayment(lossyFetch, client)(url, request);
  } catch (error) {
    // Any transport failure may follow broadcast, not only the injected fault.
    console.log(`The connection dropped after the payment was sent (${(error as Error).name}). The buyer does not know whether it settled; looking for the escrow at the validator by its datum.`);
    const found = await findByDatum(makeClient("MNEMONIC"), String(requirement.extra?.datum), 240_000);
    if (found) await reconcile(hexOf(found.transactionId.hash)); // the journal learns that it landed
    if (found) console.log(`The escrow IS at the validator: ${hexOf(found.transactionId.hash)}#${Number(found.index)}. Nothing was lost; the seller's keeper will release it, or the buyer can refund it after the deadline.`);
    else console.log("No unspent escrow was found within 4 minutes. Payment status is UNKNOWN; it may already be spent or the provider unavailable. Inspect the journal before paying again.");
    process.exit(0);
  }
  console.log(`HTTP ${response.status} after ${((Date.now() - started) / 1000).toFixed(1)} s`);
  const answer = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  console.log(JSON.stringify(answer, null, 2));
  if (!response.ok) {
    // A refusal after the payment was sent is not proof that nothing was charged: a slow settlement is reported as a failure while the
    // transaction lands anyway (seen on 30 Oct: HTTP 402 after 61 s, escrow on chain). Look before saying so.
    console.log(`\nThe service answered HTTP ${response.status}. That does not prove the payment failed; looking for the escrow at the validator by its datum.`);
    const found = await findByDatum(makeClient("MNEMONIC"), String(requirement.extra?.datum), 150_000);
    if (found) await reconcile(hexOf(found.transactionId.hash)); // the journal learns that it landed
    if (found) console.log(`The payment DID settle: the escrow is at the validator as ${hexOf(found.transactionId.hash)}#${Number(found.index)}.`);
    else console.log("No unspent escrow found. Payment status is UNKNOWN; do not pay again before reconciling the recorded hash.");
    process.exitCode = found ? 0 : 1;
  } else {
    const receipt = new x402HTTPClient(client).getPaymentSettleResponse((name) => response.headers.get(name));
    const txHash = receipt?.transaction;
    if (txHash && /^[a-f0-9]{64}$/.test(txHash)) {
      recordTransaction(txHash, { state: "submitted", operation: "lock", source: "escrow-client.ts" });
      await reconcile(txHash);
      console.log(`\nPayment: https://preprod.cardanoscan.io/transaction/${txHash}`);
    } else console.log("No valid transaction hash in receipt; inspect the write-ahead journal.");
    // The payment output at the validator is the policy UTxO. Look for it by the payment's transaction hash.
    const wallet = makeClient("MNEMONIC");
    for (let attempt = 0; attempt < 24 && txHash; attempt++) {
      const found = (await wallet.getUtxos(scriptAddress).catch(() => [])).find((u) => hexOf(u.transactionId.hash) === txHash);
      if (found) {
        const ref = `${txHash}#${Number(found.index)}`;
        mkdirSync(new URL("../out/", import.meta.url), { recursive: true });
        writeFileSync(new URL("../out/escrow-ref.json", import.meta.url), JSON.stringify({ utxo: ref, template: values.template }, null, 2));
        console.log(`Policy UTxO at the validator: ${ref}`);
        console.log(`The seller's keeper (service with AUTO_RELEASE=1) releases it when the data proves the rule; or hire the keeper: tsx src/keep-client.ts --ref ${ref}`);
        break;
      }
      await sleep(10_000);
    }
  }
}

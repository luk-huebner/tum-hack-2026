/**
 * Client for the paid keeper job: an agent that hires the Pay-on-Proof keeper and pays per request with x402 on preprod.
 *
 *   tsx src/keep-client.ts --ref <txHash>#<index> [--source nodary:ETH/USD]    pays 2 tADA, but only if the policy is released
 *   tsx src/keep-client.ts --ref <txHash>#<index> --dry                        shows the price and payee, pays nothing
 *
 * The payment is built and signed here (MNEMONIC in .env pays the amount and the network fee) and settled by the
 * facilitator only after the keeper has answered with a success. A 4xx or 5xx answer settles nothing.
 */
import { config } from "dotenv";
import { parseArgs } from "node:util";
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { toClientCardanoSigner } from "@x402/cardano";
import { ExactCardanoScheme } from "@x402/cardano/exact/client";

config();

const { values } = parseArgs({
  options: { ref: { type: "string" }, source: { type: "string", default: "nodary:ETH/USD" }, dry: { type: "boolean", default: false } },
});
if (!values.ref) {
  console.log("usage: tsx src/keep-client.ts --ref <txHash>#<index> [--source nodary:ETH/USD] [--dry]");
  process.exit(1);
}

const base = process.env.SERVICE_URL ?? "http://localhost:4022";
const url = `${base}/api/keep`;
const request = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref: values.ref, source: values.source }) };

const showPrice = async () => {
  const response = await fetch(url, request);
  console.log(`HTTP ${response.status} (402 is expected: this is the price list, nothing was paid)`);
  const header = response.headers.get("payment-required");
  if (header) {
    const requirements = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    for (const a of requirements.accepts ?? []) {
      console.log(`  ${a.scheme} on ${a.network}: ${Number(a.amount ?? a.maxAmountRequired) / 1_000_000} tADA to ${a.payTo}, payment valid for ${a.maxTimeoutSeconds} s`);
    }
  } else {
    console.log(await response.text());
  }
};

if (values.dry) {
  await showPrice();
  // no process.exit here: exiting while fetch still holds sockets trips a libuv assertion on Windows
  process.exitCode = 0;
} else {
  await hire();
}

async function hire() {
  if (!process.env.MNEMONIC || !process.env.BLOCKFROST_PROJECT_ID) {
    console.error("Set MNEMONIC and BLOCKFROST_PROJECT_ID in cardano/.env");
    process.exit(1);
  }

  const NETWORK = "cardano:preprod" as const;
  const client = new x402Client().setSpendControls({
    // one job costs 2 tADA; refuse anything above 2.5 tADA per payment
    allowedAssets: [{ network: "cardano:*", asset: "lovelace", maxAmountPerPayment: "2500000" }],
  });

  const baseSigner = toClientCardanoSigner({
    mnemonic: process.env.MNEMONIC,
    network: NETWORK,
    provider: { blockfrost: { baseUrl: process.env.BLOCKFROST_BASE_URL ?? "https://cardano-preprod.blockfrost.io/api/v0", projectId: process.env.BLOCKFROST_PROJECT_ID } },
  });
  // Same TTL margin as buyer.ts: the facilitator measures the payment's TTL from the chain tip, which trails the clock.
  const TTL_MARGIN_SECONDS = 120;
  const signer = {
    ...baseSigner,
    buildAndSignPaymentTransaction: (input: Parameters<typeof baseSigner.buildAndSignPaymentTransaction>[0]) =>
      baseSigner.buildAndSignPaymentTransaction({ ...input, maxTimeoutSeconds: Math.max(60, input.maxTimeoutSeconds - TTL_MARGIN_SECONDS) }),
  };
  client.register("cardano:*", new ExactCardanoScheme(signer));

  console.log(`Hiring the keeper at ${url} for policy ${values.ref}`);
  console.log("(builds and signs a real preprod payment; the keeper then needs about a minute to wait for the chain tip)");
  const started = Date.now();
  const response = await wrapFetchWithPayment(fetch, client)(url, request);
  console.log(`\nHTTP ${response.status} after ${((Date.now() - started) / 1000).toFixed(1)} s`);
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const { evidence, ...rest } = body;
  console.log(JSON.stringify(rest, null, 2));
  if (evidence) console.log("The signed evidence is in the response body; it can be pasted into the bench page.");

  if (!response.ok) {
    // A refusal carries no payment receipt: the keeper answers 4xx or 5xx and the facilitator never settles.
    console.log("\nNot charged: the payment is settled only when the keeper succeeds.");
    process.exitCode = 1;
    return;
  }
  const receipt = new x402HTTPClient(client).getPaymentSettleResponse((name) => response.headers.get(name));
  if (receipt?.transaction) {
    console.log(`\nPaid 2 tADA: https://preprod.cardanoscan.io/transaction/${receipt.transaction}`);
    if (typeof body.explorer === "string") console.log(`Release:    ${body.explorer}`);
  }
}

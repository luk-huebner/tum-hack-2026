import { reconcile, trackExternal } from "./tx-tracking.js";
import { Transaction } from "@evolution-sdk/evolution";
import { submitTracked } from "./tx-tracking.js";
/**
 * Live demo runs for the console: the buyer's side of the story, step by step, with real transactions on Cardano preprod.
 *
 *   release mode  pay an escrow by x402 whose rule will hold; the seller's keeper (the watcher in the service) finds it and releases it
 *   refund mode   pay an escrow whose rule can never hold; show that a refund before the deadline is refused, then refund after it
 *
 * It spends test funds: 5 tADA leaves the demo buyer wallet (MNEMONIC) per run (it goes to the seller's key on release and comes
 * back minus a fee on refund), plus fees, and aUSD for tweet and rainfall data. So it only runs when the service is started with
 * DEMO_BUYER=1, which also binds the service to localhost, one run at a time.
 */
import { Address, KeyHash } from "@evolution-sdk/evolution";
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { toClientCardanoSigner } from "@x402/cardano";
import { ExactCardanoScheme } from "@x402/cardano/exact/client";
import { hexOf, makeClient, refundData, script, scriptAddress, sleep, waitForTip, waitForTx } from "./engine.js";
import { checkRequirement, describeOffer, parseOffer } from "./escrow.js";
import { classify, findByDatum, policyViewOf, withRetry } from "./proof.js";

export interface Step {
  at: string;
  text: string;
  kind: "info" | "ok" | "wait" | "refused";
  link?: { label: string; url: string };
}

export interface Run {
  id: string;
  mode: "release" | "refund";
  title: string;
  status: "running" | "done" | "failed";
  startedAt: string;
  steps: Step[];
  ref?: string;
}

export interface DemoParams {
  mode: "release" | "refund";
  template: string;
  value: number;
  tweetId?: string;
}

export interface DemoDeps {
  serviceUrl: string;
  /** Watcher state and the service's job list, so a run can see the seller's keeper act. */
  watch: () => { enabled: boolean; allowPaid?: boolean; candidates?: { ref: string; state: string; rule?: string }[] } | undefined;
  jobs: () => Record<string, unknown>[];
}

const scan = (hash: string) => `https://preprod.cardanoscan.io/transaction/${hash}`;
const runs = new Map<string, Run>();
let active: string | undefined;
let counter = 0;

export const getRun = (id: string) => runs.get(id);

/** Why a run cannot start right now, or undefined when it can. */
export const refusal = (params: DemoParams, deps: DemoDeps): string | undefined => {
  if (process.env.DEMO_BUYER !== "1") return "Live runs are off: start the service with DEMO_BUYER=1 (it then listens on this computer only).";
  if (active) return "A run is already in progress.";
  if (counter >= 20) return "This service has already made 20 runs; restart it to run more.";
  if (params.mode === "release") {
    const w = deps.watch();
    if (!w?.enabled) return "The seller's keeper is off, so nothing would release the escrow. Start the service with AUTO_RELEASE=1 (and AUTO_RELEASE_PAID=1 for tweets and rainfall).";
    if (params.template !== "eth-usd" && !w.allowPaid) return "Tweets and rainfall need paid data to prove. Start the service with AUTO_RELEASE_PAID=1.";
  }
  return undefined;
};

export const startDemoRun = (params: DemoParams, deps: DemoDeps): Run => {
  counter += 1;
  const id = `run-${counter}`;
  const run: Run = {
    id,
    mode: params.mode,
    title: params.mode === "release" ? `Escrow that will release (${params.template})` : "Escrow that nobody can release, then a refund",
    status: "running",
    startedAt: new Date().toISOString(),
    steps: [],
  };
  runs.set(id, run);
  active = id;
  const add = (kind: Step["kind"], text: string, link?: Step["link"]) => run.steps.push({ at: new Date().toISOString(), kind, text, ...(link ? { link } : {}) });
  void (async () => {
    try {
      await execute(params, deps, run, add);
      run.status = "done";
    } catch (error) {
      add("refused", `The run stopped: ${String((error as Error).message).replace(/\s+/g, " ").slice(0, 220)}`);
      run.status = "failed";
    } finally {
      active = undefined;
    }
  })();
  return run;
};

const execute = async (params: DemoParams, deps: DemoDeps, run: Run, add: (kind: Step["kind"], text: string, link?: Step["link"]) => void) => {
  const buyer = makeClient("MNEMONIC");
  const buyerAddress = Address.toBech32(await buyer.address());
  const minutes = params.mode === "release" ? 40 : 7;
  const value = params.mode === "refund" ? 999_999 : params.value; // an ETH/USD price no one will see
  const template = params.mode === "refund" ? "eth-usd" : params.template;
  const body = {
    template,
    refund: buyerAddress,
    deadlineMs: Date.now() + minutes * 60_000,
    ...(template === "rain-below" ? { below: value } : { atLeast: value }),
    ...(template === "tweet-likes" ? { tweetId: params.tweetId } : {}),
  };
  const offer = parseOffer(body, Date.now());
  const url = `${deps.serviceUrl}/api/escrow`;
  const request = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };

  add("info", `The buyer's agent asks the service for an escrow: ${describeOffer(offer)}; if that does not happen before ${new Date(offer.deadlineMs).toISOString().slice(11, 16)} UTC, the buyer is refunded.`);
  const first = await fetch(url, request);
  const header = first.headers.get("payment-required");
  if (first.status !== 402 || !header) throw new Error(`Expected a price list (HTTP 402), got ${first.status}`);
  const requirement = (JSON.parse(Buffer.from(header, "base64").toString("utf8")).accepts ?? [])[0];
  add("ok", `The service answers HTTP 402 with a price: ${Number(requirement.amount) / 1_000_000} tADA, payable straight to the contract, with the policy attached as the payment's datum.`);

  const problems = checkRequirement(requirement, offer);
  if (problems.length > 0) throw new Error(`The price list does not match what the buyer asked for: ${problems.join("; ")}`);
  add("ok", "The buyer's client recomputed the whole policy from its own request and found it identical, field by field (refund party, seller, rule, deadline, signer, request, amount). It would refuse any difference.");

  const client = new x402Client().setSpendControls({ allowedAssets: [{ network: "cardano:*", asset: "lovelace", maxAmountPerPayment: "5500000" }] });
  const baseSigner = toClientCardanoSigner({
    mnemonic: process.env.MNEMONIC as string,
    network: "cardano:preprod",
    provider: { blockfrost: { baseUrl: process.env.BLOCKFROST_BASE_URL ?? "https://cardano-preprod.blockfrost.io/api/v0", projectId: process.env.BLOCKFROST_PROJECT_ID as string } },
  });
  // the facilitator measures the payment's validity from the chain tip, which trails the clock (see buyer.ts)
  const signer = {
    ...baseSigner,
    buildAndSignPaymentTransaction: async (input: Parameters<typeof baseSigner.buildAndSignPaymentTransaction>[0]) => { const built = await baseSigner.buildAndSignPaymentTransaction({ ...input, maxTimeoutSeconds: Math.max(60, input.maxTimeoutSeconds - 120) }); trackExternal(Transaction.fromCBORBytes(Buffer.from(built.transaction, "base64")), "demo-run.ts", true); return built; },
  };
  client.register("cardano:*", new ExactCardanoScheme(signer));

  add("wait", "Building, signing and sending the payment (this takes 20 to 60 seconds on preprod).");
  const started = Date.now();
  const response = await wrapFetchWithPayment(fetch, client)(url, request);
  let utxo;
  let payTx: string | undefined;
  if (!response.ok) {
    // A refusal after the payment was sent does not prove that nothing was charged: a slow settlement is reported as a failure while the
    // transaction lands anyway. Look at the contract before saying the payment failed.
    add("wait", `The service answered HTTP ${response.status}. A slow settlement is reported as a failure even when the payment lands, so the console looks for the escrow at the contract by its datum.`);
    utxo = await findByDatum(buyer, String(requirement.extra?.datum), 150_000);
    if (!utxo) throw new Error(`The service refused the payment (HTTP ${response.status}) and no unspent escrow was found: status UNKNOWN. Inspect the transaction journal before retrying.`);
    payTx = hexOf(utxo.transactionId.hash);
    add("ok", `The payment DID settle: the escrow is at the contract (the buyer was told it failed, which is why the console looks).`, { label: "payment transaction", url: scan(payTx) });
  } else {
    const receipt = new x402HTTPClient(client).getPaymentSettleResponse((name) => response.headers.get(name));
    payTx = receipt?.transaction;
    if (!payTx) throw new Error("The payment settled but no transaction hash came back.");
    add("ok", `Paid 5 tADA by x402 in ${Math.round((Date.now() - started) / 1000)} s. The payment output is at the contract.`, { label: "payment transaction", url: scan(payTx) });
    for (let i = 0; i < 24 && !utxo; i++) {
      utxo = (await withRetry(() => buyer.getUtxos(scriptAddress), 2).catch(() => [])).find((u) => hexOf(u.transactionId.hash) === payTx);
      if (!utxo) await sleep(5000);
    }
    if (!utxo) throw new Error("The payment settled but its output is not visible at the contract yet.");
  }
  await reconcile(payTx); // the escrow is on chain: let the journal say so (the signer only knows "signed for the facilitator", and a payment answered with HTTP 402 would never be confirmed)
  const ref = `${payTx}#${Number(utxo.index)}`;
  run.ref = ref;
  const policy = policyViewOf(utxo);
  add("ok", `The policy is locked at the contract (${ref.slice(0, 10)}…#${Number(utxo.index)}): ${Number(utxo.assets.lovelace) / 1_000_000} tADA, rule ${policy.cmp === "Below" ? "below" : "at least"} ${policy.threshold / 10 ** policy.scale}${policy.obsSlot >= 0 ? `, observation at most ${policy.obsMaxAgeMs / 1000} s old` : ""}. Nobody holds the money in between.`);

  if (params.mode === "release") {
    add("wait", "Now the seller's keeper (a watcher in the service) should find the policy, fetch the signed answer and release it. Nobody tells it to.");
    let seenSaid = false;
    for (let i = 0; i < 100; i++) {
      await sleep(3000);
      const w = deps.watch();
      const cand = w?.candidates?.find((c) => c.ref === ref);
      if (cand && !seenSaid) {
        add("ok", `The seller's keeper found the policy (${cand.rule ?? "rule"}) and is fetching the signed answer.`);
        seenSaid = true;
      }
      const job = deps.jobs().find((j) => j.ref === ref && j.outcome === "released") as { tx?: string; value?: number } | undefined;
      if (job?.tx) {
        add("ok", `Released with the signed answer (value ${job.value}). 5 tADA goes to the seller; the contract checked the signer, the request, the age and the rule.`, { label: "release transaction", url: scan(job.tx) });
        const confirmed = await waitForTx(job.tx, 120_000);
        add(confirmed ? "ok" : "info", confirmed ? "The release is confirmed in a block." : "The release was sent; the block is not seen yet.");
        return;
      }
    }
    throw new Error("The seller's keeper did not release it within 5 minutes. Check the service log; the buyer can still refund after the deadline.");
  }

  // refund mode
  await sleep(35_000); // a fresh output can be invisible to the node's script evaluation for a little while
  try {
    const from = Date.now() - 60_000;
    await buyer.newTx().collectFrom({ inputs: [utxo], redeemer: refundData() }).attachScript({ script }).addSigner({ keyHash: KeyHash.fromHex(policy.refundToHex) }).setValidity({ from: BigInt(from), to: BigInt(from + 15 * 60_000) }).build();
    add("info", "An early refund was NOT refused. That should not happen.");
  } catch (error) {
    const verdict = classify(error);
    add(verdict.verdict === "REJECTED" ? "refused" : "info", verdict.verdict === "REJECTED" ? "The buyer tries to take the money back before the deadline: the contract refuses (script evaluation failed). Nothing was sent." : `The early refund check could not be completed: ${"detail" in verdict ? verdict.detail : ""}`);
  }
  const wait = policy.deadlineMs + 3_000 - Date.now();
  if (wait > 0) {
    add("wait", `The rule can never hold (its threshold is out of reach), so the only exit is the refund. Waiting ${Math.ceil(wait / 60_000)} more minute(s) for the deadline.`);
    await sleep(wait);
  }
  const fromMs = Math.max(Date.now() - 60_000, policy.deadlineMs + 1_000);
  await waitForTip(fromMs + 2_000);
  const built = await buyer.newTx().collectFrom({ inputs: [utxo], redeemer: refundData() }).attachScript({ script }).addSigner({ keyHash: KeyHash.fromHex(policy.refundToHex) }).setValidity({ from: BigInt(fromMs), to: BigInt(fromMs + 15 * 60_000) }).build();
  const submitted = await submitTracked(built, { source: "demo-run.ts" });
  const refundTx = hexOf(submitted.hash);
  add("ok", "The deadline has passed. The buyer's key refunds the escrow: the contract allows it, and only for this key.", { label: "refund transaction", url: scan(refundTx) });
  const confirmed = await waitForTx(refundTx, 120_000);
  add(confirmed ? "ok" : "info", confirmed ? "The refund is confirmed in a block. The buyer has the money back, minus the network fee." : "The refund was sent; the block is not seen yet.");
};

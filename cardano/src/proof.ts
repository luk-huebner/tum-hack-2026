/**
 * Pieces shared by the keeper, the paid service and the judge page: buying a signed response, checking it against a
 * policy before spending fees, building the release transaction, and reading a validator verdict.
 *
 * The contract stays the only authority. checkAgainst() exists so that nobody pays a fee for a response that cannot
 * pass; the judge page never relies on it for a verdict, only for a hint.
 */
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Address } from "@evolution-sdk/evolution";
import {
  type PolicyView,
  type SignedResponse,
  hexOf,
  lovelace,
  makeClient,
  policyViewOf,
  releaseDataFromResponse,
  script,
  scriptAddress,
  sleep,
  slotsFromData,
} from "./engine.js";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export type Client = ReturnType<typeof makeClient>;
export type Utxo = Awaited<ReturnType<Client["getUtxos"]>>[number];

// ---------------------------------------------------------------------------
// Sources: which signed response to buy

export interface Source {
  spec: string;
  args: string[];
  costAusd: number;
}

export const parseSource = (spec: string): Source => {
  const [kind, ...rest] = spec.split(":");
  const arg = rest.join(":");
  if (kind === "nodary" && /^[A-Za-z0-9~/_-]{1,20}$/.test(arg || "ETH/USD")) return { spec, args: ["nodary-price", arg || "ETH/USD"], costAusd: 0 };
  if (kind === "tweet" && /^\d{1,20}$/.test(arg)) return { spec, args: ["tweet-kpi", arg], costAusd: 0.01 };
  throw new Error(`Unknown source "${spec}". Use nodary:<feed> or tweet:<id>`);
};

/** Fetches (or buys, if not free) one signed response through the paid-call script, which verifies signer and request hash. */
export const fetchSigned = (source: Source): Promise<{ response: SignedResponse; file: string; spentAusd: number }> =>
  new Promise((resolve, reject) => {
    execFile(process.execPath, ["--env-file=.env", "checks/10-paid-call.ts", ...source.args], { cwd: repoRoot, encoding: "utf8", timeout: 60_000 }, (error, _stdout, stderr) => {
      const saved = /saved (\S+\.json)/.exec(stderr)?.[1];
      if (error || !saved) {
        reject(new Error(`fetch failed: ${(stderr || error?.message || "no output").trim().split("\n").slice(-2).join(" | ").slice(0, 200)}`));
        return;
      }
      const file = saved.replace(/^\/(\w:)/, "$1");
      resolve({ response: JSON.parse(readFileSync(file, "utf8")), file, spentAusd: stderr.includes("payment settled") ? source.costAusd : 0 });
    });
  });

// ---------------------------------------------------------------------------
// Policies at the validator

const REF = /^([0-9a-fA-F]{64})#(\d{1,3})$/;

export const parseRef = (ref: string): { txHash: string; index: number } => {
  const match = REF.exec(ref.trim());
  if (!match) throw new Error("A policy reference looks like <64 hex characters>#<output index>");
  return { txHash: match[1].toLowerCase(), index: Number(match[2]) };
};

/** Provider reads drop on a bad connection; try a few times before giving up. */
export const withRetry = async <T>(fn: () => Promise<T>, attempts = 4, onRetry?: (attempt: number, error: unknown) => void): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= attempts) throw error;
      onRetry?.(attempt, error);
      await sleep(3000 * attempt);
    }
  }
};

/** The policy UTxO at the validator address, or undefined when it is spent (or typed wrongly). */
export const findPolicyUtxo = async (client: Client, ref: string): Promise<Utxo | undefined> => {
  const { txHash, index } = parseRef(ref);
  const utxos = await withRetry(() => client.getUtxos(scriptAddress));
  return utxos.find((u) => hexOf(u.transactionId.hash) === txHash && Number(u.index) === index);
};

export { policyViewOf };

// ---------------------------------------------------------------------------
// Checking a response against a policy (a hint, never a verdict)

export interface Check {
  sameRequest: boolean;
  value: number;
  threshold: number;
  scaledValue: number;
  scaledThreshold: number;
  met: boolean;
  signedMs: number;
}

export const checkAgainst = (policy: PolicyView, response: SignedResponse): Check => {
  const slots = slotsFromData(response.data).slice(policy.slotFrom, policy.slotTo);
  const scaledValue = slots.reduce((sum, slot) => sum + Math.round(Number(slot) * 10 ** policy.scale), 0);
  return {
    sameRequest: response.requestHash.replace(/^0x/, "").toLowerCase() === policy.requestHashHex,
    value: scaledValue / 10 ** policy.scale,
    threshold: policy.threshold / 10 ** policy.scale,
    scaledValue,
    scaledThreshold: policy.threshold,
    met: policy.cmp === "AtLeast" ? scaledValue >= policy.threshold : scaledValue < policy.threshold,
    signedMs: Number(response.timestamp) * 1000,
  };
};

// ---------------------------------------------------------------------------
// Release transactions

/**
 * The validity interval for a release that will really be submitted: it starts just after the response was signed and
 * ends before the response gets too old for the policy and before the deadline. The caller waits for the chain tip.
 */
export const submitWindow = (policy: PolicyView, signedMs: number) => ({
  from: signedMs + 2_000,
  to: Math.min(signedMs + policy.maxAgeMs - 20_000, policy.deadlineMs - 1_000),
});

/**
 * The validity interval for an evaluation that is only asked "would the validator accept this?". It starts no earlier than
 * the response was signed (the contract refuses a transaction that starts before the signing time) and ends as late as the
 * policy's age rule allows, so that a fresh response is judged on its merits. A response that is already too old gets a
 * long interval instead, so that the validator itself, and not an empty interval, is what refuses it.
 */
export const evaluationWindow = (policy: PolicyView, signedMs: number, nowMs: number) => {
  const from = Math.max(nowMs - 60_000, signedMs + 2_000);
  const latest = Math.min(signedMs + policy.maxAgeMs - 2_000, policy.deadlineMs - 1_000);
  // Never reach far into the future: the ledger can only convert slots to times within a limited horizon.
  const to = latest - from >= 10_000 ? Math.min(latest, from + 15 * 60_000) : Math.min(from + 15 * 60_000, policy.deadlineMs - 1_000);
  return { from, to };
};

export const releaseTx = (client: Client, utxo: Utxo, policy: PolicyView, response: SignedResponse, window: { from: number; to: number }) =>
  client
    .newTx()
    .collectFrom({ inputs: [utxo], redeemer: releaseDataFromResponse(response) })
    .attachScript({ script })
    // The contract only checks the beneficiary's payment key hash, so an enterprise address (header 0x60) is enough.
    .payToAddress({ address: Address.fromHex(`60${policy.beneficiaryHex}`), assets: lovelace(policy.payout) })
    .setValidity({ from: BigInt(window.from), to: BigInt(window.to) })
    .build();

// ---------------------------------------------------------------------------
// Verdicts

export type Verdict =
  | { verdict: "ACCEPTED" }
  | { verdict: "REJECTED"; detail: string }
  | { verdict: "EXPIRED"; detail: string }
  | { verdict: "ERROR"; detail: string };

const messagesOf = (error: unknown): string[] => {
  const out: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 8; depth++) {
    const message = (current as { message?: unknown }).message;
    if (typeof message === "string") out.push(message);
    current = (current as { cause?: unknown }).cause;
  }
  return out;
};

/**
 * Tells a refusal by the validator apart from a failure to ask. A dropped connection or a missing provider key must never
 * be reported as "the contract rejected it" (a keeper run once labelled a confirmed release as rejected for that reason).
 */
export const classify = (error: unknown): Verdict => {
  const messages = messagesOf(error);
  const text = messages.join(" | ");
  const network = /fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|timed? ?out|\b5\d\d\b|rate limit|\b40[13]\b|ProviderError: Blockfrost (getUtxos|submit)/i.test(text);
  if (/script evaluation failed/i.test(text) && !network) {
    return { verdict: "REJECTED", detail: "The validator ran on this response and refused it (script evaluation failed)." };
  }
  return { verdict: "ERROR", detail: `Could not get a verdict: ${(messages[0] ?? String(error)).replace(/\s+/g, " ").slice(0, 160)}` };
};

/** Builds the release (and so runs the validator through the provider's evaluation) without sending anything. */
export const evaluateRelease = async (client: Client, utxo: Utxo, policy: PolicyView, response: SignedResponse, nowMs = Date.now()): Promise<Verdict> => {
  const window = evaluationWindow(policy, Number(response.timestamp) * 1000, nowMs);
  if (window.to <= window.from) {
    return { verdict: "EXPIRED", detail: "The policy's deadline has passed, so there is nothing to release. Nothing was sent to the validator." };
  }
  try {
    await releaseTx(client, utxo, policy, response, window);
    return { verdict: "ACCEPTED" };
  } catch (error) {
    return classify(error);
  }
};

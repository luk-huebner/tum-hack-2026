/**
 * Pay-on-Proof as tools for an AI agent (Model Context Protocol over stdio).
 *
 * An agent can read what is locked at the contract, preview a conditional payment ("pay the seller if this post reaches N likes,
 * refund me otherwise"), ask the validator for a verdict on a signed response, and, only if the operator allows it, lock a real
 * testnet escrow by x402 and refund it. Reading, previewing and judging need no key at all. Spending is OFF unless the process
 * runs with MCP_ALLOW_SPEND=1, and then each call needs `confirm: true`, an escrow is always 5 tADA, and at most 3 can be locked
 * per session.
 *
 *   node node_modules/tsx/dist/cli.mjs src/mcp-server.ts        (see MCP.md for a Claude Desktop configuration)
 *
 * The protocol is spoken directly (newline-delimited JSON-RPC 2.0: initialize, tools/list, tools/call, ping), so there is no
 * extra dependency. Everything is written to stdout as protocol messages only; diagnostics go to stderr.
 */
import { execFile } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

// The service and the scripts read .env from the working directory, whoever started this process.
const cardanoDir = fileURLToPath(new URL("../", import.meta.url));
process.chdir(cardanoDir);

const run = promisify(execFile);
const { Client, preprod } = await import("@evolution-sdk/evolution");
const { loadVector, scriptHash } = await import("./engine.js");
const { boardRows } = await import("./judge-routes.js");
const { allSpecs, registeredSources, TEMPLATE_IDS } = await import("./templates.js");
const { ESCROW_LOVELACE, describeOffer, offerPolicy, parseOffer } = await import("./escrow.js");
const { evaluateRelease, findPolicyUtxo, parseRef, policyViewOf } = await import("./proof.js");
type ProofClient = import("./proof.js").Client;

const ALLOW_SPEND = process.env.MCP_ALLOW_SPEND === "1";
const MAX_ESCROWS = 3;
let locked = 0;

const need = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (cardano/.env)`);
  return value;
};

// An address-only client: it reads the chain and asks the node to evaluate a transaction, and cannot sign anything.
let reader: ProofClient | undefined;
const readOnly = (): ProofClient =>
  (reader ??= Client.make(preprod)
    .withBlockfrost({ baseUrl: process.env.BLOCKFROST_BASE_URL ?? "https://cardano-preprod.blockfrost.io/api/v0", projectId: need("BLOCKFROST_PROJECT_ID") })
    .withAddress(need("SELLER_ADDRESS")) as unknown as ProofClient);

const tsx = (script: string, args: string[]) =>
  run(process.execPath, ["node_modules/tsx/dist/cli.mjs", script, ...args], { cwd: cardanoDir, timeout: 420_000, maxBuffer: 16 * 1024 * 1024 });

const text = (value: unknown) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const failure = (message: string) => ({ isError: true, content: [{ type: "text", text: message }] });

const offerSchema = {
  template: { type: "string", enum: [...TEMPLATE_IDS], description: 'What to wait for. "source" is any registered source (see list_sources); "tweet-likes" a registered tweet; "rain-below" Munich rainfall; "eth-usd" a free price feed that exists only to test the machinery.' },
  sourceId: { type: "string", description: 'For template "source": the id from list_sources.' },
  tweetId: { type: "string", description: 'For template "tweet-likes": a registered tweet id.' },
  atLeast: { type: "number", description: 'The threshold for a rule "at least" (likes, views, a price).' },
  below: { type: "number", description: 'The threshold for a rule "below" (rainfall in mm).' },
  minutes: { type: "number", description: "The deadline in minutes from now (5 to 4320). If the rule has not held by then, the buyer can take the money back." },
  refund: { type: "string", description: "The buyer's preprod address (addr_test1...) that gets the money back. Defaults to BUYER_ADDRESS in the environment." },
};

const buildOffer = (args: Record<string, unknown>) => {
  const refund = typeof args.refund === "string" && args.refund ? args.refund : need("BUYER_ADDRESS");
  const minutes = Number(args.minutes ?? 30);
  return parseOffer({ ...args, refund, deadlineMs: Date.now() + minutes * 60_000 }, Date.now());
};

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<ReturnType<typeof text>>;
}

const tools: Tool[] = [
  {
    name: "list_sources",
    description:
      "List what a conditional payment can wait for: the fixed templates and every registered AirnodeHub source, with the kind of data (static: checked once; counter: moves, so it is watched; feed: a price) and what one check costs in aUSD. Free; reads local files only.",
    inputSchema: { type: "object", properties: {} },
    handler: async () =>
      text({
        validator: scriptHash,
        network: "Cardano preprod (testnet)",
        escrow: `${Number(ESCROW_LOVELACE) / 1_000_000} tADA per escrow`,
        templates: TEMPLATE_IDS,
        sources: registeredSources().map((r) => ({ id: r.id, rule: `${r.label} ${r.cmp === "Below" ? "below" : "at least"} N`, kind: r.kind, costPerCheckAusd: r.costAusd })),
        specs: allSpecs().map((s) => ({ id: s.id, template: s.template, kind: s.kind, costPerCheckAusd: s.costAusd, testFixture: s.fixture === true })),
      }),
  },
  {
    name: "list_escrows",
    description: "List what is locked at the Pay-on-Proof contract right now (preprod): each escrow's rule in words, amount, deadline, time left and whether it can be refunded. Read-only, no key needed.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => text(await boardRows(readOnly())),
  },
  {
    name: "check_escrow",
    description: 'Look up one escrow by its reference ("<64 hex characters>#<output index>", the payment transaction hash and index). Says whether it is still locked or already paid out or refunded, what rule it waits for, and how long it has. Read-only.',
    inputSchema: { type: "object", properties: { ref: { type: "string", description: "Policy reference, for example 8c9ac1de...5427#0" } }, required: ["ref"] },
    handler: async (args) => {
      const ref = String(args.ref ?? "");
      parseRef(ref);
      const utxo = await findPolicyUtxo(readOnly(), ref);
      if (!utxo) return text({ ref, status: "not locked at the contract: already released or refunded, or not visible yet" });
      const p = policyViewOf(utxo);
      const spec = allSpecs().find((s) => loadVector(s.vectorName).requestHashHex === p.requestHashHex);
      const left = Math.round((p.deadlineMs - Date.now()) / 60_000);
      return text({
        ref,
        status: left < 0 ? "locked; the deadline has passed, so the buyer can refund it" : "locked and waiting for its rule",
        lockedTada: Number(utxo.assets.lovelace) / 1_000_000,
        rule: spec ? spec.describe(p.threshold / 10 ** p.scale) : `a request this server does not know (${p.requestHashHex.slice(0, 8)}...)`,
        deadline: new Date(p.deadlineMs).toISOString(),
        minutesLeft: left,
        responseMaxAgeSeconds: p.maxAgeMs / 1000,
        payoutTada: Number(p.payout) / 1_000_000,
        signer: `0x${p.signerHex}`,
        requestHash: `0x${p.requestHashHex}`,
      });
    },
  },
  {
    name: "preview_escrow",
    description:
      "Describe a conditional payment without paying anything: the rule in words, the amount, the deadline, who gets the money back and the size of the datum that the contract will hold. Use it to show the buyer exactly what they would be signing.",
    inputSchema: { type: "object", properties: offerSchema, required: ["template"] },
    handler: async (args) => {
      const offer = buildOffer(args);
      const policy = offerPolicy(offer);
      return text({
        rule: describeOffer(offer),
        pays: `${Number(ESCROW_LOVELACE) / 1_000_000} tADA to the seller when the rule is proven by a signed response at most ${policy.maxAgeMs / 1000} s old`,
        otherwise: `the buyer (${offer.refund.slice(0, 20)}...) can take it back after ${new Date(offer.deadlineMs).toISOString()}`,
        validator: scriptHash,
        nothingPaid: true,
      });
    },
  },
  {
    name: "judge_response",
    description:
      "Ask the validator itself whether a signed AirnodeHub response would release a given escrow: the node runs the contract on an unsigned release transaction and answers ACCEPTED or REJECTED. Nothing is ever sent to the chain. This is the tamper test: edit one value and it is rejected.",
    inputSchema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "Policy reference of an open escrow" },
        response: { type: "object", description: "The signed response: { airnode, requestHash, timestamp, data, signature }", properties: { airnode: { type: "string" }, requestHash: { type: "string" }, timestamp: { type: "string" }, data: { type: "string" }, signature: { type: "string" } } },
      },
      required: ["ref", "response"],
    },
    handler: async (args) => {
      const ref = String(args.ref ?? "");
      parseRef(ref);
      const r = (args.response ?? {}) as Record<string, unknown>;
      const response = { airnode: String(r.airnode ?? ""), requestHash: String(r.requestHash ?? ""), timestamp: String(r.timestamp ?? ""), data: String(r.data ?? ""), signature: String(r.signature ?? "") };
      if (!/^\d{9,12}$/.test(response.timestamp) || response.data.length > 8000) throw new Error("timestamp must be unix seconds and data at most 8000 characters");
      const client = readOnly();
      const utxo = await findPolicyUtxo(client, ref);
      if (!utxo) throw new Error("No such policy at the validator (spent, or a typo)");
      return text({ ...(await evaluateRelease(client, utxo, policyViewOf(utxo), response)), sentToChain: false });
    },
  },
  {
    name: "lock_escrow",
    description:
      "SPENDS 5 testnet tADA: pays by x402 into the contract so that the money is released to the seller when the rule is proven and can be refunded to the buyer after the deadline. Only works when the operator started this server with MCP_ALLOW_SPEND=1 and the Pay-on-Proof service is running; requires confirm: true. Preview it first with preview_escrow.",
    inputSchema: { type: "object", properties: { ...offerSchema, confirm: { type: "boolean", description: "Must be true: the buyer has seen the preview and agrees to lock 5 tADA." } }, required: ["template", "confirm"] },
    handler: async (args) => {
      if (!ALLOW_SPEND) return failure("Spending is off. The operator must start this server with MCP_ALLOW_SPEND=1. Use preview_escrow to show what it would do.");
      if (args.confirm !== true) return failure("confirm must be true, after the buyer has seen preview_escrow.");
      if (locked >= MAX_ESCROWS) return failure(`This session already locked ${MAX_ESCROWS} escrows, the limit.`);
      const offer = buildOffer(args); // validates everything before any money moves
      const cli = ["--template", offer.template, "--minutes", String(Math.round((offer.deadlineMs - Date.now()) / 60_000))];
      if (offer.tweetId) cli.push("--tweet", offer.tweetId);
      if (offer.sourceId) cli.push("--source", offer.sourceId);
      cli.push(args.below !== undefined ? "--below" : "--at-least", String(args.below ?? args.atLeast));
      if (typeof args.refund === "string" && args.refund) cli.push("--refund", args.refund);
      locked += 1;
      try {
        const { stdout } = await tsx("src/escrow-client.ts", cli);
        return text(stdout.split("\n").slice(-12).join("\n"));
      } catch (error) {
        locked -= 1;
        return failure(`The payment did not go through: ${String((error as { stdout?: string; message: string }).stdout ?? (error as Error).message).split("\n").slice(-6).join(" | ").slice(0, 400)}. If a payment may have settled, look for the escrow with list_escrows before trying again.`);
      }
    },
  },
  {
    name: "refund_escrow",
    description: "SPENDS a small network fee: takes an escrow back to the buyer after its deadline has passed (the contract refuses it earlier). Only with MCP_ALLOW_SPEND=1 and confirm: true; the operator's wallet must be the escrow's refund party.",
    inputSchema: { type: "object", properties: { ref: { type: "string" }, confirm: { type: "boolean" } }, required: ["ref", "confirm"] },
    handler: async (args) => {
      if (!ALLOW_SPEND) return failure("Spending is off. The operator must start this server with MCP_ALLOW_SPEND=1.");
      if (args.confirm !== true) return failure("confirm must be true.");
      const ref = String(args.ref ?? "");
      parseRef(ref);
      try {
        const { stdout } = await tsx("src/refund.ts", ["--utxo", ref, "--submit"]);
        return text(stdout.split("\n").slice(-6).join("\n"));
      } catch (error) {
        return failure(String((error as { stderr?: string; message: string }).stderr ?? (error as Error).message).split("\n").filter(Boolean).slice(-3).join(" | ").slice(0, 400));
      }
    },
  },
];

// ---------------------------------------------------------------------------
// The protocol

const send = (message: unknown) => process.stdout.write(`${JSON.stringify(message)}\n`);
const reply = (id: unknown, result: unknown) => send({ jsonrpc: "2.0", id, result });
const replyError = (id: unknown, code: number, message: string) => send({ jsonrpc: "2.0", id, error: { code, message } });

const handle = async (message: { id?: unknown; method?: string; params?: Record<string, unknown> }) => {
  const { id, method, params } = message;
  if (method === undefined) return; // a response to something we never asked
  if (id === undefined) return; // a notification such as notifications/initialized
  try {
    if (method === "initialize") {
      const wanted = String(params?.protocolVersion ?? "2024-11-05");
      return reply(id, {
        protocolVersion: ["2024-11-05", "2025-03-26", "2025-06-18"].includes(wanted) ? wanted : "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "pay-on-proof", version: "0.1.0" },
        instructions: `Pay-on-Proof on Cardano preprod (testnet). A contract holds a payment and releases it to the seller only when a signed AirnodeHub response proves a condition agreed in advance; otherwise the buyer is refunded after the deadline. Start with list_sources, then preview_escrow. Spending is ${ALLOW_SPEND ? "ON (confirm: true required)" : "OFF"}.`,
      });
    }
    if (method === "ping") return reply(id, {});
    if (method === "tools/list") return reply(id, { tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    if (method === "tools/call") {
      const tool = tools.find((t) => t.name === params?.name);
      if (!tool) return replyError(id, -32602, `Unknown tool ${String(params?.name)}`);
      try {
        return reply(id, await tool.handler((params?.arguments ?? {}) as Record<string, unknown>));
      } catch (error) {
        return reply(id, failure(String((error as Error).message).slice(0, 500)));
      }
    }
    return replyError(id, -32601, `Method not found: ${method}`);
  } catch (error) {
    return replyError(id, -32603, String((error as Error).message).slice(0, 300));
  }
};

const lines = createInterface({ input: process.stdin });
lines.on("line", (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return replyError(null, -32700, "Parse error");
  }
  void handle(message);
});
lines.on("close", () => process.exit(0));
console.error(`pay-on-proof MCP server ready (validator ${scriptHash.slice(0, 8)}..., spending ${ALLOW_SPEND ? "ON" : "off"}, ${tools.length} tools)`);

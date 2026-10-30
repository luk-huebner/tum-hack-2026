// A minimal MCP client: starts the server over stdio and exercises it the way an agent host would.
//   node scripts/mcp-test.mjs
// Nothing is paid: spending stays off (no MCP_ALLOW_SPEND), and the two spending tools must refuse.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const cardano = fileURLToPath(new URL("..", import.meta.url));
const server = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "src/mcp-server.ts"], { cwd: cardano, env: { ...process.env, MCP_ALLOW_SPEND: "" }, stdio: ["pipe", "pipe", "inherit"] });

const pending = new Map();
let nextId = 1;
let stdoutNoise = 0;
createInterface({ input: server.stdout }).on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    stdoutNoise += 1; // anything on stdout that is not a protocol message would break a real host
    console.error("NOT JSON ON STDOUT:", line.slice(0, 120));
    return;
  }
  pending.get(message.id)?.(message);
});
const call = (method, params) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => reject(new Error(`timeout on ${method}`)), 90_000);
    pending.set(id, (m) => (clearTimeout(timer), resolve(m)));
    server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
const tool = async (name, args) => {
  const r = await call("tools/call", { name, arguments: args });
  return { error: r.error, isError: r.result?.isError === true, text: r.result?.content?.[0]?.text ?? "" };
};

// a public testnet address (the team's demo buyer), used only as the refund party of a preview
const BUYER = "addr_test1qqf6wl8rev5q2zwslk95eqz0tgymshadz26gs70ygr593jwkmysa3xpenqsmsw29qwe6zpqkdqt7mu5wlx8ln8crz9csuqjxxp";
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
};

const init = await call("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "mcp-test", version: "1" } });
check("initialize", init.result?.serverInfo?.name === "pay-on-proof", init.result?.protocolVersion);
server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
const list = await call("tools/list", {});
const names = (list.result?.tools ?? []).map((t) => t.name);
check("tools/list", names.length === 7, names.join(", "));

const sources = await tool("list_sources", {});
check("list_sources shows registered sources", sources.text.includes("meme-tweet-likes") && sources.text.includes("yt-views-brian-cohen"));

const preview = await tool("preview_escrow", { template: "source", sourceId: "meme-tweet-likes", atLeast: 5, minutes: 30, refund: BUYER });
check("preview_escrow describes the rule and pays nothing", preview.text.includes("at least 5") && preview.text.includes("nothingPaid"), preview.isError ? preview.text.slice(0, 120) : "");

const bad = await tool("preview_escrow", { template: "source", sourceId: "does-not-exist", atLeast: 5, refund: BUYER });
check("an unknown source is refused", bad.isError);

const board = await tool("list_escrows", {});
check("list_escrows reads the chain", !board.isError && board.text.startsWith("["), board.isError ? board.text.slice(0, 120) : `${JSON.parse(board.text).length} escrows`);

const spent = await tool("check_escrow", { ref: "8c9ac1de176e74b90c0d43b68c2c972e7c93075166b9f1364997f3a7e4a05427#0" });
check("check_escrow knows a released escrow is gone", spent.text.includes("not locked"));

const bench = JSON.parse(readFileSync(new URL("../vectors/tamper/valid.json", import.meta.url), "utf8"));
const standing = JSON.parse(readFileSync(new URL("../standing-policies.json", import.meta.url), "utf8"));
const refBench = standing.find((s) => s.name === "bench-48h").ref;
const ok = await tool("judge_response", { ref: refBench, response: bench });
check("judge_response: the real response is ACCEPTED", ok.text.includes("ACCEPTED"), ok.text.replace(/\s+/g, " ").slice(0, 60));
const edited = await tool("judge_response", { ref: refBench, response: { ...bench, data: bench.data.replace(/(?<=:)\d/, (d) => String((Number(d) + 1) % 10)) } });
check("judge_response: an edited value is REJECTED", edited.text.includes("REJECTED"), edited.text.replace(/\s+/g, " ").slice(0, 60));

const lock = await tool("lock_escrow", { template: "source", sourceId: "meme-tweet-likes", atLeast: 1, confirm: true });
check("lock_escrow refuses while spending is off", lock.isError && lock.text.includes("Spending is off"));
const refund = await tool("refund_escrow", { ref: refBench, confirm: true });
check("refund_escrow refuses while spending is off", refund.isError && refund.text.includes("Spending is off"));

const unknown = await call("tools/call", { name: "nope", arguments: {} });
check("an unknown tool is a protocol error", unknown.error?.code === -32602);
const ping = await call("ping", {});
check("ping", ping.result !== undefined);
check("nothing but protocol messages on stdout", stdoutNoise === 0);

server.kill();
console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);


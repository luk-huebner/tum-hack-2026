/**
 * Register ANY AirnodeHub request as a source the contract can wait for: "any API in your contract", one command per API.
 *
 *   tsx src/register-source.ts --spec specs/example.json            buys one signed response (one fetch, its listed price)
 *   tsx src/register-source.ts --spec specs/example.json --dry      only the price and the request hash, nothing is paid
 *   tsx src/register-source.ts --spec specs/example.json --twice    a second fetch to prove the fixed text does not change
 *   tsx src/register-source.ts --spec specs/example.json --from checks/out/<saved>.json   register from a response already bought
 *
 * The spec file: { id, label, slug, request: { operation, parameters, responseProjection? }, use: ["likes"], cmp: "AtLeast" | "Below",
 * kind: "static" | "counter" | "feed", scale?, max? }. `use` names the fields to sum (they must be next to each other in the signed
 * text); `label` completes the sentence "<label> at least N".
 *
 * What it does: the contract rebuilds the signed text from fixed pieces and the numbers between them, so one real response is cut
 * into prefix, separators, suffix and number slots. This checks that the response fits that shape (numbers after a colon, fixed
 * text of a sensible size and plain), writes the vector (vectors/src-<id>.json) and the entry in vectors/sources.json. After that
 * the escrow route can offer it (template "source", sourceId), the keeper can prove it and the board can read it.
 * Testnet only; the payer key stays in .env (PAYER_PRIVATE_KEY) and is never printed.
 */
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import { type RegisteredSource, registeredSources } from "./templates.js";

const run = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const cardanoDir = fileURLToPath(new URL("../", import.meta.url));

const { values } = parseArgs({
  options: { spec: { type: "string" }, dry: { type: "boolean", default: false }, twice: { type: "boolean", default: false }, from: { type: "string" } },
});
if (!values.spec) {
  console.error("Usage: tsx src/register-source.ts --spec <file.json> [--dry] [--twice] [--from <saved response>]");
  process.exit(2);
}

interface Spec {
  id: string;
  label: string;
  slug: string;
  request: RegisteredSource["request"];
  use: string[];
  cmp: "AtLeast" | "Below";
  kind: "static" | "counter" | "feed";
  scale?: number;
  max?: number;
}
const spec: Spec = JSON.parse(readFileSync(values.spec, "utf8"));
const fail = (message: string): never => {
  console.error(`NOT REGISTERED: ${message}`);
  process.exit(1);
};

if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(spec.id ?? "")) fail("id must be lower case letters, digits and dashes (2 to 41 characters)");
if (!spec.label || spec.label.length > 100) fail("label is required (at most 100 characters)");
if (!/^[a-z0-9-]+$/.test(spec.slug ?? "")) fail("slug must be an AirnodeHub listing name such as lunarcrush");
if (!spec.request?.operation || !Array.isArray(spec.use) || spec.use.length === 0) fail("request.operation and use are required");
if (!["AtLeast", "Below"].includes(spec.cmp)) fail('cmp must be "AtLeast" or "Below"');
if (!["static", "counter", "feed"].includes(spec.kind)) fail('kind must be "static", "counter" or "feed"');

const url = `https://airnode-${spec.slug}.fly.dev/`;

/** The price the listing asks for this request, read from its 402 answer. Nothing is paid. */
const price = async (): Promise<number> => {
  const probe = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(spec.request) });
  if (probe.status === 200) return 0;
  if (probe.status !== 402) fail(`the listing answered HTTP ${probe.status} to this request (${(await probe.text()).slice(0, 160)})`);
  const requirements = JSON.parse(Buffer.from(probe.headers.get("payment-required") ?? "", "base64").toString() || "{}");
  return Number(requirements.accepts?.[0]?.amount ?? NaN) / 1e6;
};

/** One paid, verified fetch through checks/10-paid-call.ts; returns the saved response. */
const buy = async (): Promise<SavedResponse> => {
  mkdirSync(join(tmpdir(), "pay-on-proof"), { recursive: true });
  const requestFile = join(tmpdir(), "pay-on-proof", `request-${spec.id}.json`);
  writeFileSync(requestFile, JSON.stringify({ slug: spec.slug, request: spec.request }));
  try {
    const { stderr } = await run(process.execPath, ["--env-file=.env", "checks/10-paid-call.ts", "request-file", requestFile], { cwd: repoRoot, timeout: 90_000, maxBuffer: 64 * 1024 * 1024 });
    const saved = /saved (\S+\.json)/.exec(stderr)?.[1];
    if (!saved || !stderr.includes("signature OK")) return fail(`the paid call did not verify: ${stderr.trim().split("\n").slice(-2).join(" | ").slice(0, 200)}`);
    return JSON.parse(readFileSync(saved.replace(/^\/(\w:)/, "$1"), "utf8"));
  } catch (error) {
    return fail(`the paid call failed: ${String((error as { stderr?: string; message: string }).stderr ?? (error as Error).message).split("\n").slice(-3).join(" | ").slice(0, 240)}`);
  }
};

interface SavedResponse {
  request: unknown;
  requestHash: string;
  airnode: string;
  timestamp: string;
  signature: string;
  data: string;
}

/** The numbers the contract can read: a number right after a colon and before a comma or the closing brace (as in build-vector). */
const slotRegex = () => /(?<=:)-?\d+(?:\.\d+)?(?=[,}])/g;

/** Names for the slots, from the JSON keys in the order the numbers appear. Falls back to slot0, slot1, ... when they do not line up. */
const slotNamesOf = (data: string, slots: string[]): string[] => {
  const names: string[] = [];
  const walk = (value: unknown, path: string[]) => {
    if (Array.isArray(value)) return; // the contract only reads members of objects
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (typeof v === "number") names.push([...path, k].join("."));
        else walk(v, [...path, k]);
      }
    }
  };
  try {
    walk(JSON.parse(data), []);
  } catch {
    return slots.map((_, i) => `slot${i}`);
  }
  return names.length === slots.length ? names : slots.map((_, i) => `slot${i}`);
};

const cut = (data: string) => {
  const matches = [...data.matchAll(slotRegex())];
  const slots = matches.map((m) => m[0]);
  const prefix = matches.length ? data.slice(0, matches[0].index) : data;
  const separators = matches.slice(1).map((m, i) => data.slice(matches[i].index! + matches[i][0].length, m.index));
  const last = matches[matches.length - 1];
  const suffix = last ? data.slice(last.index! + last[0].length) : "";
  return { slots, prefix, separators, suffix };
};

const main = async () => {
  mkdirSync(join(tmpdir(), "pay-on-proof"), { recursive: true });
  const cost = await price();
  const hash = await import("../../lib/airnode-v2.ts" as string).then((m: { deriveRequestHash: (r: unknown) => string }) => m.deriveRequestHash(spec.request)).catch(() => "(derived when paid)");
  console.log(`source ${spec.id}: ${url}\n  request hash ${hash}\n  price ${cost} aUSD per fetch${spec.request.responseProjection ? "" : "\n  note: no responseProjection, so the signed text includes every field the listing returns"}`);
  if (values.dry) {
    console.log("dry run: nothing was paid and nothing was written.");
    return;
  }

  let first: SavedResponse;
  if (values.from) first = JSON.parse(readFileSync(values.from, "utf8"));
  else first = await buy();
  const a = cut(first.data);
  if (a.slots.length === 0) fail(`the signed text has no number after a colon, so there is nothing for the rule to read: ${first.data.slice(0, 160)}`);

  const names = slotNamesOf(first.data, a.slots);
  const indices = spec.use.map((n) => names.indexOf(n));
  if (indices.some((i) => i < 0)) fail(`"use" must name fields of the signed text. Available: ${names.join(", ")}`);
  const slotFrom = Math.min(...indices);
  const slotTo = Math.max(...indices) + 1;
  if (slotTo - slotFrom !== indices.length) fail(`the fields to sum must be next to each other in the signed text (order: ${names.join(", ")})`);

  const fixedBytes = Buffer.byteLength(a.prefix + a.separators.join("") + a.suffix, "utf8");
  if (fixedBytes > 4000) fail(`the fixed text is ${fixedBytes} bytes: too large to put in a datum. Use a responseProjection to ask only for the numbers and an id`);
  const warnings: string[] = [];
  if (fixedBytes > 1200) warnings.push(`the fixed text is ${fixedBytes} bytes (large datum, larger fee)`);
  if (/[^\x20-\x7e]/.test(a.prefix + a.separators.join("") + a.suffix)) warnings.push("the fixed text has non-ASCII characters (a creator editing a title would break every policy)");
  if (!spec.request.responseProjection) warnings.push("no responseProjection: text fields in the response can change and break the policy");

  if (values.twice && !values.from) {
    const second = await buy();
    const b = cut(second.data);
    const same = a.prefix === b.prefix && a.suffix === b.suffix && JSON.stringify(a.separators) === JSON.stringify(b.separators) && a.slots.length === b.slots.length;
    if (!same) fail("the fixed text differs between two fetches, so a policy built from one would not match the next: " + JSON.stringify({ a: a.prefix.slice(0, 60), b: b.prefix.slice(0, 60) }));
    console.log("  second fetch: the fixed text is identical");
  }

  // The vector (public data: a signed response and the key that signed it), cut by the same script the contract tests use
  const vectorName = `src-${spec.id}`;
  const savedPath = join(tmpdir(), "pay-on-proof", `response-${spec.id}.json`);
  writeFileSync(savedPath, JSON.stringify(first));
  await run(process.execPath, ["checks/05-make-vector.mjs", savedPath, vectorName, "--json-only"], { cwd: repoRoot }).catch((e) => fail(`could not cut the vector: ${String(e.stderr ?? e.message).slice(0, 200)}`));

  const entry: RegisteredSource = {
    id: spec.id,
    label: spec.label,
    slug: spec.slug,
    request: spec.request,
    vectorName,
    slotFrom,
    slotTo,
    slotNames: names,
    scale: spec.scale ?? 0,
    cmp: spec.cmp,
    kind: spec.kind,
    costAusd: cost,
    max: spec.max ?? (spec.scale ? 1_000_000 : 2_000_000_000),
    registeredAt: new Date().toISOString(),
  };
  const file = join(cardanoDir, "vectors", "sources.json");
  const list = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as RegisteredSource[]) : registeredSources();
  const next = [...list.filter((r) => r.id !== entry.id), entry];
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);

  console.log(`REGISTERED ${spec.id}`);
  console.log(`  signed text   ${first.data.length > 120 ? `${first.data.slice(0, 120)}...` : first.data}`);
  console.log(`  slots         ${names.map((n, i) => `${i}=${n}(${a.slots[i]})`).join("  ")}`);
  console.log(`  the rule sums slot ${slotFrom}${slotTo - slotFrom > 1 ? ` to ${slotTo - 1}` : ""} (${spec.use.join(" + ")}) and reads: "${entry.label} ${spec.cmp === "Below" ? "below" : "at least"} N"`);
  console.log(`  fixed text    ${fixedBytes} bytes; vector vectors/${vectorName}.json; entry in vectors/sources.json`);
  for (const w of warnings) console.log(`  WARNING: ${w}`);
};

await main();
process.exit(0);

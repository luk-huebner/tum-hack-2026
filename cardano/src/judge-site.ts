/**
 * The public judge site: the tamper bench and the live board, and nothing else. It is built to run on a host that anyone can
 * reach (see scripts/bundle-judge-site.mjs and HOSTING.md), so it has NO keys at all:
 *
 *   - no seed phrase, no payment key, no aUSD key; the client below is address-only and cannot sign;
 *   - it never sends a transaction: a verdict is the node's script evaluation of an unsigned release transaction;
 *   - the paid routes (/api/keep, /api/escrow), the watcher and the live runs are not part of it.
 *
 * Environment: BLOCKFROST_PROJECT_ID (a free preprod key) and SELLER_ADDRESS (a public preprod address; the evaluation takes
 * its fee and collateral inputs from that address, and only reads them).
 */
import express from "express";
import { Client, preprod } from "@evolution-sdk/evolution";
import { scriptHash } from "./engine.js";
import { judgeRoutes } from "./judge-routes.js";
import type { Client as SigningClient } from "./proof.js";

const need = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} in the host's environment`);
  return value;
};

const baseUrl = process.env.BLOCKFROST_BASE_URL ?? "https://cardano-preprod.blockfrost.io/api/v0";
let client: SigningClient | undefined;
// An address-only client builds and evaluates transactions but cannot sign. The routes only use those two abilities.
const readOnly = (): SigningClient =>
  (client ??= Client.make(preprod)
    .withBlockfrost({ baseUrl, projectId: need("BLOCKFROST_PROJECT_ID") })
    .withAddress(need("SELLER_ADDRESS")) as unknown as SigningClient);

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true); // behind the host's proxy, so the rate limit sees the visitor, not the proxy
app.use(express.json({ limit: "64kb" }));

app.use(judgeRoutes(readOnly));

app.get("/api/info", (_req, res) => {
  res.json({
    network: "Cardano preprod",
    validatorHash: scriptHash,
    validatorAddress: `70${scriptHash}`,
    demoBuyer: false,
    publicJudgeSite: true,
    note: "Verdicts only: nothing here sends a transaction or holds a key. The paid routes run on the team's own machine.",
  });
});
app.get("/api/watch", (_req, res) => void res.json({ enabled: false, note: "The seller's keeper does not run on the public site." }));
app.get("/api/jobs", (_req, res) => void res.json([]));
app.get("/health", (_req, res) => void res.json({ ok: true }));

if (process.env.SERVE_STATIC) app.use(express.static(process.env.SERVE_STATIC)); // local testing only; the host serves public/ itself

export default app;

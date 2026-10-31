import { Transaction } from "@evolution-sdk/evolution";
import { reconcile, trackExternal } from "./tx-tracking.js";
/**
 * Creator Pay campaigns for the web app: the brand's terms, the creator's post and the escrows that pay the creator.
 *
 *   POST /api/cp/campaigns              the brand states the terms: the creator, the disclosure rule, the milestones, the window.
 *                                       Nothing is paid; the escrows can only be locked once the post exists (its id is pinned).
 *   POST /api/cp/campaigns/:id/submit   the creator hands over the post link and a payout address. The service buys one signed
 *                                       look (0.01 aUSD), checks the post against the terms, registers it as a source (one more
 *                                       fetch) and pays one 5 tADA escrow per milestone by x402 from the brand's wallet (MNEMONIC),
 *                                       straight into the validator, with the creator as payee and the brand as refund party.
 *   GET  /api/cp/campaigns[/:id]        the terms, each step, the latest signed like count the keeper saw and each escrow's state.
 *
 * The seller's keeper (autorelease.ts) releases each escrow when a fresh signed count proves its milestone; the contract pays the
 * creator whoever submits. Submitting spends test funds, so it only runs with CREATORPAY_LIVE=1 and the keeper on.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Router, type Request, type Response } from "express";
import { Address } from "@evolution-sdk/evolution";
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { toClientCardanoSigner } from "@x402/cardano";
import { ExactCardanoScheme } from "@x402/cardano/exact/client";
import { hexOf, loadVector, makeClient, policyViewOf, scriptAddress, scriptHash, sleep } from "./engine.js";
import { ESCROW_LOVELACE, checkRequirement, parseOffer, validatorAddressBech32 } from "./escrow.js";
import { DEFAULT_DISCLOSURE, buyLook, creatorSpec, reviewPost, tweetIdOf, type PostFacts, type SavedLook } from "./intake.js";
import { findByDatum, withRetry } from "./proof.js";
import type { WatchStatus } from "./autorelease.js";
import type { Step } from "./demo-run.js";

const run = promisify(execFile);
const cardanoDir = fileURLToPath(new URL("../", import.meta.url));
const storeFile = new URL("../out/campaigns.json", import.meta.url);
const scan = (hash: string) => `https://preprod.cardanoscan.io/transaction/${hash}`;

const LIVE = process.env.CREATORPAY_LIVE === "1";
const MAX_SUBMISSIONS = Number(process.env.CREATORPAY_MAX_SUBMISSIONS ?? "8"); // for the life of this process
const MAX_MILESTONES = 3;

export interface Milestone {
  likes: number;
  label?: string;
}

export interface Escrow {
  milestone: number;
  threshold: number;
  state: "pending" | "locking" | "locked" | "released" | "failed";
  ref?: string;
  payTx?: string;
  releaseTx?: string;
  releasedAt?: string;
  releasedValue?: number;
  error?: string;
}

export interface Campaign {
  id: string;
  createdAt: string;
  brand: string;
  title: string;
  brief: string;
  creator: string;
  disclosure: string[];
  milestones: Milestone[];
  likesMode: "increase" | "absolute";
  durationMinutes: number;
  measureLastMinutes?: number;
  maxPostAgeHours: number;
  status: "open" | "checking" | "locking" | "live" | "refused" | "failed";
  steps: Step[];
  submission?: {
    postUrl: string;
    payee: string;
    post: PostFacts;
    checks: { label: string; ok: boolean; detail: string }[];
    notes: string[];
    look: SavedLook;
    sourceId?: string;
    requestHash?: string;
    signer?: string;
    baseline: number;
    deadline?: string;
    measureAfter?: string;
  };
  escrows: Escrow[];
}

// ---------------------------------------------------------------------------
// Storage: one JSON file, rewritten on every change (a handful of campaigns)

const campaigns: Campaign[] = existsSync(storeFile) ? JSON.parse(readFileSync(storeFile, "utf8")) : [];
const save = () => {
  try {
    mkdirSync(new URL("../out/", import.meta.url), { recursive: true });
    writeFileSync(storeFile, `${JSON.stringify(campaigns, null, 2)}\n`);
  } catch {
    // the page must keep working if the store cannot be written
  }
};
const byId = (id: string) => campaigns.find((c) => c.id === id);

let buyerAddress: string | undefined;
const brandAddress = async (): Promise<string> => (buyerAddress ??= Address.toBech32(await makeClient("MNEMONIC").address()));

// ---------------------------------------------------------------------------
// Validation of the brand's terms

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

const parseTerms = (body: unknown): Omit<Campaign, "id" | "createdAt" | "status" | "steps" | "escrows"> => {
  const b = (body ?? {}) as Record<string, unknown>;
  const brand = text(b.brand, 60);
  const title = text(b.title, 80);
  const creator = text(b.creator, 40).replace(/^@/, "");
  if (!brand || !title) throw new Error("brand and title are required");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(creator)) throw new Error("creator must be an X handle (letters, digits, underscore)");
  const disclosure = Array.isArray(b.disclosure) ? b.disclosure.map((x) => text(x, 30)).filter(Boolean).slice(0, 8) : DEFAULT_DISCLOSURE;
  const raw = Array.isArray(b.milestones) ? b.milestones : [];
  const milestones = raw.slice(0, MAX_MILESTONES).map((m) => {
    const x = (m ?? {}) as Record<string, unknown>;
    return { likes: Number(x.likes), ...(text(x.label, 40) ? { label: text(x.label, 40) } : {}) };
  });
  if (milestones.length === 0) throw new Error(`give one to ${MAX_MILESTONES} milestones`);
  if (milestones.some((m) => !Number.isSafeInteger(m.likes) || m.likes < 1 || m.likes > 10_000_000)) throw new Error("each milestone needs a whole number of likes, at least 1");
  if (new Set(milestones.map((m) => m.likes)).size !== milestones.length) throw new Error("two milestones cannot ask for the same number of likes");
  milestones.sort((a, c) => a.likes - c.likes);
  const durationMinutes = Number(b.durationMinutes ?? 60);
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 8 * 24 * 60) throw new Error("durationMinutes must be between 15 minutes and 8 days");
  const measureLastMinutes = b.measureLastMinutes === undefined || b.measureLastMinutes === null || b.measureLastMinutes === "" ? undefined : Number(b.measureLastMinutes);
  if (measureLastMinutes !== undefined && (!Number.isSafeInteger(measureLastMinutes) || measureLastMinutes < 10 || measureLastMinutes > durationMinutes)) {
    throw new Error("measureLastMinutes must be at least 10 and at most the campaign's length");
  }
  const maxPostAgeHours = Number(b.maxPostAgeHours ?? 24);
  if (!Number.isFinite(maxPostAgeHours) || maxPostAgeHours <= 0 || maxPostAgeHours > 24 * 30) throw new Error("maxPostAgeHours must be between 0 and 720");
  return {
    brand,
    title,
    brief: text(b.brief, 600),
    creator,
    disclosure,
    milestones,
    likesMode: b.likesMode === "absolute" ? "absolute" : "increase",
    durationMinutes,
    ...(measureLastMinutes === undefined ? {} : { measureLastMinutes }),
    maxPostAgeHours,
  };
};

// ---------------------------------------------------------------------------
// Paying one escrow by x402 from the brand's wallet (the same path as escrow-client.ts and the console's live runs)

const lockEscrow = async (serviceUrl: string, body: Record<string, unknown>, add: (kind: Step["kind"], text: string, link?: Step["link"]) => void) => {
  const offer = parseOffer(body, Date.now());
  const url = `${serviceUrl}/api/escrow`;
  const request = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
  const first = await fetch(url, request);
  const header = first.headers.get("payment-required");
  if (first.status !== 402 || !header) throw new Error(`expected a price list (HTTP 402), got ${first.status}: ${(await first.text()).slice(0, 160)}`);
  const requirement = (JSON.parse(Buffer.from(header, "base64").toString("utf8")).accepts ?? [])[0];
  const problems = checkRequirement(requirement, offer);
  if (problems.length > 0) throw new Error(`the price list does not match the escrow asked for: ${problems.join("; ")}`);
  add("ok", "HTTP 402 price list checked field by field: the payment goes to the contract with exactly this policy as its datum (payee, refund party, rule, deadline, signer, request).");

  const client = new x402Client().setSpendControls({ allowedAssets: [{ network: "cardano:*", asset: "lovelace", maxAmountPerPayment: "5500000" }] });
  const baseSigner = toClientCardanoSigner({
    mnemonic: process.env.MNEMONIC as string,
    network: "cardano:preprod",
    provider: { blockfrost: { baseUrl: process.env.BLOCKFROST_BASE_URL ?? "https://cardano-preprod.blockfrost.io/api/v0", projectId: process.env.BLOCKFROST_PROJECT_ID as string } },
  });
  // the facilitator measures the payment's validity from the chain tip, which trails the clock (see buyer.ts)
  const signer = {
    ...baseSigner,
    buildAndSignPaymentTransaction: async (input: Parameters<typeof baseSigner.buildAndSignPaymentTransaction>[0]) => {
      const built = await baseSigner.buildAndSignPaymentTransaction({ ...input, maxTimeoutSeconds: Math.max(60, input.maxTimeoutSeconds - 120) });
      trackExternal(Transaction.fromCBORBytes(Buffer.from(built.transaction, "base64")), "campaigns.ts", true);
      return built;
    },
  };
  client.register("cardano:*", new ExactCardanoScheme(signer));

  add("wait", "Signing and sending the 5 tADA payment into the contract (20 to 60 seconds on preprod).");
  const wallet = makeClient("MNEMONIC");
  const response = await wrapFetchWithPayment(fetch, client)(url, request);
  let utxo;
  let payTx: string | undefined;
  if (!response.ok) {
    // a slow settlement is reported as a failure while the transaction lands anyway: look at the contract before saying so
    utxo = await findByDatum(wallet, String(requirement.extra?.datum), 150_000);
    if (!utxo) throw new Error(`the service refused the payment (HTTP ${response.status}) and no escrow was found at the contract`);
    payTx = hexOf(utxo.transactionId.hash);
  } else {
    payTx = new x402HTTPClient(client).getPaymentSettleResponse((name) => response.headers.get(name))?.transaction;
    if (!payTx) throw new Error("the payment settled but no transaction hash came back");
    for (let i = 0; i < 24 && !utxo; i++) {
      utxo = (await withRetry(() => wallet.getUtxos(scriptAddress), 2).catch(() => [])).find((u) => hexOf(u.transactionId.hash) === payTx);
      if (!utxo) await sleep(5000);
    }
    if (!utxo) throw new Error("the payment settled but its output is not visible at the contract yet");
  }
  await reconcile(payTx);
  return { ref: `${payTx}#${Number(utxo.index)}`, payTx, policy: policyViewOf(utxo) };
};

// ---------------------------------------------------------------------------
// The creator's submission: check, register, lock

export interface CampaignDeps {
  serviceUrl: string;
  watcher: () => { status: () => WatchStatus; serve: (address: string) => void } | undefined;
}

let submissions = 0;
let busy: string | undefined;

const refusal = (deps: CampaignDeps): string | undefined => {
  if (!LIVE) return "Live submissions are off on this server: start the service with CREATORPAY_LIVE=1 (it pays test escrows from the brand wallet).";
  const w = deps.watcher();
  if (!w) return "The keeper is off, so nothing would pay the creator. Start the service with AUTO_RELEASE=1 AUTO_RELEASE_PAID=1.";
  if (!w.status().allowPaid) return "The keeper cannot read tweets: start the service with AUTO_RELEASE_PAID=1.";
  if (busy) return "Another submission is being processed; try again in a minute.";
  if (submissions >= MAX_SUBMISSIONS) return `This server has already processed ${MAX_SUBMISSIONS} submissions; restart it to accept more.`;
  return undefined;
};

const submit = async (campaign: Campaign, postUrl: string, payee: string, deps: CampaignDeps) => {
  const add = (kind: Step["kind"], line: string, link?: Step["link"]) => {
    campaign.steps.push({ at: new Date().toISOString(), kind, text: line, ...(link ? { link } : {}) });
    save();
  };
  const id = tweetIdOf(postUrl)!;
  campaign.status = "checking";
  campaign.steps = [];
  campaign.escrows = [];
  add("wait", `Buying one signed look at post ${id} from the TwitterAPI.io Airnode (API3 AirnodeHub, 0.01 aUSD).`);
  const look = await buyLook(id);
  const review = reviewPost(look, id, { creator: campaign.creator, maxAgeHours: campaign.maxPostAgeHours, disclosure: campaign.disclosure });
  campaign.submission = { postUrl, payee, post: review.post, checks: review.checks, notes: review.notes, look, baseline: review.post.likes };
  add("ok", `Signed by Airnode ${String(look.airnode ?? "").slice(0, 10)}…: @${review.post.handle}, ${review.post.likes} likes now.`);
  if (review.problems.length > 0) {
    campaign.status = "refused";
    add("refused", `The post does not meet the brand's terms: ${review.problems.join("; ")}. Nothing was locked.`);
    return;
  }
  add("ok", "Every check passed: the agreed creator, a new post, not a reply, not a repost, disclosure tag present.");

  const spec = creatorSpec(review.post);
  const specFile = fileURLToPath(new URL(`../specs/${spec.id}.json`, import.meta.url));
  mkdirSync(fileURLToPath(new URL("../specs/", import.meta.url)), { recursive: true });
  writeFileSync(specFile, `${JSON.stringify(spec, null, 2)}\n`);
  add("wait", "Registering the post as a data source: the signed text will pin the author's id, the creation time and the post id (one more signed fetch).");
  try {
    await run(process.execPath, ["node_modules/tsx/dist/cli.mjs", "src/register-source.ts", "--spec", specFile], { cwd: cardanoDir, timeout: 180_000, maxBuffer: 16 * 1024 * 1024 });
  } catch (error) {
    throw new Error(`registration failed: ${String((error as { stderr?: string; message: string }).stderr || (error as Error).message).split("\n").filter(Boolean).slice(-2).join(" | ").slice(0, 240)}`);
  }
  const vector = loadVector(`src-${spec.id}`);
  campaign.submission.sourceId = spec.id;
  campaign.submission.requestHash = `0x${vector.requestHashHex}`;
  campaign.submission.signer = `0x${vector.pubkeyHex}`;
  add("ok", `Registered. Every escrow will pin request ${campaign.submission.requestHash.slice(0, 12)}… and the Airnode's key, so only signed data about exactly this post can pay.`);

  const watcher = deps.watcher()!;
  watcher.serve(payee);
  campaign.status = "locking";
  const refund = await brandAddress();
  const lockedAt = Date.now();
  const deadlineMs = lockedAt + campaign.durationMinutes * 60_000;
  const measureAfterMs = campaign.measureLastMinutes === undefined ? undefined : deadlineMs - campaign.measureLastMinutes * 60_000;
  campaign.submission.deadline = new Date(deadlineMs).toISOString();
  if (measureAfterMs !== undefined) campaign.submission.measureAfter = new Date(Math.max(measureAfterMs, lockedAt)).toISOString();
  campaign.escrows = campaign.milestones.map((m, i) => ({ milestone: i, threshold: campaign.likesMode === "increase" ? review.post.likes + m.likes : m.likes, state: "pending" }));
  save();

  for (const escrow of campaign.escrows) {
    escrow.state = "locking";
    add("info", `Milestone ${escrow.milestone + 1}: the brand pays 5 tADA into the contract, released to the creator when the signed count shows at least ${escrow.threshold} likes.`);
    try {
      const locked = await lockEscrow(
        deps.serviceUrl,
        {
          template: "source",
          sourceId: spec.id,
          atLeast: escrow.threshold,
          refund,
          payee,
          deadlineMs,
          ...(measureAfterMs === undefined ? {} : { measureAfterMs: Math.max(measureAfterMs, Date.now()) }),
        },
        add,
      );
      Object.assign(escrow, { state: "locked", ref: locked.ref, payTx: locked.payTx });
      add("ok", `Milestone ${escrow.milestone + 1} is locked at the contract. Nobody holds the money in between.`, { label: "payment transaction", url: scan(locked.payTx) });
    } catch (error) {
      Object.assign(escrow, { state: "failed", error: String((error as Error).message).slice(0, 200) });
      add("refused", `Milestone ${escrow.milestone + 1} could not be locked: ${escrow.error}`);
    }
  }
  campaign.status = campaign.escrows.some((e) => e.state === "locked") ? "live" : "failed";
  add(campaign.status === "live" ? "ok" : "refused", campaign.status === "live" ? "Live. The keeper now checks the signed like count every few seconds and releases each milestone the moment it is proven." : "No escrow could be locked.");
};

// ---------------------------------------------------------------------------
// Releases reported by the keeper (service.ts forwards every job here)

export const onKeeperJob = (entry: Record<string, unknown>) => {
  if (entry.outcome !== "released" || typeof entry.ref !== "string" || typeof entry.tx !== "string") return;
  for (const c of campaigns) {
    const escrow = c.escrows.find((e) => e.ref === entry.ref);
    if (!escrow) continue;
    Object.assign(escrow, { state: "released", releaseTx: entry.tx, releasedAt: new Date().toISOString(), ...(typeof entry.value === "number" ? { releasedValue: entry.value } : {}) });
    c.steps.push({ at: new Date().toISOString(), kind: "ok", text: `Milestone ${escrow.milestone + 1} paid: the keeper proved ${entry.value ?? "the"} likes with a fresh signed response and the contract released 5 tADA to the creator.`, link: { label: "release transaction", url: scan(entry.tx) } });
    save();
  }
};

// ---------------------------------------------------------------------------
// Routes

export const campaignRoutes = (deps: CampaignDeps): Router => {
  const router = Router();

  // After a restart the keeper only serves the payees in its environment: give it back the creators of open campaigns.
  let restored = false;
  router.use((_req, _res, next) => {
    const w = deps.watcher();
    if (!restored && w) {
      restored = true;
      for (const c of campaigns) if (c.submission?.payee && c.escrows.some((e) => e.state === "locked")) w.serve(c.submission.payee);
    }
    next();
  });

  /** A campaign with what the keeper knows right now: the latest signed like count and each escrow's state. */
  const view = (c: Campaign) => {
    const status = deps.watcher()?.status();
    const sourceKey = c.submission?.sourceId ? `reg:${c.submission.sourceId}` : undefined;
    const likes = sourceKey && status?.lastValues[sourceKey] !== undefined ? status.lastValues[sourceKey] : c.submission?.baseline;
    return {
      ...c,
      submission: c.submission && { ...c.submission, look: { ...c.submission.look, data: c.submission.look.data.slice(0, 4000) } },
      live: {
        likes,
        signedCount: Boolean(sourceKey && status?.lastValues[sourceKey] !== undefined),
        lastCycleAt: status?.lastCycleAt,
        escrows: c.escrows.map((e) => ({ ref: e.ref, keeper: status?.candidates.find((x) => x.ref === e.ref)?.state })),
      },
    };
  };

  router.get("/api/cp/config", async (_req, res) => {
    const w = deps.watcher()?.status();
    let brandWallet: string | undefined;
    try {
      brandWallet = await brandAddress();
    } catch {
      // no MNEMONIC: the page shows read-only mode
    }
    res.json({
      network: "Cardano preprod",
      live: LIVE,
      refusal: refusal(deps) ?? null,
      validatorHash: scriptHash,
      validatorAddress: validatorAddressBech32,
      escrowTada: Number(ESCROW_LOVELACE) / 1_000_000,
      maxMilestones: MAX_MILESTONES,
      brandWallet,
      keeper: w ? { enabled: true, allowPaid: w.allowPaid, lastCycleAt: w.lastCycleAt, ausdSpent: w.ausdSpent, released: w.released } : { enabled: false },
      defaultDisclosure: DEFAULT_DISCLOSURE,
    });
  });

  router.get("/api/cp/campaigns", (_req, res) => void res.json(campaigns.map(view).reverse()));

  router.get("/api/cp/campaigns/:id", (req, res) => {
    const c = byId(String(req.params.id));
    if (!c) return void res.status(404).json({ error: "No such campaign" });
    res.json(view(c));
  });

  router.post("/api/cp/campaigns", (req: Request, res: Response) => {
    if (campaigns.length >= 200) return void res.status(429).json({ error: "Too many campaigns on this server" });
    let terms;
    try {
      terms = parseTerms(req.body);
    } catch (error) {
      return void res.status(400).json({ error: (error as Error).message });
    }
    const campaign: Campaign = { id: `cp-${Date.now().toString(36)}`, createdAt: new Date().toISOString(), status: "open", steps: [], escrows: [], ...terms };
    campaigns.push(campaign);
    save();
    res.json(view(campaign));
  });

  router.post("/api/cp/campaigns/:id/submit", (req: Request, res: Response) => {
    const c = byId(String(req.params.id));
    if (!c) return void res.status(404).json({ error: "No such campaign" });
    if (!["open", "refused", "failed"].includes(c.status)) return void res.status(409).json({ error: "A post was already submitted for this campaign." });
    const b = (req.body ?? {}) as Record<string, unknown>;
    const postUrl = text(b.postUrl, 300);
    const payee = text(b.payee, 120);
    if (!tweetIdOf(postUrl)) return void res.status(400).json({ error: "Paste the link to the post: https://x.com/<handle>/status/<ID>" });
    let credential: string | undefined;
    try {
      credential = Address.fromBech32(payee).paymentCredential?._tag;
    } catch {
      // reported below
    }
    if (!payee.startsWith("addr_test1") || credential !== "KeyHash") return void res.status(400).json({ error: "The payout address must be a Cardano preprod wallet address (addr_test1...)." });
    const why = refusal(deps);
    if (why) return void res.status(409).json({ error: why });
    submissions += 1;
    busy = c.id;
    void submit(c, postUrl, payee, deps)
      .catch((error) => {
        c.status = "failed";
        c.steps.push({ at: new Date().toISOString(), kind: "refused", text: `Stopped: ${String((error as Error).message).replace(/\s+/g, " ").slice(0, 240)}` });
        save();
      })
      .finally(() => {
        busy = undefined;
      });
    res.json(view(c));
  });

  return router;
};

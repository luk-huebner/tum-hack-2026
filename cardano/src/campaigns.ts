import { Transaction } from "@evolution-sdk/evolution";
import { explorer, latestTransactions, reconcile, trackExternal } from "./tx-tracking.js";
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
const MAX_UNITS = 3; // 5 tADA escrows behind one milestone (or behind the posting payment)
const MAX_ESCROWS = 8; // per campaign: 40 tADA, the same limit as the tranche planner
const MAX_BULK = 50; // creators in one import
const MAX_CAMPAIGNS = 200;

export interface Milestone {
  likes: number;
  label?: string;
  /** How many 5 tADA escrows pay this milestone (default 1): the brand's budget split. */
  units?: number;
}

export interface Escrow {
  /** Index into `milestones`, or -1 for the posting payment. */
  milestone: number;
  /** "posting" pays as soon as the post is live (threshold 0); "likes" pays at `threshold` likes. Older stored escrows have no kind (likes). */
  kind?: "posting" | "likes";
  label?: string;
  /** Which of the `units` escrows of this milestone this is (0-based). */
  unit?: number;
  units?: number;
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
  /** The posting payment: pays when the post is live, no like needed (a presence escrow). */
  posting?: { units: number; label?: string };
  /** Set when the brand imported many creators at once: every campaign of the import shares it. */
  groupId?: string;
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

export const parseTerms = (body: unknown): Omit<Campaign, "id" | "createdAt" | "status" | "steps" | "escrows"> => {
  const b = (body ?? {}) as Record<string, unknown>;
  const brand = text(b.brand, 60);
  const title = text(b.title, 80);
  const creator = text(b.creator, 40).replace(/^@/, "");
  if (!brand || !title) throw new Error("brand and title are required");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(creator)) throw new Error("creator must be an X handle (letters, digits, underscore)");
  const disclosure = Array.isArray(b.disclosure) ? b.disclosure.map((x) => text(x, 30)).filter(Boolean).slice(0, 8) : DEFAULT_DISCLOSURE;
  const raw = Array.isArray(b.milestones) ? b.milestones : [];
  const unitsOf = (v: unknown, what: string) => {
    const n = v === undefined || v === null || v === "" ? 1 : Number(v);
    if (!Number.isSafeInteger(n) || n < 1 || n > MAX_UNITS) throw new Error(`${what}: units (5 tADA escrows) must be a whole number from 1 to ${MAX_UNITS}`);
    return n;
  };
  const milestones: Milestone[] = raw.slice(0, MAX_MILESTONES).map((m, i) => {
    const x = (m ?? {}) as Record<string, unknown>;
    const units = unitsOf(x.units, `milestone ${i + 1}`);
    return { likes: Number(x.likes), ...(text(x.label, 40) ? { label: text(x.label, 40) } : {}), ...(units > 1 ? { units } : {}) };
  });
  // The posting payment: pays as soon as the post is live, with no like needed
  const postingRaw = b.posting === undefined || b.posting === null || b.posting === false ? undefined : b.posting;
  const postingObj = typeof postingRaw === "object" && postingRaw !== null ? (postingRaw as Record<string, unknown>) : {};
  const posting = postingRaw === undefined ? undefined : { units: unitsOf(postingObj.units, "posting"), ...(text(postingObj.label, 40) ? { label: text(postingObj.label, 40) } : {}) };
  if (milestones.length === 0 && !posting) throw new Error(`give a posting payment or one to ${MAX_MILESTONES} like milestones`);
  const escrowCount = (posting?.units ?? 0) + milestones.reduce((n, m) => n + (m.units ?? 1), 0);
  if (escrowCount > MAX_ESCROWS) throw new Error(`${escrowCount} escrows is more than the limit of ${MAX_ESCROWS} (${MAX_ESCROWS * 5} tADA) per campaign`);
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
    ...(posting ? { posting } : {}),
    likesMode: b.likesMode === "absolute" ? "absolute" : "increase",
    durationMinutes,
    ...(measureLastMinutes === undefined ? {} : { measureLastMinutes }),
    maxPostAgeHours,
  };
};

// ---------------------------------------------------------------------------
// The escrows a campaign needs: the posting payment first, then every like milestone, one escrow per unit

export const escrowUnits = (c: Pick<Campaign, "milestones" | "posting">) => (c.posting?.units ?? 0) + c.milestones.reduce((n, m) => n + (m.units ?? 1), 0);

export const buildEscrows = (c: Pick<Campaign, "milestones" | "posting" | "likesMode">, baselineLikes: number): Escrow[] => {
  const out: Escrow[] = [];
  if (c.posting) {
    for (let u = 0; u < c.posting.units; u++) out.push({ milestone: -1, kind: "posting", label: c.posting.label ?? "Post goes live", unit: u, units: c.posting.units, threshold: 0, state: "pending" });
  }
  c.milestones.forEach((m, i) => {
    const units = m.units ?? 1;
    for (let u = 0; u < units; u++) {
      out.push({ milestone: i, kind: "likes", ...(m.label ? { label: m.label } : {}), unit: u, units, threshold: c.likesMode === "increase" ? baselineLikes + m.likes : m.likes, state: "pending" });
    }
  });
  return out;
};

export const escrowName = (e: Escrow) => {
  const base = e.kind === "posting" ? (e.label ?? "The posting payment") : `Milestone ${e.milestone + 1}`;
  return (e.units ?? 1) > 1 ? `${base} (${(e.unit ?? 0) + 1} of ${e.units})` : base;
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
  campaign.escrows = buildEscrows(campaign, review.post.likes);
  save();

  for (const escrow of campaign.escrows) {
    escrow.state = "locking";
    add("info", escrow.kind === "posting" ? `${escrowName(escrow)}: the brand pays 5 tADA into the contract, released to the creator as soon as a fresh signed response shows the post is live.` : `${escrowName(escrow)}: the brand pays 5 tADA into the contract, released to the creator when the signed count shows at least ${escrow.threshold} likes.`);
    try {
      const locked = await lockEscrow(
        deps.serviceUrl,
        {
          template: "source",
          sourceId: spec.id,
          ...(escrow.kind === "posting" ? { presence: true } : { atLeast: escrow.threshold }),
          refund,
          payee,
          deadlineMs,
          ...(escrow.kind === "posting" || measureAfterMs === undefined ? {} : { measureAfterMs: Math.max(measureAfterMs, Date.now()) }),
        },
        add,
      );
      Object.assign(escrow, { state: "locked", ref: locked.ref, payTx: locked.payTx });
      add("ok", `${escrowName(escrow)} is locked at the contract. Nobody holds the money in between.`, { label: "payment transaction", url: scan(locked.payTx) });
    } catch (error) {
      Object.assign(escrow, { state: "failed", error: String((error as Error).message).slice(0, 200) });
      add("refused", `${escrowName(escrow)} could not be locked: ${escrow.error}`);
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
    c.steps.push({ at: new Date().toISOString(), kind: "ok", text: escrow.kind === "posting" ? `${escrowName(escrow)} paid: a fresh signed response showed the post is live and the contract released 5 tADA to the creator.` : `${escrowName(escrow)} paid: the keeper proved ${entry.value ?? "the"} likes with a fresh signed response and the contract released 5 tADA to the creator.`, link: { label: "release transaction", url: scan(entry.tx) } });
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
      budgetTada: escrowUnits(c) * (Number(ESCROW_LOVELACE) / 1_000_000),
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
    if (campaigns.length >= MAX_CAMPAIGNS) return void res.status(429).json({ error: "Too many campaigns on this server" });
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

  /** Many influencers, one set of terms: one campaign per creator under a shared groupId. Rows that cannot be created are skipped and reported. */
  router.post("/api/cp/campaigns/bulk", (req: Request, res: Response) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const rows = Array.isArray(b.creators) ? b.creators : [];
    if (rows.length === 0) return void res.status(400).json({ error: "creators must be a list of X handles (or { handle } objects)" });
    if (rows.length > MAX_BULK) return void res.status(400).json({ error: `at most ${MAX_BULK} creators per import` });
    const groupId = `grp-${Date.now().toString(36)}`;
    const made: Campaign[] = [];
    const skipped: { row: number; handle: string; reason: string }[] = [];
    const seen = new Set<string>();
    rows.forEach((row, i) => {
      const handle = String(typeof row === "string" ? row : ((row ?? {}) as Record<string, unknown>).handle ?? "").trim().replace(/^@/, "");
      if (seen.has(handle.toLowerCase())) return void skipped.push({ row: i + 1, handle, reason: "duplicate handle" });
      seen.add(handle.toLowerCase());
      if (campaigns.length + made.length >= MAX_CAMPAIGNS) return void skipped.push({ row: i + 1, handle, reason: "too many campaigns on this server" });
      try {
        const terms = parseTerms({ ...b, creator: handle });
        made.push({ id: `cp-${(Date.now() + i).toString(36)}`, createdAt: new Date().toISOString(), status: "open", steps: [], escrows: [], groupId, ...terms });
      } catch (error) {
        skipped.push({ row: i + 1, handle, reason: (error as Error).message });
      }
    });
    if (made.length === 0) return void res.status(400).json({ error: skipped[0]?.reason ?? "nothing to create", skipped });
    campaigns.push(...made);
    save();
    res.json({ groupId, campaigns: made.map(view), skipped });
  });

  router.get("/api/cp/groups/:id", (req, res) => {
    const list = campaigns.filter((c) => c.groupId === String(req.params.id));
    if (list.length === 0) return void res.status(404).json({ error: "No such group" });
    res.json({ groupId: String(req.params.id), campaigns: list.map(view).reverse() });
  });

  /** The creator's own view: by payout wallet or by X handle (who), optionally narrowed to one post (a link or an id). */
  router.get("/api/cp/creator", (req, res) => {
    const wallet = text(req.query.wallet, 120);
    const handle = text(req.query.handle, 40).replace(/^@/, "").toLowerCase();
    const post = text(req.query.post, 300);
    const postId = post ? (tweetIdOf(post) ?? (/^\d{1,20}$/.test(post) ? post : undefined)) : undefined;
    if (!wallet && !handle && !post) return void res.status(400).json({ error: "give a wallet, a handle or a post link" });
    if (post && !postId) return void res.status(400).json({ error: "the post must be a link https://x.com/<handle>/status/<ID> or its id" });
    const list = campaigns.filter((c) => {
      const who = wallet || handle ? (wallet !== "" && c.submission?.payee === wallet) || (handle !== "" && c.creator.toLowerCase() === handle) : true;
      const which = postId ? c.submission?.postUrl !== undefined && tweetIdOf(c.submission.postUrl) === postId : true;
      return who && which;
    });
    res.json(list.map(view).reverse());
  });

  /** What happens behind the screens: the keeper, every transaction the service made, the activity and the signed data it acted on. */
  router.get("/api/cp/engine", (_req, res) => {
    const w = deps.watcher()?.status();
    let journal: ReturnType<typeof latestTransactions> = [];
    try {
      journal = latestTransactions();
    } catch {
      // a damaged journal must not break the page
    }
    const transactions = journal
      .sort((a, c) => (c.confirmationTimestamp ?? c.submissionTimestamp ?? c.updatedAt).localeCompare(a.confirmationTimestamp ?? a.submissionTimestamp ?? a.updatedAt))
      .slice(0, 80)
      .map((t) => ({ txHash: t.txHash, operation: t.operation, state: t.state, blockNumber: t.blockNumber, submittedAt: t.submissionTimestamp, confirmedAt: t.confirmationTimestamp, updatedAt: t.updatedAt, source: t.source, escrowRefs: t.escrowRefs, explorerUrl: t.explorerUrl || explorer(t.txHash), note: t.note ?? null }));
    const activity = campaigns
      .flatMap((c) => c.steps.map((s) => ({ ...s, campaignId: c.id, title: c.title, brand: c.brand, creator: c.creator })))
      .sort((a, c) => c.at.localeCompare(a.at))
      .slice(0, 80);
    const signed = campaigns
      .filter((c) => c.submission)
      .slice(-20)
      .reverse()
      .map((c) => {
        const s = c.submission!;
        const key = s.sourceId ? `reg:${s.sourceId}` : undefined;
        return { campaignId: c.id, creator: c.creator, postUrl: s.postUrl, airnode: s.look.airnode ?? null, signedAt: s.look.timestamp ?? null, requestHash: s.requestHash ?? null, signer: s.signer ?? null, baselineLikes: s.baseline, likesNow: key && w?.lastValues[key] !== undefined ? w.lastValues[key] : s.baseline, signedCount: Boolean(key && w?.lastValues[key] !== undefined) };
      });
    const escrowStates: Record<string, number> = {};
    const campaignStates: Record<string, number> = {};
    for (const c of campaigns) {
      campaignStates[c.status] = (campaignStates[c.status] ?? 0) + 1;
      for (const e of c.escrows) escrowStates[e.state] = (escrowStates[e.state] ?? 0) + 1;
    }
    res.json({
      generatedAt: new Date().toISOString(),
      network: "Cardano preprod",
      contract: { validatorHash: scriptHash, validatorAddress: validatorAddressBech32 },
      keeper: w
        ? { enabled: true, dry: w.dry, allowPaid: w.allowPaid, startedAt: w.startedAt, lastCycleAt: w.lastCycleAt ?? null, released: w.released, retries: w.retries, ausdSpent: w.ausdSpent, consecutiveFailures: w.consecutiveFailures, watching: w.candidates.map((x) => ({ ref: x.ref, rule: x.rule, state: x.state, value: x.value ?? null, deadline: x.deadline, nextCheck: x.nextCheck ?? null })) }
        : { enabled: false },
      counts: { campaigns: campaigns.length, campaignStates, escrowStates, tadaReleased: (escrowStates.released ?? 0) * (Number(ESCROW_LOVELACE) / 1_000_000), tadaLocked: (escrowStates.locked ?? 0) * (Number(ESCROW_LOVELACE) / 1_000_000) },
      transactions,
      activity,
      signed,
    });
  });

  return router;
};

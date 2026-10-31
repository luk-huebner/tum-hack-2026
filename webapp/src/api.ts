// The Pay-on-Proof service (cardano/src/service.ts + campaigns.ts). Locally the Vite dev server proxies /api to it.
const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

export const SCAN = "https://preprod.cardanoscan.io";
export const scanTx = (hash: string) => `${SCAN}/transaction/${hash}`;
export const scanAddress = (addr: string) => `${SCAN}/address/${addr}`;

export interface Step {
  at: string;
  text: string;
  kind: "info" | "ok" | "wait" | "refused";
  link?: { label: string; url: string };
}

export interface Milestone {
  likes: number;
  label?: string;
  /** 5 tADA escrows behind this milestone (default 1): the brand's budget split. */
  units?: number;
}

export interface Escrow {
  /** Index into milestones, or -1 for the posting payment. */
  milestone: number;
  /** "posting" pays when the post is live (threshold 0); "likes" pays at the threshold. Missing on old campaigns: likes. */
  kind?: "posting" | "likes";
  label?: string;
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

export interface PostFacts {
  id: string;
  url: string;
  handle: string;
  authorId: string;
  authorName: string;
  followers: number;
  text: string;
  createdAt: string;
  ageHours: number;
  likes: number;
  replies: number;
  reposts: number;
  views: number;
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
  /** The posting payment: pays as soon as the post is live, no like needed. */
  posting?: { units: number; label?: string };
  /** Shared by every campaign created in one multi-creator import. */
  groupId?: string;
  budgetTada?: number;
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
    look: { data: string; requestHash?: string; airnode?: string; timestamp?: string; signature?: string };
    sourceId?: string;
    requestHash?: string;
    signer?: string;
    baseline: number;
    deadline?: string;
    measureAfter?: string;
  };
  escrows: Escrow[];
  live: {
    likes?: number;
    signedCount: boolean;
    lastCycleAt?: string;
    escrows: { ref?: string; keeper?: string }[];
  };
}

export interface Config {
  network: string;
  live: boolean;
  refusal: string | null;
  validatorHash: string;
  validatorAddress: string;
  escrowTada: number;
  maxMilestones: number;
  brandWallet?: string;
  keeper: { enabled: boolean; allowPaid?: boolean; lastCycleAt?: string; ausdSpent?: number; released?: number };
  defaultDisclosure: string[];
}

export interface BenchCase {
  id: string;
  label: string;
  file: string;
  policy: string;
  expect: "ACCEPTED" | "REJECTED";
  ref: string;
  response: Record<string, string>;
}

export interface Verdict {
  verdict: "ACCEPTED" | "REJECTED" | "ERROR";
  detail?: string;
  error?: string;
  hints?: { sameRequest: boolean; ageSeconds: number; maxAgeSeconds: number; tooOld: boolean; sum: number; threshold: number; ruleHolds: boolean };
  tookMs?: number;
}

export interface BoardRow {
  ref: string;
  lockedTada: number;
  rule: string;
  template: string;
  deadline: string;
  minutesLeft: number;
  state: string;
  paysThisService: boolean;
}

export interface EngineTx {
  txHash: string;
  operation: string;
  state: "built" | "submitted" | "confirmed" | "rejected" | "expired" | "unknown";
  blockNumber: number | null;
  submittedAt: string | null;
  confirmedAt: string | null;
  updatedAt: string;
  source: string;
  escrowRefs: string[];
  explorerUrl: string;
  note: string | null;
}

export interface Engine {
  generatedAt: string;
  /** "workspace": campaign activity and signed data of this browser's campaigns are included; "public": chain data only. */
  scope: "public" | "workspace";
  network: string;
  contract: { validatorHash: string; validatorAddress: string };
  keeper:
    | { enabled: false }
    | {
        enabled: true;
        dry: boolean;
        allowPaid: boolean;
        startedAt: string;
        lastCycleAt: string | null;
        released: number;
        retries: number;
        ausdSpent: number;
        consecutiveFailures: number;
        watching: { ref: string; rule: string; state: string; value: number | null; deadline: string; nextCheck: string | null }[];
      };
  counts: { campaigns: number; campaignStates: Record<string, number>; escrowStates: Record<string, number>; tadaReleased: number; tadaLocked: number };
  transactions: EngineTx[];
  activity: (Step & { campaignId: string; title: string; brand: string; creator: string })[];
  signed: { campaignId: string; creator: string; postUrl: string; airnode: string | null; signedAt: string | null; requestHash: string | null; signer: string | null; baselineLikes: number; likesNow: number; signedCount: boolean }[];
}

export interface BulkResult {
  groupId: string;
  campaigns: Campaign[];
  skipped: { row: number; handle: string; reason: string }[];
}

const WORKSPACE = "creatorpay.workspace";

/** A random key that stays in this browser. The campaigns created here are listed only to a browser that holds it (the server keeps a hash). */
export const workspaceKey = (): string => {
  try {
    let key = localStorage.getItem(WORKSPACE);
    if (!key || !/^[A-Za-z0-9_-]{32,128}$/.test(key)) {
      key = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(WORKSPACE, key);
    }
    return key;
  } catch {
    return ""; // storage blocked: no own list, invite links still work
  }
};

/** The service did not answer: offline, not deployed, or a proxy error page. Not the same as "no campaigns". */
export class ServiceUnreachable extends Error {}
export const OFFLINE_TEXT = "CreatorPay can't be reached right now. Check your connection and try again in a moment.";
export const describeError = (e: unknown) => (e instanceof ServiceUnreachable ? OFFLINE_TEXT : e instanceof Error ? e.message : String(e));

const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const key = workspaceKey();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers: { "content-type": "application/json", ...(key ? { "x-workspace-key": key } : {}), ...(init?.headers ?? {}) } });
  } catch {
    throw new ServiceUnreachable(OFFLINE_TEXT);
  }
  const body = await res.json().catch(() => undefined);
  const error = body && typeof body === "object" ? (body as { error?: string }).error : undefined;
  if (!res.ok && !(body && typeof body === "object" && "verdict" in body)) {
    if (typeof error !== "string") throw new ServiceUnreachable(OFFLINE_TEXT); // an error page, not an answer of the service
    throw new Error(error);
  }
  return (body ?? {}) as T;
};

export const api = {
  config: () => call<Config>("/api/cp/config"),
  campaigns: () => call<Campaign[]>("/api/cp/campaigns"),
  campaign: (id: string) => call<Campaign>(`/api/cp/campaigns/${encodeURIComponent(id)}`),
  createCampaign: (body: unknown) => call<Campaign>("/api/cp/campaigns", { method: "POST", body: JSON.stringify(body) }),
  submitPost: (id: string, body: { postUrl: string; payee: string }) => call<Campaign>(`/api/cp/campaigns/${encodeURIComponent(id)}/submit`, { method: "POST", body: JSON.stringify(body) }),
  /** Many influencers, one set of terms: `creators` is a list of X handles (or { handle }). */
  createCampaigns: (body: unknown) => call<BulkResult>("/api/cp/campaigns/bulk", { method: "POST", body: JSON.stringify(body) }),
  group: (id: string) => call<{ groupId: string; campaigns: Campaign[] }>(`/api/cp/groups/${encodeURIComponent(id)}`),
  /** The creator's own view: by payout wallet, or by one post (link or id). */
  creator: (q: { wallet?: string; post?: string }) => call<Campaign[]>(`/api/cp/creator?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString()}`),
  engine: () => call<Engine>("/api/cp/engine"),
  cases: () => call<BenchCase[]>("/api/cases"),
  judge: (ref: string, response: unknown) => call<Verdict>("/api/judge", { method: "POST", body: JSON.stringify({ ref, response }) }),
  board: () => call<{ validatorHash: string; count: number; rows: BoardRow[] }>("/api/board"),
};

export const short = (value: string, head = 8, tail = 6) => (value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`);
export const txOf = (ref?: string) => ref?.split("#")[0];

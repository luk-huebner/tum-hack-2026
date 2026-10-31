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

const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok && !(body && typeof body === "object" && "verdict" in body)) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body as T;
};

export const api = {
  config: () => call<Config>("/api/cp/config"),
  campaigns: () => call<Campaign[]>("/api/cp/campaigns"),
  campaign: (id: string) => call<Campaign>(`/api/cp/campaigns/${encodeURIComponent(id)}`),
  createCampaign: (body: unknown) => call<Campaign>("/api/cp/campaigns", { method: "POST", body: JSON.stringify(body) }),
  submitPost: (id: string, body: { postUrl: string; payee: string }) => call<Campaign>(`/api/cp/campaigns/${encodeURIComponent(id)}/submit`, { method: "POST", body: JSON.stringify(body) }),
  cases: () => call<BenchCase[]>("/api/cases"),
  judge: (ref: string, response: unknown) => call<Verdict>("/api/judge", { method: "POST", body: JSON.stringify({ ref, response }) }),
  board: () => call<{ validatorHash: string; count: number; rows: BoardRow[] }>("/api/board"),
};

export const short = (value: string, head = 8, tail = 6) => (value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`);
export const txOf = (ref?: string) => ref?.split("#")[0];

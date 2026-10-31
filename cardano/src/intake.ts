/**
 * The Creator Pay intake checks, shared by the command line (creator-intake.ts) and the web app (campaigns.ts).
 *
 * One signed look at a post (0.01 aUSD) says who posted it, when, what it says and how many likes it has. The review refuses
 * unless the author is the agreed creator, the post is new, not a reply, not a repost and carries a disclosure tag. The spec it
 * builds pins the author's numeric id, the creation time, the id and "isReply": false into the signed text, so a policy built
 * from it only accepts responses about exactly that post by exactly that author.
 */
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export const DEFAULT_DISCLOSURE = ["#ad", "#sponsored", "#werbung", "#anzeige", "paid partnership", "#paidpartnership"];

export interface SavedLook {
  data: string;
  requestHash?: string;
  airnode?: string;
  timestamp?: string;
  signature?: string;
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
  isReply: boolean;
  isRepost: boolean;
}

export interface Review {
  post: PostFacts;
  checks: { label: string; ok: boolean; detail: string }[];
  problems: string[];
  notes: string[];
}

/** The tweet id from `https://x.com/<handle>/status/<ID>` (with or without a query string) or a bare id. */
export const tweetIdOf = (link: string): string | undefined => {
  const value = link.trim();
  return /\/status(?:es)?\/(\d{1,20})(?:[/?#]|$)/.exec(value)?.[1] ?? (/^\d{1,20}$/.test(value) ? value : undefined);
};

/** Buys one signed look at the post through checks/10-paid-call.ts, which verifies the signer and the request hash. */
export const buyLook = async (id: string): Promise<SavedLook> => {
  const { stderr } = await run(process.execPath, ["--env-file=.env", "checks/10-paid-call.ts", "tweet", id], { cwd: repoRoot, timeout: 90_000, maxBuffer: 64 * 1024 * 1024 });
  const saved = /saved (\S+\.json)/.exec(stderr)?.[1];
  if (!saved || !stderr.includes("signature OK")) throw new Error(stderr.trim().split("\n").slice(-2).join(" | "));
  return JSON.parse(readFileSync(saved.replace(/^\/(\w:)/, "$1"), "utf8"));
};

/** Checks the post against the agreed terms. An empty `problems` list means it may be registered and locked. */
export const reviewPost = (
  look: SavedLook,
  id: string,
  terms: { creator: string; maxAgeHours: number; disclosure: string[] | false; pinText?: boolean },
): Review => {
  const t = (JSON.parse(look.data).tweets ?? [])[0] as Record<string, unknown> | undefined;
  if (!t || String(t.id ?? "") !== id) {
    throw new Error(`the data provider has no post ${id} (deleted, private, or a typo). An unknown id returns an empty record, so nothing would ever be paid.`);
  }
  const author = (t.author ?? {}) as Record<string, unknown>;
  const createdMs = Date.parse(String(t.createdAt ?? ""));
  const post: PostFacts = {
    id,
    url: String(t.url ?? ""),
    handle: String(author.userName ?? ""),
    authorId: String(author.id ?? ""),
    authorName: String(author.name ?? ""),
    followers: Number(author.followers ?? 0),
    text: String(t.text ?? ""),
    createdAt: String(t.createdAt ?? ""),
    ageHours: (Date.now() - createdMs) / 3_600_000,
    likes: Number(t.likeCount ?? 0),
    replies: Number(t.replyCount ?? 0),
    reposts: Number(t.retweetCount ?? 0),
    views: Number(t.viewCount ?? 0),
    isReply: t.isReply === true,
    isRepost: t.isRetweet === true,
  };

  const checks: Review["checks"] = [];
  const notes: string[] = [];
  const wanted = terms.creator.replace(/^@/, "").toLowerCase();
  const authorOk = wanted === post.handle.toLowerCase() || wanted === post.authorId;
  checks.push({ label: "Posted by the agreed creator", ok: authorOk, detail: authorOk ? `@${post.handle} (user id ${post.authorId})` : `the author is @${post.handle} (id ${post.authorId}), not "${terms.creator}"` });
  const fresh = Number.isFinite(createdMs) && post.ageHours <= terms.maxAgeHours;
  checks.push({ label: "A new post", ok: fresh, detail: fresh ? `posted ${post.ageHours < 1 ? `${Math.max(0, Math.round(post.ageHours * 60))} min` : `${post.ageHours.toFixed(1)} h`} ago` : `older than ${terms.maxAgeHours} hours: a campaign post must be new` });
  checks.push({ label: "Not a reply", ok: !post.isReply, detail: post.isReply ? "the post is a reply, not a post of its own" : "a post of its own" });
  checks.push({ label: "Not a repost", ok: !post.isRepost, detail: post.isRepost ? "the post is a repost of someone else's post" : "original content" });
  if (terms.disclosure === false) notes.push("no disclosure check: fine for a self-test, not for a paid campaign");
  else {
    const tags = terms.disclosure.map((x) => x.trim().toLowerCase()).filter(Boolean);
    const found = tags.find((tag) => post.text.toLowerCase().includes(tag));
    checks.push({ label: "Says it is paid", ok: Boolean(found), detail: found ? `"${found}" is in the text` : `no disclosure tag (one of: ${tags.join(", ")}). Paid posts must say they are paid` });
    if (found) notes.push("X's own paid-partnership label is not part of the data we receive, so the tag is what we can check");
  }
  if (terms.pinText) {
    // A number that directly follows a colon and a comma inside the text would be read as a number slot, not as text
    const risky = /:-?\d+(\.\d+)?[,}]/.test(JSON.stringify(post.text).slice(1, -1));
    checks.push({ label: "Text can be pinned", ok: !risky, detail: risky ? "the text contains something like :12, which the contract would read as a number slot" : `the exact text (${post.text.length} characters) is pinned: any edit means nothing is paid` });
    if (/[^ -~]/.test(post.text)) notes.push(`the text has ${[...post.text].filter((c) => /[^ -~]/.test(c)).length} non-ASCII character(s) (emoji or accents): the pinned text breaks if the provider ever encodes them differently`);
  }
  return { post, checks, problems: checks.filter((c) => !c.ok).map((c) => c.detail), notes };
};

/** The register-source.ts spec for a reviewed post: the signed text carries who posted it, when, the id and that it is not a reply. */
export const creatorSpec = (post: PostFacts, pinText = false) => ({
  id: `creator-${post.handle.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 14)}-${post.id.slice(-8)}`,
  label: `likes of @${post.handle}'s post ${post.id}`,
  slug: "twitterapi",
  request: {
    operation: "tweetsByIds",
    parameters: { tweet_ids: post.id },
    responseProjection: {
      id: "/tweets/0/id",
      authorId: "/tweets/0/author/id",
      createdAt: "/tweets/0/createdAt",
      isReply: "/tweets/0/isReply",
      likes: "/tweets/0/likeCount",
      replies: "/tweets/0/replyCount",
      retweets: "/tweets/0/retweetCount",
      views: "/tweets/0/viewCount",
      ...(pinText ? { text: "/tweets/0/text" } : {}),
    },
  },
  use: ["likes"],
  cmp: "AtLeast",
  kind: "counter",
  scale: 0,
});

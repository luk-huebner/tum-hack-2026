/**
 * Creator Pay intake: from the link to a creator's post to a source that is bound to that creator and that post.
 *
 *   tsx src/creator-intake.ts --tweet <link or id> --creator <handle or user id> [--target 500] [--no-disclosure] [--pin-text] [--register]
 *   tsx src/creator-intake.ts --tweet <link or id> --creator <handle> --from <saved response>      the same from a response already bought
 *
 * A link to a post is `https://x.com/<handle>/status/<ID>`: the number after /status/ is the tweet id. The contract only knows
 * the id, so on its own a creator could hand over somebody else's viral post. This tool buys ONE signed look at the post
 * (0.01 aUSD) and shows the buyer who posted it, when, and what it says. It checks that the author is the agreed creator, that the
 * post is recent, is not a reply or a repost, and carries a disclosure tag (paid posts must say they are paid). Then it writes a
 * spec in which the signed text includes the author's numeric id, the creation time, the id and "isReply": false, so the policy
 * only accepts responses for exactly that post by exactly that author. It pays nothing else: registering (--register) costs
 * two more fetches (0.02 aUSD), and locking the escrow is a separate command that is printed at the end.
 *
 * --pin-text also puts the post's exact text into the signed text, so an EDIT of the post (a removed disclosure tag, a changed
 * claim) means the policy no longer matches and nothing is paid. Use it when the wording matters; the cost is a larger datum
 * and a policy that breaks if the provider ever encodes the text differently (emoji and other non-ASCII characters are the risk).
 *
 * Counted likes are an absolute number. "--target 500" means "500 more than the baseline today", so the threshold printed is
 * baseline + 500; the baseline is read from this look at the post.
 */
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";

const run = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const cardanoDir = fileURLToPath(new URL("../", import.meta.url));

const { values } = parseArgs({
  options: {
    tweet: { type: "string" },
    creator: { type: "string" },
    target: { type: "string" },
    "max-age-hours": { type: "string", default: "24" },
    disclosure: { type: "string", default: "#ad,#sponsored,#werbung,#anzeige,paid partnership,#paidpartnership" },
    "no-disclosure": { type: "boolean", default: false },
    "pin-text": { type: "boolean", default: false },
    from: { type: "string" },
    register: { type: "boolean", default: false },
  },
});
if (!values.tweet || !values.creator) {
  console.error("Usage: tsx src/creator-intake.ts --tweet <link or id> --creator <handle or user id> [--target N] [--no-disclosure] [--register] [--from <saved response>]");
  process.exit(2);
}

const link = values.tweet.trim();
const id = /\/status(?:es)?\/(\d{1,20})(?:[/?#]|$)/.exec(link)?.[1] ?? (/^\d{1,20}$/.test(link) ? link : undefined);
if (!id) {
  console.error(`NOT READY: "${values.tweet}" is not a link to a post (https://x.com/<handle>/status/<ID>) or a tweet id`);
  process.exit(1);
}

interface Saved {
  data: string;
  requestHash?: string;
}

const buy = async (): Promise<Saved> => {
  try {
    const { stderr } = await run(process.execPath, ["--env-file=.env", "checks/10-paid-call.ts", "tweet", id], { cwd: repoRoot, timeout: 90_000, maxBuffer: 64 * 1024 * 1024 });
    const saved = /saved (\S+\.json)/.exec(stderr)?.[1];
    if (!saved || !stderr.includes("signature OK")) throw new Error(stderr.trim().split("\n").slice(-2).join(" | "));
    return JSON.parse(readFileSync(saved.replace(/^\/(\w:)/, "$1"), "utf8"));
  } catch (error) {
    console.error(`NOT READY: the paid look at the post failed: ${String((error as Error).message).slice(0, 240)}`);
    return process.exit(1);
  }
};

const main = async () => {
  const response: Saved = values.from ? JSON.parse(readFileSync(values.from, "utf8")) : await buy();
  const t = (JSON.parse(response.data).tweets ?? [])[0] as Record<string, unknown> | undefined;
  if (!t || String(t.id ?? "") !== id) {
    console.error(`NOT READY: the data provider has no post ${id} (deleted, private, or a typo). An unknown id returns an empty record, so nothing would ever be paid.`);
    process.exit(1);
  }
  const author = (t.author ?? {}) as Record<string, unknown>;
  const handle = String(author.userName ?? "");
  const authorId = String(author.id ?? "");
  const text = String(t.text ?? "");
  const createdMs = Date.parse(String(t.createdAt ?? ""));
  const ageHours = (Date.now() - createdMs) / 3_600_000;
  const likes = Number(t.likeCount ?? 0);

  console.log(`post ${id}  ${String(t.url ?? "")}`);
  console.log(`  author     @${handle} (user id ${authorId}, ${String(author.name ?? "")}, ${Number(author.followers ?? 0).toLocaleString("en")} followers)`);
  console.log(`  posted     ${String(t.createdAt)}  (${Number.isFinite(ageHours) ? `${ageHours.toFixed(1)} hours ago` : "time unreadable"})`);
  console.log(`  text       ${text.replace(/\s+/g, " ").slice(0, 200)}`);
  console.log(`  now        ${likes.toLocaleString("en")} likes, ${Number(t.replyCount ?? 0)} replies, ${Number(t.retweetCount ?? 0)} reposts, ${Number(t.viewCount ?? 0).toLocaleString("en")} views`);

  const problems: string[] = [];
  const notes: string[] = [];
  const wanted = values.creator!.replace(/^@/, "").toLowerCase();
  if (wanted !== handle.toLowerCase() && wanted !== authorId) problems.push(`the author is @${handle} (id ${authorId}), not "${values.creator}"`);
  if (!Number.isFinite(createdMs) || ageHours > Number(values["max-age-hours"])) problems.push(`the post is older than ${values["max-age-hours"]} hours: a campaign post must be new (use --max-age-hours to allow it)`);
  if (t.isReply === true) problems.push("the post is a reply, not a post of its own");
  if (t.isRetweet === true) problems.push("the post is a repost of someone else's post");
  if (values["no-disclosure"]) notes.push("no disclosure check (--no-disclosure): fine for a self-test, not for a paid campaign");
  else {
    const tags = values.disclosure.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!tags.some((tag) => text.toLowerCase().includes(tag))) problems.push(`the text has no disclosure tag (one of: ${tags.join(", ")}). Paid posts must say they are paid`);
    else notes.push("a disclosure tag is in the text. X's own paid-partnership label is not part of the data we receive, so the tag is what we can check");
  }

  const specId = `creator-${handle.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 14)}-${id.slice(-8)}`;
  const spec = {
    id: specId,
    label: `likes of @${handle}'s post ${id}`,
    slug: "twitterapi",
    request: {
      operation: "tweetsByIds",
      parameters: { tweet_ids: id },
      // the signed text carries who posted it, when, the id and that it is not a reply, besides the counts the rule reads
      responseProjection: {
        id: "/tweets/0/id",
        authorId: "/tweets/0/author/id",
        createdAt: "/tweets/0/createdAt",
        isReply: "/tweets/0/isReply",
        likes: "/tweets/0/likeCount",
        replies: "/tweets/0/replyCount",
        retweets: "/tweets/0/retweetCount",
        views: "/tweets/0/viewCount",
        ...(values["pin-text"] ? { text: "/tweets/0/text" } : {}),
      },
    },
    use: ["likes"],
    cmp: "AtLeast",
    kind: "counter",
    scale: 0,
  };

  if (values["pin-text"]) {
    // A number that directly follows a colon and a comma inside the text would be read as a number slot, not as text
    const risky = /:-?\d+(\.\d+)?[,}]/.test(JSON.stringify(text).slice(1, -1));
    if (risky) problems.push("the text contains something like :12, which the contract would read as a number slot; do not pin this text (or reword the post)");
    if (/[^ -~]/.test(text)) notes.push(`the text has ${[...text].filter((c) => /[^ -~]/.test(c)).length} non-ASCII character(s) (emoji or accents): the pinned text breaks if the provider ever encodes them differently. Run --register, which fetches twice and compares`);
    notes.push(`the exact text (${text.length} characters) is pinned: any edit of the post means nothing is paid`);
  }
  for (const n of notes) console.log(`  note       ${n}`);
  if (problems.length > 0) {
    for (const p of problems) console.log(`  PROBLEM    ${p}`);
    console.log("\nNOT READY: fix the problems above before anything is registered or locked.");
    process.exit(1);
  }
  console.log("  checks     author, age, not a reply, not a repost: all fine");

  const specFile = join(cardanoDir, "specs", `${specId}.json`);
  mkdirSync(join(cardanoDir, "specs"), { recursive: true });
  writeFileSync(specFile, `${JSON.stringify(spec, null, 2)}\n`);
  console.log(`\nspec written: specs/${specId}.json  (the signed text will include author id ${authorId}, the creation time, the id and isReply false${values["pin-text"] ? ", and the exact text" : ""})`);

  const target = values.target === undefined ? undefined : Number(values.target);
  const atLeast = target === undefined ? "<likes>" : String(likes + target);
  if (target !== undefined) console.log(`threshold: ${likes} likes now + ${target} = at least ${atLeast}`);

  if (values.register) {
    console.log("\nregistering (two paid fetches, 0.02 aUSD; the second proves the fixed text does not change)...");
    try {
      const { stdout } = await run(process.execPath, ["node_modules/tsx/dist/cli.mjs", "src/register-source.ts", "--spec", specFile, "--twice"], { cwd: cardanoDir, timeout: 240_000, maxBuffer: 16 * 1024 * 1024 });
      console.log(stdout.trim().split("\n").map((l) => `  ${l}`).join("\n"));
    } catch (error) {
      console.error(`NOT REGISTERED: ${String((error as { stdout?: string; message: string }).stdout ?? (error as Error).message).split("\n").slice(-4).join(" | ").slice(0, 300)}`);
      process.exit(1);
    }
  } else {
    console.log(`\nnext: register it (two paid fetches, 0.02 aUSD):\n  tsx src/register-source.ts --spec specs/${specId}.json --twice`);
  }
  console.log(`\nthen lock the escrow (5 tADA by x402; pay the creator, refund the buyer; example: a 24 hour campaign counted only in its last hour):
  tsx src/escrow-client.ts --template source --source ${specId} --at-least ${atLeast} --minutes 1440 --measure-after-minutes 1380 --payee <the creator's addr_test1...>
  (the seller's keeper must be allowed to serve that payee: AUTO_RELEASE_PAYEES=<the same address>)`);
};

mkdirSync(join(tmpdir(), "pay-on-proof"), { recursive: true });
await main();
process.exit(0);

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, CheckCircle2, Clock, ExternalLink, FileSignature, Heart, Loader2, Lock, PartyPopper, ShieldCheck, Wallet, XCircle } from "lucide-react";
import { useConfig } from "../App";
import { api, scanAddress, scanTx, txOf, type Campaign, type Escrow } from "../api";
import { Steps } from "../components/Steps";
import { Badge, ErrorNote, Hash, SectionTitle, dateTimeOf, timeOf } from "../components/ui";
import { statusBadge } from "./Brand";

const ACTIVE: Campaign["status"][] = ["checking", "locking", "live"];

const Offer = ({ c, escrowTada }: { c: Campaign; escrowTada: number }) => (
  <div className="card p-6">
    <SectionTitle eyebrow="The offer" title={`${c.milestones.length * escrowTada} tADA for one post`} />
    {c.brief && <p className="mb-5 whitespace-pre-line rounded-xl bg-white/5 p-4 text-sm leading-relaxed text-ink-soft">{c.brief}</p>}
    <h4 className="mb-2 text-sm font-bold">The post must</h4>
    <ul className="mb-5 space-y-1.5 text-sm text-ink-soft">
      <li className="flex gap-2">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-400" /> be posted by <span className="font-semibold">@{c.creator}</span> on X
      </li>
      <li className="flex gap-2">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-400" /> be new: at most {c.maxPostAgeHours} hours old when submitted, not a reply, not a repost
      </li>
      <li className="flex gap-2">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-400" /> say it is paid: contain {c.disclosure.map((t) => `"${t}"`).join(" or ")}
      </li>
    </ul>
    <h4 className="mb-2 text-sm font-bold">You are paid per milestone</h4>
    <div className="space-y-2">
      {c.milestones.map((m, i) => (
        <div key={i} className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-2.5 text-sm">
          <span>
            <span className="mr-2 font-bold text-brand-400">{i + 1}</span>
            {m.label && <span className="mr-2 font-semibold">{m.label}</span>}
            <span className="text-ink-mute">
              {c.likesMode === "increase" ? `+${m.likes} new` : `${m.likes} total`} like{m.likes > 1 ? "s" : ""}
            </span>
          </span>
          <span className="font-bold">{escrowTada} tADA</span>
        </div>
      ))}
    </div>
    <p className="mt-4 text-xs text-ink-mute">
      Window: {c.durationMinutes >= 120 ? `${Math.round(c.durationMinutes / 60)} hours` : `${c.durationMinutes} minutes`} from when the escrow is locked.
      {c.measureLastMinutes ? ` Only likes signed in the last ${c.measureLastMinutes} minutes count.` : " Each milestone pays as soon as it is reached."} Unpaid milestones go back to {c.brand} after the window.
    </p>
  </div>
);

const SubmitForm = ({ c, onDone }: { c: Campaign; onDone: (c: Campaign) => void }) => {
  const { config } = useConfig();
  const [postUrl, setPostUrl] = useState("");
  const [payee, setPayee] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      onDone(await api.submitPost(c.id, { postUrl: postUrl.trim(), payee: payee.trim() }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={send} className="card space-y-5 p-6">
      <SectionTitle eyebrow="Creator" title="Submit your post">
        Post on X, tap Share, then Copy link, and paste it here with the wallet that should receive the payout.
      </SectionTitle>
      <div>
        <label className="label" htmlFor="post">Link to your post</label>
        <input id="post" className="input" required placeholder="https://x.com/handle/status/1234567890" value={postUrl} onChange={(e) => setPostUrl(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="payee">Your Cardano payout address (preprod)</label>
        <input id="payee" className="input mono" required placeholder="addr_test1..." value={payee} onChange={(e) => setPayee(e.target.value)} />
        <p className="hint">The contract pays this address directly. Nobody else can redirect it.</p>
      </div>
      {config?.refusal && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <span className="font-semibold">Read-only server.</span> {config.refusal}
        </div>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      <button className="btn-primary w-full py-3" disabled={busy}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : <FileSignature size={18} />} Verify my post and lock the payout
      </button>
      <p className="text-xs text-ink-mute">
        We buy one look at the post signed by API3's TwitterAPI.io Airnode and check it against the terms. Only if it passes does {c.brand} lock the payout in the contract.
      </p>
    </form>
  );
};

const escrowState = (e: Escrow, keeper?: string) => {
  if (e.state === "released") return <Badge tone="green"><CheckCircle2 size={12} /> Paid</Badge>;
  if (e.state === "locking") return <Badge tone="blue"><Loader2 size={12} className="animate-spin" /> Locking</Badge>;
  if (e.state === "pending") return <Badge>Queued</Badge>;
  if (e.state === "failed") return <Badge tone="red">Not locked</Badge>;
  if (keeper === "releasing" || keeper === "retrying") return <Badge tone="blue"><Loader2 size={12} className="animate-spin" /> Releasing</Badge>;
  if (keeper === "expired" || keeper === "deadline-close") return <Badge tone="amber">Deadline passed</Badge>;
  return <Badge tone="blue"><Lock size={12} /> Locked · watching</Badge>;
};

const Tracker = ({ c, escrowTada }: { c: Campaign; escrowTada: number }) => {
  const likes = c.live.likes ?? c.submission?.baseline ?? 0;
  const prev = useRef(likes);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (likes !== prev.current) setBump((b) => b + 1);
    prev.current = likes;
  }, [likes]);
  const post = c.submission?.post;
  const paid = c.escrows.filter((e) => e.state === "released").length;
  const top = Math.max(...c.escrows.map((e) => e.threshold), likes, 1);

  return (
    <div className="card overflow-hidden">
      {paid > 0 && (
        <div className="flex items-center gap-2 bg-proof-600 px-6 py-3 text-sm font-semibold text-white">
          <PartyPopper size={18} /> {paid * escrowTada} tADA paid to the creator by the contract{paid === c.escrows.length ? " — every milestone reached" : ""}
        </div>
      )}
      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[auto_1fr]">
        <div className="md:w-56">
          <div className="eyebrow">Likes, signed</div>
          <div key={bump} className={`mt-1 flex items-center gap-2 text-6xl font-extrabold tabular-nums tracking-tight ${bump ? "pop" : ""}`}>
            <Heart className="h-10 w-10 fill-grad-rose text-grad-rose" />
            <span className="text-grad">{likes.toLocaleString()}</span>
          </div>
          <div className="mt-2 space-y-0.5 text-xs text-ink-mute">
            <div className="flex items-center gap-1">
              <FileSignature size={12} /> {c.live.signedCount ? "from the keeper's latest API3-signed response" : "from the signed look at submission"}
            </div>
            {c.live.lastCycleAt && c.status === "live" && (
              <div className="flex items-center gap-1">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-proof-600 text-proof" /> keeper checked {timeOf(c.live.lastCycleAt)}
              </div>
            )}
            {c.submission && <div>baseline at submission: {c.submission.baseline}</div>}
          </div>
        </div>
        <div className="min-w-0 space-y-4">
          {c.escrows.map((e, i) => {
            const pct = Math.min(100, (likes / e.threshold) * 100);
            const m = c.milestones[e.milestone];
            return (
              <div key={i}>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="mr-2 font-bold text-brand-400">{e.milestone + 1}</span>
                    <span className="font-semibold">{m?.label || `Milestone ${e.milestone + 1}`}</span>
                    <span className="ml-2 text-ink-mute">at {e.threshold.toLocaleString()} like{e.threshold === 1 ? "" : "s"} · {escrowTada} tADA</span>
                  </span>
                  {escrowState(e, c.live.escrows[i]?.keeper)}
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full transition-all duration-700 ${e.state === "released" ? "bg-proof-600" : "bg-grad"}`} style={{ width: `${e.state === "released" ? 100 : pct}%` }} />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 text-xs">
                  {e.payTx && (
                    <a className="inline-flex items-center gap-1 text-brand-400 hover:underline" href={scanTx(e.payTx)} target="_blank" rel="noreferrer">
                      lock tx <ExternalLink size={11} />
                    </a>
                  )}
                  {e.releaseTx && (
                    <a className="inline-flex items-center gap-1 font-semibold text-proof hover:underline" href={scanTx(e.releaseTx)} target="_blank" rel="noreferrer">
                      payout tx <ExternalLink size={11} />
                    </a>
                  )}
                  {e.error && <span className="text-red-400">{e.error}</span>}
                </div>
              </div>
            );
          })}
          {c.escrows.length === 0 && <div className="text-sm text-ink-mute">Milestones appear here once the post passes the checks.</div>}
          {top > 0 && c.escrows.length > 0 && c.submission?.deadline && (
            <div className="flex items-center gap-1.5 pt-1 text-xs text-ink-mute">
              <Clock size={12} /> refundable to {c.brand} after {dateTimeOf(c.submission.deadline)}
              {c.submission.measureAfter && ` · counting only data signed after ${timeOf(c.submission.measureAfter)}`}
            </div>
          )}
        </div>
      </div>
      {post && (
        <a href={post.url || c.submission?.postUrl} target="_blank" rel="noreferrer" className="block border-t border-white/10 bg-white/[0.03] px-6 py-4 transition hover:bg-white/5">
          <div className="mb-1 flex items-center gap-2 text-sm">
            <span className="font-bold">{post.authorName || post.handle}</span>
            <span className="text-ink-mute">@{post.handle}</span>
            <span className="text-ink-mute">· {dateTimeOf(post.createdAt)}</span>
            <ExternalLink size={12} className="ml-auto text-ink-mute" />
          </div>
          <p className="line-clamp-3 whitespace-pre-line text-sm text-ink-soft">{post.text}</p>
        </a>
      )}
    </div>
  );
};

const Proof = ({ c, validatorHash, validatorAddress }: { c: Campaign; validatorHash?: string; validatorAddress?: string }) => {
  const s = c.submission;
  const look = s?.look;
  return (
    <div className="card p-6">
      <SectionTitle eyebrow="Proof" title="Check it yourself on Cardano">
        Every payout is a transaction on Cardano preprod that carries the signed response. The contract below did the checking, not this website.
      </SectionTitle>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[11rem_1fr]">
        {validatorHash && (
          <>
            <dt className="text-ink-mute">Contract (script hash)</dt>
            <dd><Hash value={validatorHash} /></dd>
          </>
        )}
        {validatorAddress && (
          <>
            <dt className="text-ink-mute">Contract address</dt>
            <dd><Hash value={validatorAddress} href={scanAddress(validatorAddress)} /></dd>
          </>
        )}
        {s?.requestHash && (
          <>
            <dt className="text-ink-mute">Pinned request</dt>
            <dd><Hash value={s.requestHash} /></dd>
          </>
        )}
        {s?.signer && (
          <>
            <dt className="text-ink-mute">Pinned signer key</dt>
            <dd><Hash value={s.signer} /></dd>
          </>
        )}
        {s?.payee && (
          <>
            <dt className="text-ink-mute">Creator (payee)</dt>
            <dd><Hash value={s.payee} href={scanAddress(s.payee)} /></dd>
          </>
        )}
      </dl>

      {c.escrows.some((e) => e.ref) && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-ink-mute">
              <tr>
                <th className="py-2 pr-4 font-semibold">Milestone</th>
                <th className="py-2 pr-4 font-semibold">Rule in the datum</th>
                <th className="py-2 pr-4 font-semibold">Escrow (lock)</th>
                <th className="py-2 font-semibold">Payout (release)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {c.escrows.map((e, i) => (
                <tr key={i}>
                  <td className="py-2.5 pr-4 font-semibold">{e.milestone + 1}</td>
                  <td className="py-2.5 pr-4 text-ink-soft">likes ≥ {e.threshold}</td>
                  <td className="py-2.5 pr-4">{e.ref ? <Hash value={txOf(e.ref)!} href={scanTx(txOf(e.ref)!)} head={8} tail={4} /> : "—"}</td>
                  <td className="py-2.5">{e.releaseTx ? <Hash value={e.releaseTx} href={scanTx(e.releaseTx)} head={8} tail={4} /> : <span className="text-ink-mute">not yet</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {look?.signature && (
        <details className="mt-5 rounded-xl border border-white/10 p-4">
          <summary className="cursor-pointer text-sm font-semibold">The signed look at the post (API3 AirnodeHub)</summary>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="text-ink-mute">Airnode</dt>
            <dd><Hash value={look.airnode ?? ""} /></dd>
            <dt className="text-ink-mute">Request hash</dt>
            <dd><Hash value={look.requestHash ?? ""} /></dd>
            <dt className="text-ink-mute">Signed at</dt>
            <dd className="text-ink-soft">{look.timestamp ? new Date(Number(look.timestamp) * 1000).toLocaleString() : ""}</dd>
            <dt className="text-ink-mute">Signature</dt>
            <dd><Hash value={look.signature} /></dd>
          </dl>
          <pre className="mono mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/50 p-3 text-[0.72rem] text-slate-100">{look.data}</pre>
        </details>
      )}
    </div>
  );
};

const Checks = ({ c }: { c: Campaign }) =>
  c.submission ? (
    <div className="card p-6">
      <SectionTitle eyebrow="Intake" title="Post checks" />
      <ul className="space-y-2.5">
        {c.submission.checks.map((k) => (
          <li key={k.label} className="flex gap-2.5 text-sm">
            {k.ok ? <CheckCircle2 size={18} className="shrink-0 text-proof" /> : <XCircle size={18} className="shrink-0 text-red-400" />}
            <span>
              <span className="font-semibold">{k.label}</span> <span className="text-ink-mute">· {k.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

export default function CampaignPage() {
  const { id = "" } = useParams();
  const { config } = useConfig();
  const [c, setC] = useState<Campaign>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const next = await api.campaign(id);
        if (!alive) return;
        setC(next);
        setError(undefined);
        const done = next.escrows.length > 0 && next.escrows.every((e) => e.state === "released" || e.state === "failed");
        timer = setTimeout(load, ACTIVE.includes(next.status) && !done ? 2000 : 8000);
      } catch (e) {
        if (!alive) return;
        setError((e as Error).message);
        timer = setTimeout(load, 5000);
      }
    };
    void load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [id]);

  if (!c) return <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">{error ? <ErrorNote>{error}</ErrorNote> : <Loader2 className="animate-spin text-brand-400" />}</div>;

  const escrowTada = config?.escrowTada ?? 5;
  const canSubmit = ["open", "refused", "failed"].includes(c.status);
  const running = c.status === "checking" || c.status === "locking";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link to="/brand" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-mute hover:text-ink">
        <ArrowLeft size={16} /> All campaigns
      </Link>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-brand-400">{c.brand}</div>
          <h1 className="text-3xl font-extrabold tracking-tight">{c.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-mute">
            <span>
              Creator <span className="font-semibold text-ink">@{c.creator}</span>
            </span>
            <span>·</span>
            <span>
              Budget <span className="font-semibold text-ink">{c.milestones.length * escrowTada} tADA</span>
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={14} className="text-proof" /> held by the contract, not by us
            </span>
          </div>
        </div>
        {statusBadge(c)}
      </div>

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      {canSubmit && c.status !== "open" && c.submission && (
        <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {c.status === "refused" ? "The submitted post did not meet the terms (see the checks). Nothing was locked. Fix it and submit again." : "The last submission stopped. You can submit again."}
        </div>
      )}

      {canSubmit ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <SubmitForm c={c} onDone={setC} />
          </div>
          <div className="min-w-0 space-y-6">
            <Offer c={c} escrowTada={escrowTada} />
            <Checks c={c} />
            {c.steps.length > 0 && (
              <div className="card p-6">
                <SectionTitle eyebrow="Activity" title="Last attempt" />
                <Steps steps={c.steps} running={false} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="min-w-0 space-y-6">
            <Tracker c={c} escrowTada={escrowTada} />
            <Proof c={c} validatorHash={config?.validatorHash} validatorAddress={config?.validatorAddress} />
          </div>
          <div className="min-w-0 space-y-6">
            <div className="card p-6">
              <SectionTitle eyebrow="Activity" title={running ? "Working…" : "What happened"} />
              <Steps steps={c.steps} running={running} />
            </div>
            <Checks c={c} />
            <div className="card flex items-start gap-3 p-5 text-sm text-ink-mute">
              <Wallet size={18} className="mt-0.5 shrink-0 text-brand-400" />
              <span>
                Who can move the money: the contract pays the creator when the signed count proves a milestone, whoever submits the release. After the deadline only {c.brand}'s key can take back what is left.
                <BadgeCheck size={14} className="ml-1 inline text-proof" />
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, Download, Info, Plus, Trash2, Upload, Users, X } from "lucide-react";
import { useConfig } from "../App";
import { api, describeError, getAccessCode, scanAddress, setAccessCode, type Campaign } from "../api";
import { Badge, CopyButton, ErrorNote, Hash, SectionTitle, dateTimeOf } from "../components/ui";
import { MAX_CREATORS, extractHandleColumn, parseCreatorList } from "../lib/csv";

export const statusBadge = (c: Campaign) => {
  const paid = c.escrows.filter((e) => e.state === "released").length;
  if (c.status === "live" && paid === c.escrows.length && paid > 0) return <Badge tone="green">All milestones paid</Badge>;
  const map: Record<Campaign["status"], [string, "slate" | "blue" | "green" | "amber" | "red"]> = {
    open: ["Waiting for the post", "slate"],
    checking: ["Checking the post", "blue"],
    locking: ["Locking escrow", "blue"],
    live: [paid > 0 ? `Live · ${paid}/${c.escrows.length} paid` : "Live", "green"],
    refused: ["Post refused", "amber"],
    failed: ["Failed", "red"],
  };
  const [label, tone] = map[c.status];
  return <Badge tone={tone}>{label}</Badge>;
};

const inviteUrl = (id: string) => `${window.location.origin}/c/${id}`;

const CampaignCard = ({ c, highlight }: { c: Campaign; highlight?: boolean }) => (
  <div className={`card p-5 ${highlight ? "ring-2 ring-brand-400/50" : ""}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs font-medium text-ink-mute">
          {c.brand} · created {dateTimeOf(c.createdAt)}
        </div>
        <h3 className="mt-0.5 truncate text-base font-bold">{c.title}</h3>
        <div className="mt-1 text-sm text-ink-soft">
          for <span className="font-semibold">@{c.creator}</span> · {c.posting ? "post goes live + " : ""}
          {c.milestones.length ? `${c.milestones.map((m) => `${c.likesMode === "increase" ? "+" : ""}${m.likes}`).join(" / ")} likes` : "no like milestones"} · {c.budgetTada ?? c.milestones.length * 5} tADA
        </div>
      </div>
      {statusBadge(c)}
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-4">
      {c.status === "open" && (
        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5 pr-3">
          <QRCodeSVG value={inviteUrl(c.id)} size={64} marginSize={2} className="rounded-md bg-white" />
          <div className="text-xs">
            <div className="font-semibold text-ink-soft">Creator invite link</div>
            <div className="mono mt-0.5 max-w-[16rem] truncate text-ink-mute">{inviteUrl(c.id)}</div>
            <CopyButton value={inviteUrl(c.id)} label="Copy link" />
          </div>
        </div>
      )}
      <Link to={`/c/${c.id}`} className="btn-ghost ml-auto">
        Open campaign <ArrowRight size={16} />
      </Link>
    </div>
  </div>
);

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

/** Campaigns created in one import: one row per creator, with the invite links ready to send. */
const GroupCard = ({ list, highlight }: { list: Campaign[]; highlight: boolean }) => {
  const first = list[0];
  const live = list.filter((c) => c.status === "live").length;
  const waiting = list.filter((c) => c.status === "open").length;
  const links = list.map((c) => `@${c.creator}\t${inviteUrl(c.id)}`).join("\n");
  const download = () => {
    const rows = ["handle,invite_link,campaign_id", ...list.map((c) => [c.creator, inviteUrl(c.id), c.id].map(csvCell).join(","))];
    const url = URL.createObjectURL(new Blob([`${rows.join("\n")}\n`], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `creatorpay-${first.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30) || "invites"}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className={`card p-5 ${highlight ? "ring-2 ring-brand-400/50" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-ink-mute">
            {first.brand} · created {dateTimeOf(first.createdAt)}
          </div>
          <h3 className="mt-0.5 truncate text-base font-bold">{first.title}</h3>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
            <Users size={14} /> {list.length} creators · {first.budgetTada ?? first.milestones.length * 5} tADA each · {list.length * (first.budgetTada ?? first.milestones.length * 5)} tADA in all
          </div>
          <div className="mt-0.5 text-xs text-ink-mute">
            {waiting} waiting for a post · {live} live · {list.length - waiting - live} other
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <CopyButton value={links} label="Copy all links" />
          <button type="button" onClick={download} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-ink-mute hover:bg-white/10 hover:text-ink">
            <Download size={14} /> CSV
          </button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-ink-mute">
            <tr>
              <th className="py-2 pr-3 font-semibold">Creator</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
              <th className="py-2 pr-3 font-semibold">Invite link</th>
              <th className="py-2 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {list.map((c) => (
              <tr key={c.id}>
                <td className="py-2.5 pr-3 font-semibold">@{c.creator}</td>
                <td className="py-2.5 pr-3">{statusBadge(c)}</td>
                <td className="py-2.5 pr-3">
                  <CopyButton value={inviteUrl(c.id)} label="Copy link" />
                </td>
                <td className="py-2.5 text-right">
                  <Link to={`/c/${c.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-brand-400 hover:underline">
                    Open <ArrowRight size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function Brand() {
  const { config } = useConfig();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string>();
  const [created, setCreated] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<{ row: number; handle: string; reason: string }[]>([]);
  const [creatorsText, setCreatorsText] = useState("");
  const [access, setAccess] = useState(getAccessCode);
  const [importNote, setImportNote] = useState<string>();
  const [posting, setPosting] = useState({ on: true, units: 1, label: "Post goes live" });
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    brand: "",
    title: "",
    brief: "",
    likesMode: "increase" as "increase" | "absolute",
    durationMinutes: 60,
    maxPostAgeHours: 24,
    measureAtEnd: false,
    measureLastMinutes: 15,
    tags: "",
  });
  const [milestones, setMilestones] = useState<{ likes: number; label: string; units: number }[]>([
    { likes: 1, label: "First like", units: 1 },
    { likes: 2, label: "Second like", units: 1 },
    { likes: 3, label: "Third like", units: 1 },
  ]);
  const parsed = useMemo(() => parseCreatorList(creatorsText), [creatorsText]);
  const items = useMemo(() => {
    const out: ({ kind: "group"; id: string; list: Campaign[] } | { kind: "single"; c: Campaign })[] = [];
    const seen = new Set<string>();
    for (const c of campaigns) {
      if (!c.groupId) out.push({ kind: "single", c });
      else if (!seen.has(c.groupId)) {
        seen.add(c.groupId);
        const list = campaigns.filter((x) => x.groupId === c.groupId);
        out.push(list.length > 1 ? { kind: "group", id: c.groupId, list } : { kind: "single", c });
      }
    }
    return out;
  }, [campaigns]);

  const load = () => api.campaigns().then(setCampaigns).catch((e: unknown) => setError(describeError(e)));
  useEffect(() => {
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (config && !form.tags) setForm((f) => ({ ...f, tags: config.defaultDisclosure.slice(0, 3).join(", ") }));
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const escrowTada = config?.escrowTada ?? 5;
  const maxMilestones = config?.maxMilestones ?? 3;
  const unitsPerCreator = (posting.on ? posting.units : 0) + milestones.reduce((n, m) => n + m.units, 0);
  const MAX_ESCROWS = 8;
  const tooMany = parsed.handles.length > MAX_CREATORS;
  const tooBig = unitsPerCreator > MAX_ESCROWS || unitsPerCreator === 0;
  const problem = parsed.handles.length === 0 ? "Add at least one creator handle." : tooMany ? `At most ${MAX_CREATORS} creators per import: split the list.` : unitsPerCreator === 0 ? "Pay for something: the posting payment or at least one like milestone." : tooBig ? `At most ${MAX_ESCROWS} escrows (${MAX_ESCROWS * escrowTada} tADA) per creator.` : undefined;

  const importFile = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    if (file.size > 500_000) return setImportNote("That file is too large for a creator list (500 KB at most).");
    const { values, column } = extractHandleColumn(await file.text());
    setCreatorsText((t) => [t.trim(), ...values].filter(Boolean).join("\n"));
    setImportNote(`Read ${values.length} row${values.length === 1 ? "" : "s"} from ${file.name}${column ? ` (column "${column}")` : " (first column)"}. Check the list below.`);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (problem) return setError(problem);
    if (config?.accessRequired && !access.trim()) return setError("Enter the team access code.");
    setAccessCode(access.trim());
    setBusy(true);
    setError(undefined);
    try {
      const base = {
        brand: form.brand,
        title: form.title,
        brief: form.brief,
        likesMode: form.likesMode,
        durationMinutes: Number(form.durationMinutes),
        maxPostAgeHours: Number(form.maxPostAgeHours),
        ...(form.measureAtEnd ? { measureLastMinutes: Number(form.measureLastMinutes) } : {}),
        disclosure: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        ...(posting.on ? { posting: { units: posting.units, ...(posting.label.trim() ? { label: posting.label.trim() } : {}) } } : {}),
        milestones: milestones.map((m) => ({ likes: Number(m.likes), label: m.label, ...(m.units > 1 ? { units: m.units } : {}) })),
      };
      if (parsed.handles.length === 1) {
        const c = await api.createCampaign({ ...base, creator: parsed.handles[0] });
        setCreated([c.id]);
        setSkipped([]);
      } else {
        const r = await api.createCampaigns({ ...base, creators: parsed.handles });
        setCreated(r.campaigns.map((c) => c.id));
        setSkipped(r.skipped);
      }
      setCreatorsText("");
      setImportNote(undefined);
      await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-1.5">Brand console</div>
          <h1 className="text-3xl font-extrabold tracking-tight">Pay for results you can verify</h1>
          <p className="mt-2 max-w-2xl text-ink-mute">
            State what the creator must post and which milestones you pay for. Each milestone is one {escrowTada} tADA escrow, locked from your wallet the moment the creator submits the post, and refunded to
            you if the milestone is not reached in time.
          </p>
        </div>
        {config?.brandWallet && (
          <div className="card px-4 py-3 text-xs">
            <div className="font-semibold text-ink-soft">Brand wallet (pays the escrows, gets refunds)</div>
            <Hash value={config.brandWallet} href={scanAddress(config.brandWallet)} />
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <form onSubmit={submit} className="card min-w-0 space-y-6 p-5 sm:p-6">
          <SectionTitle eyebrow="New campaign" title="The deal" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="brand">Brand</label>
              <input id="brand" className="input" required placeholder="Acme Sneakers" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="title">Campaign</label>
              <input id="title" className="input" required placeholder="Autumn drop launch post" value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="brief">Brief for the creator</label>
            <textarea id="brief" className="input min-h-[80px]" placeholder="One post about the drop, your own words, tag us, mark it as an ad." value={form.brief} onChange={(e) => set("brief", e.target.value)} />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label className="label mb-0" htmlFor="creators">Creators on X</label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-brand-400 hover:bg-white/10 focus-within:ring-2 focus-within:ring-brand-400">
                <Upload size={14} /> Import CSV
                <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={(ev) => void importFile(ev)} />
              </label>
            </div>
            <textarea id="creators" className="input min-h-[104px] font-mono text-[0.85rem]" placeholder={"@anna_creates\n@ben_reels\n@cara_ugc"} value={creatorsText} onChange={(e) => setCreatorsText(e.target.value)} />
            <p className="hint">One handle per line (commas work too). A CSV needs a column named handle, or the handles in its first column. Only a post by that account can be paid, and every creator gets their own invite link.</p>
            {importNote && <p className="mt-1 text-xs text-brand-300">{importNote}</p>}
            <p className="mt-1 text-sm">
              <span className="font-semibold">{parsed.handles.length}</span> creator{parsed.handles.length === 1 ? "" : "s"}
              {parsed.duplicates.length > 0 && <span className="ml-2 text-amber-300">{parsed.duplicates.length} duplicate{parsed.duplicates.length === 1 ? "" : "s"} ignored</span>}
              {parsed.invalid.length > 0 && (
                <span className="ml-2 text-amber-300" title={parsed.invalid.join("\n")}>
                  {parsed.invalid.length} not an X handle: {parsed.invalid.slice(0, 3).join(", ")}
                  {parsed.invalid.length > 3 ? "…" : ""}
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="label" htmlFor="tags">Disclosure tag (one of)</label>
            <input id="tags" className="input" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
            <p className="hint">Paid posts must say they are paid.</p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label mb-0">Budget split per creator</span>
              <div className="flex rounded-lg bg-white/10 p-0.5 text-xs font-semibold">
                {(["increase", "absolute"] as const).map((m) => (
                  <button type="button" key={m} onClick={() => set("likesMode", m)} className={`rounded-md px-2.5 py-1 ${form.likesMode === m ? "bg-white/15 text-ink" : "text-ink-mute"}`}>
                    {m === "increase" ? "New likes" : "Total likes"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg bg-brand-500/15" title="Pay a part of the budget as soon as the post is live">
                  <input type="checkbox" className="h-4 w-4 accent-[#d33d6a]" checked={posting.on} onChange={(e) => setPosting((p) => ({ ...p, on: e.target.checked }))} aria-label="Posting payment" />
                </label>
                <input className="input min-w-0 flex-1" placeholder="Post goes live" disabled={!posting.on} value={posting.label} onChange={(e) => setPosting((p) => ({ ...p, label: e.target.value }))} />
                <span className="w-32 shrink-0 text-xs text-ink-mute sm:w-40">paid when the post is live, no like needed</span>
                <select className="input w-24 shrink-0" disabled={!posting.on} value={posting.units} onChange={(e) => setPosting((p) => ({ ...p, units: Number(e.target.value) }))} aria-label="Escrows for the posting payment">
                  {[1, 2, 3].map((u) => (
                    <option key={u} value={u}>{u} × {escrowTada}</option>
                  ))}
                </select>
                <span className="w-20 shrink-0 text-right text-sm font-semibold text-ink-soft">{posting.on ? posting.units * escrowTada : 0} tADA</span>
                <span className="w-9 shrink-0" />
              </div>
              {milestones.map((m, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-xs font-bold text-brand-400">{i + 1}</span>
                  <input className="input min-w-0 flex-1" placeholder="Label" value={m.label} onChange={(e) => setMilestones((ms) => ms.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <div className="relative w-32 shrink-0 sm:w-40">
                    <input
                      type="number"
                      min={1}
                      required
                      className="input pr-12"
                      value={m.likes}
                      onChange={(e) => setMilestones((ms) => ms.map((x, j) => (j === i ? { ...x, likes: Number(e.target.value) } : x)))}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-mute">likes</span>
                  </div>
                  <select className="input w-24 shrink-0" value={m.units} onChange={(e) => setMilestones((ms) => ms.map((x, j) => (j === i ? { ...x, units: Number(e.target.value) } : x)))} aria-label={`Escrows for milestone ${i + 1}`}>
                    {[1, 2, 3].map((u) => (
                      <option key={u} value={u}>{u} × {escrowTada}</option>
                    ))}
                  </select>
                  <span className="w-20 shrink-0 text-right text-sm font-semibold text-ink-soft">{m.units * escrowTada} tADA</span>
                  <button type="button" disabled={milestones.length === 1 && !posting.on} onClick={() => setMilestones((ms) => ms.filter((_, j) => j !== i))} className="rounded-lg p-2 text-ink-mute hover:bg-white/10 disabled:opacity-30" title="Remove">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button type="button" disabled={milestones.length >= maxMilestones} onClick={() => setMilestones((ms) => [...ms, { likes: (ms[ms.length - 1]?.likes ?? 0) + 1, label: "", units: 1 }])} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-400 disabled:opacity-40">
                <Plus size={16} /> Add milestone
              </button>
              <span className="text-sm text-ink-mute">
                Per creator <span className="font-bold text-ink">{unitsPerCreator * escrowTada} tADA</span>
                {parsed.handles.length > 1 && (
                  <>
                    {" "}· all {parsed.handles.length} <span className="font-bold text-ink">{parsed.handles.length * unitsPerCreator * escrowTada} tADA</span>
                  </>
                )}
              </span>
            </div>
            <p className="hint">
              Each unit is one {escrowTada} tADA escrow, locked from your wallet when that creator submits the post and refunded to you if it is not earned in time.{" "}
              {form.likesMode === "increase" ? "Likes count on top of the likes the post has when it is submitted, so an already popular post does not qualify by itself." : "Likes are the post's total like count."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="dur">Campaign length (minutes)</label>
              <input id="dur" type="number" min={15} max={11520} className="input" value={form.durationMinutes} onChange={(e) => set("durationMinutes", Number(e.target.value))} />
              <p className="hint">After this, unpaid milestones are refundable to you.</p>
            </div>
            <div>
              <label className="label" htmlFor="age">Post must be at most (hours old)</label>
              <input id="age" type="number" min={1} className="input" value={form.maxPostAgeHours} onChange={(e) => set("maxPostAgeHours", Number(e.target.value))} />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-3.5">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#d33d6a]" checked={form.measureAtEnd} onChange={(e) => set("measureAtEnd", e.target.checked)} />
            <span className="text-sm">
              <span className="font-semibold">Measure only at the end</span>
              <span className="block text-ink-mute">
                Count only data signed in the last{" "}
                <input type="number" min={10} className="mx-1 w-16 rounded-md border border-white/10 px-1.5 py-0.5 text-sm" value={form.measureLastMinutes} onChange={(e) => set("measureLastMinutes", Number(e.target.value))} /> minutes,
                so a bought boost mid-campaign does not count. Off: each milestone pays as soon as it is reached.
              </span>
            </span>
          </label>

          {config?.accessRequired && (
            <div>
              <label className="label" htmlFor="access">Team access code</label>
              <input id="access" type="password" autoComplete="off" className="input" placeholder="Ask your team" value={access} onChange={(e) => setAccess(e.target.value)} />
              <p className="hint">Needed to create campaigns on this service. A creator who opens an invite link does not need it.</p>
            </div>
          )}
          {error && <ErrorNote>{error}</ErrorNote>}
          <button className="btn-primary w-full py-3" disabled={busy || Boolean(problem && parsed.handles.length > 0)}>
            {busy ? "Creating…" : parsed.handles.length > 1 ? `Create ${parsed.handles.length} campaigns and get the invite links` : "Create campaign and get the creator link"}
          </button>
          <p className="flex items-start gap-2 text-xs text-ink-mute">
            <Info size={14} className="mt-0.5 shrink-0" />
            The escrow pins the exact post id, so it is locked after the creator posts and submits the link, not before. Testnet: tADA on Cardano preprod, data paid in test aUSD on Base Sepolia.
          </p>
        </form>

        <div className="min-w-0">
          <SectionTitle eyebrow="Your campaigns" title={campaigns.length ? `${campaigns.length} campaign${campaigns.length > 1 ? "s" : ""}` : "No campaigns yet"}>
            Only the campaigns created in this browser are listed. Creators open theirs from the invite link.
          </SectionTitle>
          {created.length > 0 && (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-proof/30 bg-proof/10 px-4 py-3 text-sm text-proof">
              <span>
                {created.length === 1 ? "Campaign created. Send the invite link to the creator, or open it to follow along." : `${created.length} campaigns created. Copy the invite links or download them as a CSV, and send each creator their own link.`}
                {skipped.length > 0 && (
                  <span className="mt-1 block text-amber-300">
                    Skipped {skipped.length}: {skipped.slice(0, 4).map((s) => `${s.handle || "(empty)"} (${s.reason})`).join("; ")}
                    {skipped.length > 4 ? "…" : ""}
                  </span>
                )}
              </span>
              <button onClick={() => { setCreated([]); setSkipped([]); }} className="shrink-0" aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          )}
          <div className="space-y-4">
            {items.map((item) =>
              item.kind === "group" ? (
                <GroupCard key={item.id} list={item.list} highlight={item.list.some((c) => created.includes(c.id))} />
              ) : (
                <CampaignCard key={item.c.id} c={item.c} highlight={created.includes(item.c.id)} />
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, Info, Plus, Trash2, X } from "lucide-react";
import { useConfig } from "../App";
import { api, scanAddress, type Campaign } from "../api";
import { Badge, CopyButton, ErrorNote, Hash, SectionTitle, dateTimeOf } from "../components/ui";

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
          for <span className="font-semibold">@{c.creator}</span> · {c.milestones.length} milestone{c.milestones.length > 1 ? "s" : ""} ·{" "}
          {c.milestones.map((m) => `${c.likesMode === "increase" ? "+" : ""}${m.likes}`).join(" / ")} likes
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

export default function Brand() {
  const { config } = useConfig();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string>();
  const [created, setCreated] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    brand: "",
    title: "",
    brief: "",
    creator: "",
    likesMode: "increase" as "increase" | "absolute",
    durationMinutes: 60,
    maxPostAgeHours: 24,
    measureAtEnd: false,
    measureLastMinutes: 15,
    tags: "",
  });
  const [milestones, setMilestones] = useState<{ likes: number; label: string }[]>([
    { likes: 1, label: "First traction" },
    { likes: 3, label: "Takes off" },
  ]);

  const load = () => api.campaigns().then(setCampaigns).catch((e: Error) => setError(e.message));
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const c = await api.createCampaign({
        brand: form.brand,
        title: form.title,
        brief: form.brief,
        creator: form.creator,
        likesMode: form.likesMode,
        durationMinutes: Number(form.durationMinutes),
        maxPostAgeHours: Number(form.maxPostAgeHours),
        ...(form.measureAtEnd ? { measureLastMinutes: Number(form.measureLastMinutes) } : {}),
        disclosure: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        milestones: milestones.map((m) => ({ likes: Number(m.likes), label: m.label })),
      });
      setCreated(c.id);
      await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError((err as Error).message);
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="creator">Creator on X</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-mute">@</span>
                <input id="creator" className="input pl-8" required placeholder="handle" value={form.creator} onChange={(e) => set("creator", e.target.value.replace(/^@/, ""))} />
              </div>
              <p className="hint">Only a post by this account can be paid.</p>
            </div>
            <div>
              <label className="label" htmlFor="tags">Disclosure tag (one of)</label>
              <input id="tags" className="input" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
              <p className="hint">Paid posts must say they are paid.</p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label mb-0">Milestones</span>
              <div className="flex rounded-lg bg-white/10 p-0.5 text-xs font-semibold">
                {(["increase", "absolute"] as const).map((m) => (
                  <button type="button" key={m} onClick={() => set("likesMode", m)} className={`rounded-md px-2.5 py-1 ${form.likesMode === m ? "bg-white/15 text-ink" : "text-ink-mute"}`}>
                    {m === "increase" ? "New likes" : "Total likes"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
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
                  <span className="w-20 shrink-0 text-right text-sm font-semibold text-ink-soft">{escrowTada} tADA</span>
                  <button type="button" disabled={milestones.length === 1} onClick={() => setMilestones((ms) => ms.filter((_, j) => j !== i))} className="rounded-lg p-2 text-ink-mute hover:bg-white/10 disabled:opacity-30" title="Remove">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button type="button" disabled={milestones.length >= maxMilestones} onClick={() => setMilestones((ms) => [...ms, { likes: (ms[ms.length - 1]?.likes ?? 0) * 2 || 1, label: "" }])} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-400 disabled:opacity-40">
                <Plus size={16} /> Add milestone
              </button>
              <span className="text-sm text-ink-mute">
                Budget <span className="font-bold text-ink">{milestones.length * escrowTada} tADA</span>
              </span>
            </div>
            <p className="hint">{form.likesMode === "increase" ? "Counted on top of the likes the post has when it is submitted, so an already popular post does not qualify by itself." : "The post's total like count."}</p>
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

          {error && <ErrorNote>{error}</ErrorNote>}
          <button className="btn-primary w-full py-3" disabled={busy}>
            {busy ? "Creating…" : "Create campaign and get the creator link"}
          </button>
          <p className="flex items-start gap-2 text-xs text-ink-mute">
            <Info size={14} className="mt-0.5 shrink-0" />
            The escrow pins the exact post id, so it is locked after the creator posts and submits the link, not before. Testnet: tADA on Cardano preprod, data paid in test aUSD on Base Sepolia.
          </p>
        </form>

        <div className="min-w-0">
          <SectionTitle eyebrow="Your campaigns" title={campaigns.length ? `${campaigns.length} campaign${campaigns.length > 1 ? "s" : ""}` : "No campaigns yet"} />
          {created && (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-proof/30 bg-proof/10 px-4 py-3 text-sm text-proof">
              <span>Campaign created. Send the invite link to the creator, or open it to follow along.</span>
              <button onClick={() => setCreated(undefined)} className="shrink-0">
                <X size={16} />
              </button>
            </div>
          )}
          <div className="space-y-4">
            {campaigns.map((c) => (
              <CampaignCard key={c.id} c={c} highlight={c.id === created} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

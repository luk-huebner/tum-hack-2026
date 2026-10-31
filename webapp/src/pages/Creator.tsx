import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Inbox } from "lucide-react";
import { api, type Campaign } from "../api";
import { ErrorNote, SectionTitle } from "../components/ui";
import { statusBadge } from "./Brand";

export default function Creator() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string>();
  const [link, setLink] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    api.campaigns().then(setCampaigns).catch((e: Error) => setError(e.message));
  }, []);
  const open = (e: FormEvent) => {
    e.preventDefault();
    const id = /\/c\/([\w-]+)/.exec(link)?.[1] ?? link.trim();
    if (id) navigate(`/c/${id}`);
  };
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="eyebrow mb-1.5">Creators</div>
      <h1 className="text-3xl font-extrabold tracking-tight">Your offers</h1>
      <p className="mt-2 text-ink-mute">Open the link the brand sent you, check the money is there, post, and submit the link. You are paid by the contract when your post reaches each milestone.</p>
      <form onSubmit={open} className="card mt-6 flex flex-col gap-3 p-4 sm:flex-row">
        <input className="input" placeholder="Paste your invite link or campaign id" value={link} onChange={(e) => setLink(e.target.value)} />
        <button className="btn-primary shrink-0">Open offer</button>
      </form>
      <div className="mt-10">
        <SectionTitle title="Open campaigns on this server" />
        {error && <ErrorNote>{error}</ErrorNote>}
        {campaigns.length === 0 && !error && (
          <div className="card flex items-center gap-3 p-6 text-sm text-ink-mute">
            <Inbox size={18} /> No campaigns yet. A brand creates one in the brand console.
          </div>
        )}
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Link key={c.id} to={`/c/${c.id}`} className="card flex items-center justify-between gap-4 p-4 transition hover:border-brand-400/40">
              <div className="min-w-0">
                <div className="text-xs text-ink-mute">{c.brand}</div>
                <div className="truncate font-bold">{c.title}</div>
                <div className="text-sm text-ink-soft">for @{c.creator} · {c.milestones.length * 5} tADA</div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {statusBadge(c)}
                <ArrowRight size={16} className="text-ink-mute" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

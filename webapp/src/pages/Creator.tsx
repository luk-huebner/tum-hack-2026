import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Inbox, Loader2, Search } from "lucide-react";
import { api, describeError, type Campaign } from "../api";
import { ErrorNote, SectionTitle } from "../components/ui";
import { statusBadge } from "./Brand";

// A creator reaches an offer with the invite link the brand sent, or finds the campaigns that already pay their wallet or one of their
// posts. There is deliberately no list of everybody's campaigns.
export default function Creator() {
  const [link, setLink] = useState("");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Campaign[]>();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string>();
  const navigate = useNavigate();

  const open = (e: FormEvent) => {
    e.preventDefault();
    const id = /\/c\/([\w-]+)/.exec(link)?.[1] ?? link.trim();
    if (id) navigate(`/c/${id}`);
  };

  const find = async (e?: FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(undefined);
    try {
      setFound(await api.creator(q.startsWith("addr_test1") ? { wallet: q } : { post: q }));
    } catch (err) {
      setFound(undefined);
      setError(describeError(err));
    } finally {
      setSearching(false);
    }
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
        <SectionTitle title="Already submitted a post?">Find your campaigns and see which milestones were reached. Use the payout wallet you gave, or the link to your post.</SectionTitle>
        <form onSubmit={find} className="card flex flex-col gap-3 p-4 sm:flex-row">
          <input className="input" placeholder="addr_test1… or https://x.com/you/status/…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn-ghost shrink-0" disabled={searching}>
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Find my campaigns
          </button>
        </form>

        {error && (
          <div className="mt-4 space-y-3">
            <ErrorNote>{error}</ErrorNote>
            <button className="btn-ghost" onClick={() => void find()}>
              Try again
            </button>
          </div>
        )}
        {found && found.length === 0 && !error && (
          <div className="card mt-4 flex items-center gap-3 p-6 text-sm text-ink-mute">
            <Inbox size={18} /> No campaign found for this wallet or post. If a brand sent you an offer you have not answered yet, open it with its invite link above.
          </div>
        )}
        <div className="mt-4 space-y-3">
          {found?.map((c) => (
            <Link key={c.id} to={`/c/${c.id}`} className="card flex items-center justify-between gap-4 p-4 transition hover:border-brand-400/40">
              <div className="min-w-0">
                <div className="text-xs text-ink-mute">{c.brand}</div>
                <div className="truncate font-bold">{c.title}</div>
                <div className="text-sm text-ink-soft">
                  {c.escrows.filter((e) => e.state === "released").length} of {c.escrows.length || c.milestones.length} paid · {c.budgetTada ?? c.milestones.length * 5} tADA
                </div>
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

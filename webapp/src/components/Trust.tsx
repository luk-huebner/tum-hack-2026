import { Link } from "react-router-dom";
import { ArrowRight, FileSignature, Link2, Lock, ShieldCheck, TriangleAlert } from "lucide-react";

// What is checked, by what, and what is still trusted. Every line here is a claim the repo backs: TRUST.md, AUDIT.md and the
// tamper bench on /verify. The last card is the honest one on purpose.
const proofs = [
  {
    icon: FileSignature,
    title: "The data is signed at the source",
    text: "The like count comes from API3's AirnodeHub, signed by the Airnode's own key. The contract verifies that signature itself, on chain, against a key fixed when the payout is locked. An edited number, an old response, an answer about another post or a stranger's key is rejected.",
  },
  {
    icon: Link2,
    title: "Each payout is pinned to one post",
    text: "The author's id, the creation time, the post id and \"not a reply\" are part of the signed text. Only a signed answer about exactly that post can pay, so a different post cannot.",
  },
  {
    icon: Lock,
    title: "Nobody holds the money",
    text: "The payout sits in the contract, not with the brand and not with us. Only a valid proof pays the creator. After the deadline only the brand's own key can take back what was not earned.",
  },
];

const limits = [
  "A signature proves what the data provider said, not that every like is genuine. We measure at the end and pay on the increase to make bought likes less useful; we do not claim to remove them.",
  "You still trust the Airnode's signing key. It is pinned when the payout is locked, but there is no on-chain key registry or rotation yet.",
  "Testnet only (Cardano preprod, Base Sepolia) and not externally audited yet. That is why it is built to be checked, below.",
];

export default function Trust() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <div className="eyebrow mb-3">Why you can trust it</div>
        <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          Safe because of what you <span className="text-grad">don't have to trust.</span>
        </h2>
        <p className="mt-4 text-ink-soft">Not "trust us" and not "trust the website": the contract checks the proof, and anyone can ask it.</p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {proofs.map((p) => (
          <div key={p.title} className="card p-6">
            <p.icon className="mb-4 text-brand-300" size={24} />
            <h3 className="mb-2 text-lg font-bold">{p.title}</h3>
            <p className="text-sm leading-relaxed text-ink-mute">{p.text}</p>
          </div>
        ))}
      </div>

      <div className="card mt-6 border-amber-400/25 p-6">
        <div className="mb-3 flex items-center gap-2 text-amber-300">
          <TriangleAlert size={18} />
          <h3 className="text-lg font-bold text-ink">What you still have to trust</h3>
        </div>
        <ul className="grid gap-3 text-sm leading-relaxed text-ink-mute lg:grid-cols-3">
          {limits.map((l) => (
            <li key={l} className="flex gap-2">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
              {l}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link to="/verify" className="btn-primary px-5 py-3">
          <ShieldCheck size={18} /> Try to cheat the contract
        </Link>
        <Link to="/engine" className="btn-ghost px-5 py-3">
          See what the engine is doing <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

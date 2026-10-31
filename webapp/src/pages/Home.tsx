import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Building2, FileSignature, Lock, ShieldCheck, Sparkles, UserRound, Wallet } from "lucide-react";
import { useConfig } from "../App";
import { scanAddress } from "../api";
import { Hash } from "../components/ui";
import Trust from "../components/Trust";

const flow = [
  { icon: Building2, title: "The brand sets the terms", text: "Which creator, which disclosure tag, which like milestones, and what each one pays. No money moves yet: the deal waits for the post." },
  { icon: UserRound, title: "The creator posts and submits the link", text: "With a wallet address. One API3-signed look at the post proves who wrote it, that it is new, not a reply, and says #ad." },
  { icon: Lock, title: "The payout is locked in the contract", text: "The brand pays each milestone by x402 straight into the Aiken validator. Nobody holds the money in between, not even us." },
  { icon: FileSignature, title: "Signed likes, not screenshots", text: "Every few seconds the keeper fetches the like count, signed by the TwitterAPI.io Airnode on API3 AirnodeHub." },
  { icon: Wallet, title: "The contract pays the creator", text: "The validator checks the signer, the request, the age and the milestone, then pays the creator. Missed deadline: the brand takes it back." },
];

// Measured on Cardano preprod and in CI; see PROOFS.md
const numbers = [
  { value: "~2 s", label: "from a like to a signed count that shows it" },
  { value: "53 s", label: "from a like to the payout transaction" },
  { value: "4 / 4", label: "tampered responses rejected by the contract" },
  { value: "78", label: "contract tests, real signed responses as vectors" },
];

const roles = [
  { to: "/brand", icon: Building2, title: "For brands", text: "Pay only for results you can verify. What is not reached comes back to you after the deadline, enforced by the contract.", cta: "Create a campaign" },
  { to: "/creator", icon: UserRound, title: "For creators", text: "See the money is locked before you post. Get paid the moment your post reaches a milestone, straight to your wallet.", cta: "Open your offer" },
  { to: "/verify", icon: ShieldCheck, title: "For anyone checking", text: "Send real and tampered signed responses to the live contract and read its own verdict. See everything locked right now.", cta: "Verify the contract" },
];

const Glow = ({ className }: { className: string }) => <div aria-hidden className={`pointer-events-none absolute -z-10 rounded-full blur-3xl ${className}`} />;

export default function Home() {
  const { config } = useConfig();
  return (
    <div className="relative isolate overflow-hidden">
      {/* hero */}
      <section className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:pb-24 lg:pt-24">
        <Glow className="-left-40 top-10 h-96 w-96 bg-grad-orange/20" />
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/15 px-3 py-1 text-xs font-semibold text-brand-300">
            <Sparkles size={14} /> Outcome-based creator payments on Cardano
          </div>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl xl:text-[3.5rem]">
            Pay creators on <span className="text-grad">proof</span>, not on promises.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            Brands lock the payout for a post in a Cardano contract. When API3-signed data shows the post hit its milestone, the contract pays the creator by itself. No invoices, no screenshots, no chasing.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/brand" className="btn-primary px-5 py-3">
              <Building2 size={18} /> I'm a brand: start a campaign
            </Link>
            <Link to="/creator" className="btn-ghost px-5 py-3">
              <UserRound size={18} /> I'm a creator
            </Link>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-mute">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-proof" /> Tamper-tested contract
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck size={16} className="text-proof" /> Every payout on Cardanoscan
            </span>
          </div>
        </div>

        <div className="card self-center p-6 lg:rotate-[1.5deg]">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold">Example campaign</span>
            <span className="rounded-full bg-proof/10 px-2.5 py-0.5 text-xs font-semibold text-proof">Live</span>
          </div>
          <div className="mb-1 text-xs text-ink-mute">@creator · post with #ad</div>
          <div className="mb-5 flex items-end gap-2">
            <span className="text-grad text-6xl font-extrabold tabular-nums tracking-tight">1,240</span>
            <span className="mb-2 text-sm text-ink-mute">signed likes</span>
          </div>
          {[
            { n: 500, paid: true },
            { n: 1000, paid: true },
            { n: 5000, paid: false },
          ].map((m) => (
            <div key={m.n} className="mb-3">
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-ink-soft">{m.n.toLocaleString()} likes</span>
                <span className={m.paid ? "font-semibold text-proof" : "text-ink-mute"}>{m.paid ? "Paid 5 tADA" : "Locked 5 tADA"}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${m.paid ? "bg-proof-600" : "bg-grad"}`} style={{ width: `${Math.min(100, (1240 / m.n) * 100)}%` }} />
              </div>
            </div>
          ))}
          <p className="mt-4 text-xs text-ink-mute">Illustration. Real campaigns show their own transactions.</p>
        </div>
      </section>

      {/* how it works: one continuous line down the page */}
      <section className="relative mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6">
        <Glow className="-right-48 top-1/3 h-[28rem] w-[28rem] bg-grad-violet/20" />
        <div className="mb-14 text-center">
          <div className="eyebrow mb-3">How it works</div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">From brief to payout, without trusting anyone</h2>
        </div>
        <div className="relative">
          <div aria-hidden className="absolute bottom-6 left-[1.35rem] top-6 w-px bg-gradient-to-b from-grad-amber via-grad-rose to-grad-violet opacity-70 sm:left-1/2" />
          <ol className="space-y-14">
            {flow.map((f, i) => (
              <li key={f.title} className={`relative flex gap-6 sm:w-1/2 ${i % 2 ? "sm:ml-auto sm:pl-12" : "sm:flex-row-reverse sm:pr-12 sm:text-right"}`}>
                <span
                  className={`relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-night ring-1 ring-white/15 sm:absolute sm:top-0 ${i % 2 ? "sm:-left-[1.375rem]" : "sm:-right-[1.375rem]"}`}
                >
                  <f.icon size={18} className="text-brand-300" />
                </span>
                <div>
                  <div className="text-grad mb-1 inline-block text-sm font-extrabold tracking-widest">0{i + 1}</div>
                  <h3 className="mb-2 text-xl font-bold">{f.title}</h3>
                  <p className="leading-relaxed text-ink-mute">{f.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* the numbers */}
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Glow className="left-1/4 top-0 h-80 w-[36rem] bg-grad-rose/15" />
        <h2 className="mx-auto max-w-3xl text-center text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          The contract does the checking. <span className="text-grad">Not this website, not us.</span>
        </h2>
        <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {numbers.map((n) => (
            <div key={n.label} className="text-center">
              <div className="text-grad inline-block text-5xl font-extrabold tabular-nums tracking-tight">{n.value}</div>
              <div className="mx-auto mt-2 max-w-[14rem] text-sm text-ink-mute">{n.label}</div>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-ink-mute">Measured on Cardano preprod and in CI. A signature proves what the API returned, not that every like is genuine: measuring at the end and paying on the increase make buying likes not worth it.</p>
      </section>

      <Trust />

      {/* who it is for */}
      <section className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-3">
          {roles.map((r) => (
            <Link key={r.to} to={r.to} className="group">
              <r.icon className="mb-4 text-brand-300" size={26} />
              <h3 className="mb-2 text-xl font-bold">{r.title}</h3>
              <p className="leading-relaxed text-ink-mute">{r.text}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-300">
                {r.cta} <ArrowRight size={16} className="transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* closing call to action */}
      <section className="relative mx-auto max-w-4xl px-4 pb-24 pt-16 text-center sm:px-6">
        <Glow className="left-1/2 top-1/2 h-72 w-[40rem] -translate-x-1/2 -translate-y-1/2 bg-grad-violet/20" />
        <h2 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Your next campaign, <span className="text-grad">paid on proof.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-soft">Set the terms in a minute. The creator posts. The contract does the rest.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link to="/brand" className="btn-primary px-6 py-3">
            Start a campaign <ArrowRight size={18} />
          </Link>
          <Link to="/verify" className="btn-ghost px-6 py-3">
            <ShieldCheck size={18} /> Check the contract first
          </Link>
        </div>
        {config && (
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-mute">
            <span>
              script hash <Hash value={config.validatorHash} />
            </span>
            <span>
              address <Hash value={config.validatorAddress} href={scanAddress(config.validatorAddress)} />
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

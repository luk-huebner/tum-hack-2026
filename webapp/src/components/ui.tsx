import { useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { short } from "../api";

export const Badge = ({ tone = "slate", children }: { tone?: "slate" | "blue" | "green" | "amber" | "red"; children: ReactNode }) => {
  const tones = {
    slate: "bg-white/10 text-ink-soft",
    blue: "bg-brand-500/15 text-brand-400",
    green: "bg-proof/10 text-proof",
    amber: "bg-amber-500/10 text-amber-300",
    red: "bg-red-500/10 text-red-300",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
};

export const CopyButton = ({ value, label }: { value: string; label?: string }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-ink-mute hover:bg-white/10 hover:text-ink"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      title="Copy"
    >
      {done ? <Check size={14} className="text-proof" /> : <Copy size={14} />}
      {label}
    </button>
  );
};

export const Hash = ({ value, href, head = 10, tail = 8 }: { value: string; href?: string; head?: number; tail?: number }) => (
  <span className="inline-flex items-center gap-1">
    {href ? (
      <a href={href} target="_blank" rel="noreferrer" className="mono inline-flex items-center gap-1 text-brand-400 hover:underline">
        {short(value, head, tail)} <ExternalLink size={12} />
      </a>
    ) : (
      <span className="mono text-ink-soft">{short(value, head, tail)}</span>
    )}
    <CopyButton value={value} />
  </span>
);

export const SectionTitle = ({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) => (
  <div className="mb-5">
    {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
    <h2 className="text-xl font-bold tracking-tight text-ink">{title}</h2>
    {children && <p className="mt-1 text-sm text-ink-mute">{children}</p>}
  </div>
);

export const ErrorNote = ({ children }: { children: ReactNode }) => (
  <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{children}</div>
);

export const timeOf = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");
export const dateTimeOf = (iso?: string) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

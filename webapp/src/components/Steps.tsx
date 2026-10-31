import { CheckCircle2, Circle, ExternalLink, Loader2, XCircle } from "lucide-react";
import type { Step } from "../api";
import { timeOf } from "./ui";

const icon = (kind: Step["kind"], last: boolean, running: boolean) => {
  if (kind === "ok") return <CheckCircle2 size={18} className="text-proof" />;
  if (kind === "refused") return <XCircle size={18} className="text-red-400" />;
  if (kind === "wait" && last && running) return <Loader2 size={18} className="animate-spin text-brand-400" />;
  return <Circle size={18} className="text-white/25" />;
};

export const Steps = ({ steps, running }: { steps: Step[]; running: boolean }) => (
  <ol className="space-y-3">
    {steps.map((s, i) => (
      <li key={`${s.at}-${i}`} className="flex gap-3">
        <div className="mt-0.5 shrink-0">{icon(s.kind, i === steps.length - 1, running)}</div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm leading-relaxed ${s.kind === "refused" ? "text-red-300" : "text-ink-soft"}`}>{s.text}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-ink-mute">
            <span>{timeOf(s.at)}</span>
            {s.link && (
              <a className="inline-flex items-center gap-1 font-medium text-brand-400 hover:underline" href={s.link.url} target="_blank" rel="noreferrer">
                {s.link.label} on Cardanoscan <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </li>
    ))}
  </ol>
);

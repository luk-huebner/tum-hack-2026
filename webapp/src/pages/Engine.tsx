import { useCallback, useEffect, useState } from "react";
import { Activity, CheckCircle2, Clock, Cpu, Loader2, RefreshCw, XCircle } from "lucide-react";
import { api, describeError, scanAddress, scanTx, type Engine, type EngineTx } from "../api";
import { Badge, ErrorNote, Hash, SectionTitle, dateTimeOf, timeOf } from "../components/ui";

const REFRESH_MS = 5000;

const ago = (iso?: string | null) => {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 90) return `${s} s ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
};

const operationBadge = (op: string) => {
  if (op === "release") return <Badge tone="green">Payout</Badge>;
  if (op === "refund") return <Badge tone="amber">Refund</Badge>;
  if (op === "lock") return <Badge tone="blue">Lock</Badge>;
  return <Badge>{op}</Badge>;
};

const StateCell = ({ t }: { t: EngineTx }) => {
  if (t.state === "confirmed")
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-proof">
        <CheckCircle2 size={16} /> Confirmed{t.blockNumber ? <span className="font-normal text-ink-mute"> · block {t.blockNumber.toLocaleString("en")}</span> : null}
      </span>
    );
  if (t.state === "rejected" || t.state === "expired")
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-red-300">
        <XCircle size={16} /> {t.state === "rejected" ? "Rejected" : "Expired"}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-amber-300" title={t.note ?? ""}>
      <Clock size={16} /> {t.state === "unknown" ? "Waiting for the chain" : t.state === "submitted" ? "Submitted" : "Built"}
    </span>
  );
};

const Tile = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="card p-4">
    <div className="text-xs text-ink-mute">{label}</div>
    <div className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight">{value}</div>
    {sub && <div className="mt-0.5 text-xs text-ink-mute">{sub}</div>}
  </div>
);

export default function EnginePage() {
  const [data, setData] = useState<Engine>();
  const [error, setError] = useState<string>();
  const [only, setOnly] = useState<"all" | "release" | "lock" | "refund">("all");

  const load = useCallback(() => {
    api
      .engine()
      .then((d) => {
        setData(d);
        setError(undefined);
      })
      .catch((e: unknown) => setError(describeError(e)));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const txs = (data?.transactions ?? []).filter((t) => only === "all" || t.operation === only);
  const k = data?.keeper;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <SectionTitle eyebrow="Under the hood" title="What the engine is doing, live">
          Every transaction the service made, the keeper's checks and the signed data it acted on. Hashes open on Cardanoscan. Refreshes every {REFRESH_MS / 1000} s.
        </SectionTitle>
        <button className="btn-ghost" onClick={load}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && !error && <Loader2 className="animate-spin text-brand-400" />}

      {data && (
        <div className="space-y-6">
          {data.scope === "public" && (
            <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink-mute">
              You see the public chain data. The activity and signed data of a campaign appear in the browser that created it.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Campaigns" value={data.counts.campaigns} sub={Object.entries(data.counts.campaignStates).map(([s, n]) => `${n} ${s}`).join(" · ") || "none yet"} />
            <Tile label="Locked at the contract" value={`${data.counts.tadaLocked} tADA`} sub={`${data.counts.escrowStates.locked ?? 0} escrows`} />
            <Tile label="Paid to creators" value={`${data.counts.tadaReleased} tADA`} sub={`${data.counts.escrowStates.released ?? 0} escrows released`} />
            <Tile label="Network" value={data.network} sub="test money only" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <div className="card p-6">
              <SectionTitle eyebrow="The keeper" title={k?.enabled ? "Watching and releasing" : "Keeper is off"} />
              {k?.enabled ? (
                <>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-ink-mute">Last signed check</dt>
                      <dd className="font-semibold">{ago(k.lastCycleAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-mute">Released so far</dt>
                      <dd className="font-semibold">{k.released}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-mute">Data bought (test aUSD)</dt>
                      <dd className="font-semibold tabular-nums">{k.ausdSpent.toFixed(2)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-mute">Retries · failures in a row</dt>
                      <dd className="font-semibold">
                        {k.retries} · {k.consecutiveFailures}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-wider text-ink-mute">
                        <tr>
                          <th className="py-2 pr-3 font-semibold">Watching</th>
                          <th className="py-2 pr-3 font-semibold">State</th>
                          <th className="py-2 font-semibold">Signed value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {k.watching.map((w) => (
                          <tr key={w.ref}>
                            <td className="py-2.5 pr-3 text-ink-soft">
                              <div className="line-clamp-2">{w.rule}</div>
                              <Hash value={w.ref.split("#")[0]} href={scanTx(w.ref.split("#")[0])} head={8} tail={4} />
                            </td>
                            <td className="py-2.5 pr-3">
                              <Badge tone={w.state === "released" ? "green" : w.state === "watching" || w.state === "rule-not-met" ? "blue" : "amber"}>{w.state}</Badge>
                            </td>
                            <td className="py-2.5 tabular-nums text-ink-soft">{w.value ?? "—"}</td>
                          </tr>
                        ))}
                        {k.watching.length === 0 && (
                          <tr>
                            <td colSpan={3} className="py-4 text-ink-mute">
                              Nothing to watch right now.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-mute">The service runs read-only: campaigns can be created and viewed, nothing is paid out.</p>
              )}
            </div>

            <div className="card p-6">
              <SectionTitle eyebrow="The contract" title="Pay-on-Proof validator" />
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-mute">Script hash (Plutus V3)</dt>
                  <dd>
                    <Hash value={data.contract.validatorHash} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-mute">Address on Cardano preprod</dt>
                  <dd>
                    <Hash value={data.contract.validatorAddress} href={scanAddress(data.contract.validatorAddress)} />
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-ink-mute">Updated {timeOf(data.generatedAt)}.</p>
            </div>
          </div>

          <div className="card p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <SectionTitle eyebrow="On chain" title="Transactions">
                Written to a journal before they are sent, then checked against the ledger. A green tick means the chain confirmed it.
              </SectionTitle>
              <div className="flex gap-1.5">
                {(["all", "lock", "release", "refund"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setOnly(f)} className={only === f ? "btn-primary px-3 py-1.5 text-xs" : "btn-ghost px-3 py-1.5 text-xs"}>
                    {f === "all" ? "All" : f === "lock" ? "Locks" : f === "release" ? "Payouts" : "Refunds"}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-ink-mute">
                  <tr>
                    <th className="py-2 pr-4 font-semibold">Time</th>
                    <th className="py-2 pr-4 font-semibold">Type</th>
                    <th className="py-2 pr-4 font-semibold">Status</th>
                    <th className="py-2 pr-4 font-semibold">Transaction</th>
                    <th className="py-2 font-semibold">Made by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {txs.map((t) => (
                    <tr key={t.txHash}>
                      <td className="whitespace-nowrap py-2.5 pr-4 text-ink-mute">{dateTimeOf(t.confirmedAt ?? t.updatedAt)}</td>
                      <td className="py-2.5 pr-4">{operationBadge(t.operation)}</td>
                      <td className="py-2.5 pr-4">
                        <StateCell t={t} />
                      </td>
                      <td className="py-2.5 pr-4">
                        <Hash value={t.txHash} href={t.explorerUrl} head={10} tail={6} />
                      </td>
                      <td className="py-2.5 text-ink-mute">{t.source.replace(/\.ts$/, "")}</td>
                    </tr>
                  ))}
                  {txs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-ink-mute">
                        No transactions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-6">
              <SectionTitle eyebrow="Signed data" title="What the contract was shown" />
              <ul className="space-y-4 text-sm">
                {data.signed.map((s) => (
                  <li key={s.campaignId}>
                    <div className="flex items-center justify-between gap-2">
                      <a className="font-semibold text-brand-400 hover:underline" href={s.postUrl} target="_blank" rel="noreferrer">
                        @{s.creator}
                      </a>
                      <span className="tabular-nums">
                        <span className="text-xl font-extrabold">{s.likesNow}</span> <span className="text-xs text-ink-mute">likes {s.signedCount ? "(signed, latest)" : "(at submission)"}</span>
                      </span>
                    </div>
                    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-ink-mute">
                      <dt>Signed by</dt>
                      <dd className="mono truncate">{s.airnode ?? "—"}</dd>
                      <dt>Signed at</dt>
                      <dd>{s.signedAt ? dateTimeOf(new Date(Number(s.signedAt) * 1000).toISOString()) : "—"}</dd>
                      <dt>Request pinned</dt>
                      <dd className="mono truncate">{s.requestHash ?? "—"}</dd>
                      <dt>Signer key</dt>
                      <dd className="mono truncate">{s.signer ?? "—"}</dd>
                    </dl>
                  </li>
                ))}
                {data.signed.length === 0 && <li className="text-ink-mute">No post has been submitted yet.</li>}
              </ul>
            </div>

            <div className="card p-6">
              <SectionTitle eyebrow="Activity" title="Everything that happened, newest first" />
              <ul className="max-h-[28rem] space-y-3 overflow-y-auto pr-1 text-sm">
                {data.activity.map((a, i) => (
                  <li key={`${a.campaignId}-${a.at}-${i}`} className="flex gap-3">
                    <Activity size={16} className={`mt-0.5 shrink-0 ${a.kind === "ok" ? "text-proof" : a.kind === "refused" ? "text-red-300" : "text-ink-mute"}`} />
                    <div>
                      <div className="text-xs text-ink-mute">
                        {timeOf(a.at)} · @{a.creator} · {a.title}
                      </div>
                      <div className="text-ink-soft">{a.text}</div>
                      {a.link && (
                        <a className="text-xs font-semibold text-brand-400 hover:underline" href={a.link.url} target="_blank" rel="noreferrer">
                          {a.link.label}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
                {data.activity.length === 0 && <li className="text-ink-mute">Nothing yet.</li>}
              </ul>
            </div>
          </div>

          <p className="flex items-center gap-2 text-xs text-ink-mute">
            <Cpu size={14} /> This page only reads. It cannot send a transaction or change a campaign.
          </p>
        </div>
      )}
    </div>
  );
}

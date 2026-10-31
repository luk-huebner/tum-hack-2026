import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Play, RefreshCw, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { useConfig } from "../App";
import { api, scanAddress, scanTx, txOf, type BenchCase, type BoardRow, type Verdict } from "../api";
import { Badge, ErrorNote, Hash, SectionTitle, dateTimeOf } from "../components/ui";

type Result = { verdict?: Verdict; running?: boolean; error?: string };

export default function Verify() {
  const { config } = useConfig();
  const [cases, setCases] = useState<BenchCase[]>([]);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [running, setRunning] = useState(false);
  const [board, setBoard] = useState<BoardRow[]>();
  const [boardError, setBoardError] = useState<string>();
  const [error, setError] = useState<string>();

  const loadBoard = () => {
    setBoardError(undefined);
    api.board().then((b) => setBoard(b.rows)).catch((e: Error) => setBoardError(e.message));
  };
  useEffect(() => {
    api.cases().then(setCases).catch((e: Error) => setError(e.message));
    loadBoard();
  }, []);

  const runAll = async () => {
    setRunning(true);
    setResults({});
    for (const c of cases) {
      setResults((r) => ({ ...r, [c.id]: { running: true } }));
      try {
        const verdict = await api.judge(c.ref, c.response);
        setResults((r) => ({ ...r, [c.id]: { verdict } }));
      } catch (e) {
        setResults((r) => ({ ...r, [c.id]: { error: (e as Error).message } }));
      }
    }
    setRunning(false);
  };

  const done = cases.filter((c) => results[c.id]?.verdict);
  const passed = done.filter((c) => results[c.id]?.verdict?.verdict === c.expect).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="eyebrow mb-1.5">Verify</div>
      <h1 className="text-3xl font-extrabold tracking-tight">Don't trust this website. Ask the contract.</h1>
      <p className="mt-2 max-w-3xl text-ink-mute">
        The Aiken validator on Cardano preprod checks an API3 Airnode signature itself: who signed, which request, how old, and whether the rule holds. Below, real and tampered signed responses are sent to two
        policies locked at the contract. Each verdict is the node's own script evaluation of an unsigned release; nothing is ever submitted.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="card p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <SectionTitle eyebrow="Tamper bench" title="One valid, four tampered, one valid" />
            <button className="btn-primary" onClick={runAll} disabled={running || cases.length === 0}>
              {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Run the bench
            </button>
          </div>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="divide-y divide-white/10">
            {cases.map((c, i) => {
              const r = results[c.id];
              const v = r?.verdict?.verdict;
              const ok = v === c.expect;
              return (
                <div key={c.id} className="flex items-center gap-4 py-3">
                  <span className="w-5 text-xs font-bold text-white/25">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{c.label}</div>
                    <div className="text-xs text-ink-mute">
                      policy {c.policy} · expected <span className={c.expect === "ACCEPTED" ? "text-proof" : "text-red-400"}>{c.expect}</span>
                      {r?.verdict?.tookMs ? ` · ${(r.verdict.tookMs / 1000).toFixed(1)} s` : ""}
                    </div>
                    {(r?.error || (v === "ERROR" && r?.verdict?.detail)) && <div className="mt-0.5 text-xs text-amber-300">{r?.error ?? r?.verdict?.detail}</div>}
                  </div>
                  <div className="w-32 text-right">
                    {r?.running && <Loader2 size={18} className="ml-auto animate-spin text-brand-400" />}
                    {v && (
                      <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${v === "ACCEPTED" ? "text-proof" : v === "REJECTED" ? "text-red-400" : "text-amber-400"}`}>
                        {v === "ACCEPTED" ? <CheckCircle2 size={16} /> : v === "REJECTED" ? <XCircle size={16} /> : <ShieldAlert size={16} />}
                        {v}
                      </span>
                    )}
                    {v && v !== "ERROR" && <div className={`text-[0.7rem] font-semibold ${ok ? "text-proof" : "text-red-400"}`}>{ok ? "as expected" : "UNEXPECTED"}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {done.length === cases.length && cases.length > 0 && (
            <div className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${passed === cases.length ? "bg-proof/10 text-proof" : "bg-red-500/10 text-red-300"}`}>
              {passed === cases.length ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />} {passed}/{cases.length} verdicts as expected
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <SectionTitle eyebrow="The contract" title="Pay-on-Proof validator" />
            {config ? (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-mute">Script hash (Plutus V3)</dt>
                  <dd><Hash value={config.validatorHash} /></dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-mute">Address on Cardano preprod</dt>
                  <dd><Hash value={config.validatorAddress} href={scanAddress(config.validatorAddress)} /></dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-ink-mute">Connecting to the service…</p>
            )}
            <ul className="mt-5 space-y-2 text-sm text-ink-soft">
              {["rebuilds the signed text byte for byte", "verifies the secp256k1 signature against the pinned Airnode key", "checks the pinned request hash", "checks the age and the time window", "applies the rule, then requires the payout to the payee"].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-proof" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="card mt-6 p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <SectionTitle eyebrow="Live board" title="Locked at the contract right now">
            Read from Cardano preprod: every UTxO at the validator that carries a Pay-on-Proof policy.
          </SectionTitle>
          <button className="btn-ghost" onClick={loadBoard}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
        {boardError && <ErrorNote>{boardError}</ErrorNote>}
        {!board && !boardError && <Loader2 className="animate-spin text-brand-400" />}
        {board && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-mute">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Rule</th>
                  <th className="py-2 pr-4 font-semibold">Locked</th>
                  <th className="py-2 pr-4 font-semibold">Deadline</th>
                  <th className="py-2 pr-4 font-semibold">State</th>
                  <th className="py-2 font-semibold">Escrow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {board.map((r) => (
                  <tr key={r.ref}>
                    <td className="py-2.5 pr-4 text-ink-soft">{r.rule}</td>
                    <td className="py-2.5 pr-4 font-semibold">{r.lockedTada} tADA</td>
                    <td className="py-2.5 pr-4 text-ink-mute">{dateTimeOf(r.deadline)}</td>
                    <td className="py-2.5 pr-4">{r.state === "open" ? <Badge tone="blue">open</Badge> : <Badge tone="amber">refundable</Badge>}</td>
                    <td className="py-2.5"><Hash value={txOf(r.ref)!} href={scanTx(txOf(r.ref)!)} head={8} tail={4} /></td>
                  </tr>
                ))}
                {board.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-ink-mute">Nothing locked right now.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

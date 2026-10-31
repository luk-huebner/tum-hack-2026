import { createContext, useContext, useEffect, useState } from "react";
import { NavLink, Route, Routes, Link } from "react-router-dom";
import { api, type Config } from "./api";
import Home from "./pages/Home";
import Brand from "./pages/Brand";
import CampaignPage from "./pages/CampaignPage";
import Creator from "./pages/Creator";
import Verify from "./pages/Verify";
import EnginePage from "./pages/Engine";

interface ConfigState {
  config?: Config;
  error?: string;
}
const ConfigContext = createContext<ConfigState>({});
export const useConfig = () => useContext(ConfigContext);

const Logo = () => (
  <Link to="/" className="flex items-center gap-2.5">
    <span className="grid h-8 w-8 place-items-center rounded-lg bg-grad text-white shadow-[0_4px_14px_rgba(235,64,72,.45)]">
      <svg viewBox="0 0 32 32" className="h-5 w-5">
        <path d="M8 16.5l5 5L24 10.5" stroke="currentColor" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
    <span className="hidden text-[1.05rem] font-extrabold tracking-tight min-[400px]:inline">
      Creator<span className="text-grad">Pay</span>
    </span>
  </Link>
);

const ServiceStatus = ({ state }: { state: ConfigState }) => {
  const { config, error } = state;
  const tone = error ? "text-red-400" : !config ? "text-white/25" : config.keeper.enabled ? "text-proof" : "text-amber-500";
  const label = error ? "Service offline" : !config ? "Connecting…" : config.keeper.enabled ? "Keeper online" : "Read-only";
  return (
    <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-transparent px-3 py-1 text-xs font-medium text-ink-soft sm:inline-flex" title={config?.refusal ?? error ?? ""}>
      <span className={`pulse-dot h-2 w-2 rounded-full bg-current ${tone}`} />
      {label} · Cardano preprod
    </span>
  );
};

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-2 py-1.5 text-sm font-semibold sm:px-3 transition ${isActive ? "bg-brand-500/15 text-brand-400" : "text-ink-soft hover:text-ink"}`;

export default function App() {
  const [state, setState] = useState<ConfigState>({});
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .config()
        .then((config) => alive && setState({ config }))
        .catch((e: Error) => alive && setState({ error: e.message }));
    void load();
    const t = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <ConfigContext.Provider value={state}>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 bg-night/60 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
            <Logo />
            <nav className="flex items-center sm:gap-1">
              <NavLink to="/brand" className={navClass}>
                Brands
              </NavLink>
              <NavLink to="/creator" className={navClass}>
                Creators
              </NavLink>
              <NavLink to="/verify" className={navClass}>
                Verify
              </NavLink>
              <NavLink to="/engine" className={navClass}>
                Engine
              </NavLink>
            </nav>
            <ServiceStatus state={state} />
          </div>
        </header>
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/brand" element={<Brand />} />
            <Route path="/creator" element={<Creator />} />
            <Route path="/c/:id" element={<CampaignPage />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/engine" element={<EnginePage />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
        <footer>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ink-mute sm:px-6">
            <span>CreatorPay · Pay-on-Proof · TUM Blockchain & AI Hackathon 2026 · testnets only (Cardano preprod, Base Sepolia)</span>
            <span>Signed data by API3 AirnodeHub · contract in Aiken (Plutus V3)</span>
          </div>
        </footer>
      </div>
    </ConfigContext.Provider>
  );
}

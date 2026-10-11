import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { AppCtx } from "./lib/context.js";
import { ROUTES } from "./lib/routes.js";
import { loadCorrelation, loadFx, loadMarket, loadMeta, loadNews, loadSnapshot } from "./lib/data.js";
import { alertStore, portfolioStore, settingsStore, useStore } from "./lib/store.js";
import { summarize, portfolioRisk } from "./lib/portfolio.js";
import { triggered, updateSignalLog } from "./lib/alerts.js";
import Header from "./components/Header.jsx";
import EtfDrawer from "./components/EtfDrawer.jsx";
import ChatPanel from "./components/ChatPanel.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import { Spinner } from "./components/ui.jsx";
import Overview from "./views/Overview.jsx";
import Screener from "./views/Screener.jsx";
import Compare from "./views/Compare.jsx";
import Portfolio from "./views/Portfolio.jsx";
import Watch from "./views/Watch.jsx";

const VIEWS = { oversikt: Overview, screener: Screener, sammenlign: Compare, portefolje: Portfolio, overvaking: Watch };

function useHashRoute() {
  const parse = () => {
    const [id, query = ""] = window.location.hash.replace(/^#\/?/, "").split("?");
    return { id: ROUTES.some(r => r.id === id) ? id : "oversikt", params: Object.fromEntries(new URLSearchParams(query)) };
  };
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = useCallback((id, params) => {
    const q = params ? `?${new URLSearchParams(params)}` : "";
    window.location.hash = `/${id}${q}`;
    window.scrollTo({ top: 0 });
  }, []);
  return [route, go];
}

function useTheme(theme) {
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && mq.matches));
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
}

export default function App() {
  const [settings] = useStore(settingsStore);
  const [portfolio] = useStore(portfolioStore);
  const [alerts] = useStore(alertStore);
  const [route, go] = useHashRoute();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [chat, setChat] = useState(null);           // null = lukket, ellers { prompt? }
  const [showSettings, setShowSettings] = useState(false);
  const [risk, setRisk] = useState(null);

  useTheme(settings.theme);

  useEffect(() => {
    Promise.all([loadMeta(), loadSnapshot(), loadMarket(), loadFx()])
      .then(([meta, snap, market, fx]) => {
        setData({ meta, snap, market, fx, etfs: snap.etfs, etfMap: Object.fromEntries(snap.etfs.map(e => [e.ticker, e])) });
        updateSignalLog(snap.etfs, meta.generated);
      })
      .catch(e => setError(e.message));
  }, []);

  const [news, setNews] = useState(null);
  const [corr, setCorr] = useState(null);
  useEffect(() => {
    loadNews().then(setNews).catch(() => setNews({}));
    loadCorrelation().then(setCorr).catch(() => setCorr(null));
  }, []);

  const pf = useMemo(() => (data ? summarize(portfolio.transactions, data.etfMap, data.fx) : null), [data, portfolio]);
  useEffect(() => {
    if (!pf?.holdings.length) { setRisk(null); return; }
    let live = true;
    portfolioRisk(pf.holdings, data.fx).then(r => live && setRisk(r)).catch(() => {});
    return () => { live = false; };
  }, [pf, data]);
  const portfolioSummary = useMemo(() => (pf ? { ...pf, risk } : null), [pf, risk]);

  const hits = useMemo(() => (data ? triggered(alerts, data.etfMap) : []), [alerts, data]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <div className="card card-pad text-sm">
          <div className="mb-2 flex items-center gap-2 font-semibold text-down"><AlertTriangle className="h-4 w-4" /> Fant ikke markedsdata</div>
          <p className="text-ink2">{error}</p>
          <p className="mt-3 text-ink2">Kjører du lokalt? Hent data først med <code className="rounded bg-ink/5 px-1">npm run data</code>, og start så <code className="rounded bg-ink/5 px-1">npm run dev</code>.</p>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="flex h-screen items-center justify-center gap-3 text-sm text-ink2"><Spinner /> Laster markedsdata …</div>;
  }

  const ctx = {
    ...data, news, corr, settings, route, go,
    portfolio: portfolioSummary,
    hits,
    openEtf: t => setDrawer(t),
    openChat: prompt => setChat({ prompt, focus: drawer }),
    openSettings: () => setShowSettings(true),
  };
  const View = VIEWS[route.id];

  return (
    <AppCtx.Provider value={ctx}>
      <Header />
      <main className="mx-auto max-w-[1500px] px-4 pb-16 pt-5 sm:px-6">
        <View key={route.id} params={route.params} />
        <footer className="mt-10 border-t border-line pt-4 text-xs leading-relaxed text-muted">
          Data: Yahoo Finance (justerte sluttkurser) og Google News, oppdatert automatisk hver handelsdag. AI: Google Gemini med din egen nøkkel.
          Signalene er regelbaserte og kursbaserte («billig/dyr» = posisjon i egen kurshistorikk, ikke P/E). Dette er et analyseverktøy, ikke personlig investeringsrådgivning.
          Amerikanske ETF-er vises som markedssignal, men kan ikke kjøpes av norske privatkunder.
        </footer>
      </main>
      {drawer && data.etfMap[drawer] && <EtfDrawer ticker={drawer} onClose={() => setDrawer(null)} />}
      {chat && <ChatPanel initialPrompt={chat.prompt} focus={chat.focus} onClose={() => setChat(null)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </AppCtx.Provider>
  );
}

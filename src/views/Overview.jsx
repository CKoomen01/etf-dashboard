import { useMemo, useState } from "react";
import { ArrowRight, Bell, ExternalLink, Newspaper, Wallet } from "lucide-react";
import { useApp } from "../lib/context.js";
import { settingsStore, signalLogStore, useStore } from "../lib/store.js";
import { PROFILES } from "../lib/data.js";
import { briefPrompt } from "../lib/prompts.js";
import { describeChange } from "../lib/alerts.js";
import { ago, date, nok, num, pct, signedNok, tone } from "../lib/format.js";
import { Card, Delta, RegionTag, Seg, SignalBadge, Sparkline } from "../components/ui.jsx";
import SectorHeatmap from "../components/SectorHeatmap.jsx";
import AiBox from "../components/AiBox.jsx";

export function useFiltered() {
  const { etfs } = useApp();
  const [settings] = useStore(settingsStore);
  return useMemo(() => etfs.filter(e => settings.region === "ALL" || e.region === settings.region), [etfs, settings.region]);
}

export function RegionSeg() {
  const [settings, set] = useStore(settingsStore);
  return <Seg label="Region" value={settings.region} onChange={v => set(s => ({ ...s, region: v }))}
    options={[["ALL", "Alle"], ["UCITS", "Kjøpbare i Norge"], ["US", "US"]]} />;
}

export function ProfileSeg() {
  const [settings, set] = useStore(settingsStore);
  return <Seg label="Signalprofil" value={settings.profile} onChange={v => set(s => ({ ...s, profile: v }))}
    options={PROFILES.map(p => [p.id, p.label])} />;
}

function MarketStrip() {
  const { market } = useApp();
  return (
    <div className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {market.map(m => {
        const isRate = m.ticker === "^TNX" || m.ticker === "^VIX";
        return (
          <div key={m.ticker} className="card min-w-[150px] flex-1 px-3 py-2.5">
            <div className="truncate text-[11px] text-muted">{m.name}</div>
            <div className="mt-0.5 flex items-end justify-between gap-2">
              <div>
                <div className="text-[15px] font-semibold text-ink num">{num(m.price, m.price > 1000 ? 0 : 2)}{m.ticker === "^TNX" ? " %" : ""}</div>
                <div className="whitespace-nowrap text-xs" title="Endring siste handelsdag"><Delta v={m.ret["1D"]} /></div>
              </div>
              <Sparkline data={m.spark} width={56} height={24} color={isRate ? "rgb(var(--muted))" : undefined} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopSignals({ etfs }) {
  const { openEtf } = useApp();
  const [settings] = useStore(settingsStore);
  const p = settings.profile;
  const sorted = [...etfs].sort((a, b) => b.scores.profiles[p].score - a.scores.profiles[p].score);
  const counts = { BUY: 0, HOLD: 0, SELL: 0 };
  etfs.forEach(e => counts[e.scores.profiles[p].signal]++);
  const Row = ({ e }) => (
    <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-ink/5" onClick={() => openEtf(e.ticker)}>
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{e.short}</span>
      <RegionTag region={e.region} />
      <SignalBadge signal={e.scores.profiles[p].signal} score={e.scores.profiles[p].score} />
    </button>
  );
  return (
    <div>
      <div className="mb-3 flex gap-2 text-center text-xs">
        {[["BUY", "Kjøp", "text-up"], ["HOLD", "Hold", "text-ink2"], ["SELL", "Selg", "text-down"]].map(([k, l, c]) => (
          <div key={k} className="flex-1 rounded-lg bg-ink/[0.03] py-2">
            <div className={`text-lg font-semibold ${c}`}>{counts[k]}</div>
            <div className="text-muted">{l}</div>
          </div>
        ))}
      </div>
      <div className="h-sub mb-1 px-2">Høyest score</div>
      {sorted.slice(0, 5).map(e => <Row key={e.ticker} e={e} />)}
      <div className="h-sub mb-1 mt-3 px-2">Lavest score</div>
      {sorted.slice(-3).reverse().map(e => <Row key={e.ticker} e={e} />)}
    </div>
  );
}

function Movers({ etfs, currency }) {
  const { openEtf } = useApp();
  const [h, setH] = useState("1D");
  const k = currency === "NOK" ? "ret_nok" : "ret";
  const list = etfs.filter(e => e[k][h] != null).sort((a, b) => b[k][h] - a[k][h]);
  const Col = ({ title, items }) => (
    <div className="min-w-0 flex-1">
      <div className="h-sub mb-1">{title}</div>
      {items.map(e => (
        <button key={e.ticker} onClick={() => openEtf(e.ticker)} className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-ink/5">
          <span className="truncate text-ink">{e.short}</span>
          <Delta v={e[k][h]} className="text-xs font-medium" />
        </button>
      ))}
    </div>
  );
  return (
    <Card title="Største bevegelser" right={<Seg label="Periode" value={h} onChange={setH} options={["1D", "1W", "1M", "3M"]} />}>
      <div className="flex gap-4">
        <Col title="Vinnere" items={list.slice(0, 6)} />
        <Col title="Tapere" items={list.slice(-6).reverse()} />
      </div>
    </Card>
  );
}

function NewsCard() {
  const { news } = useApp();
  const tabs = news ? Object.keys(news).filter(k => news[k]?.length) : [];
  const [tab, setTab] = useState("Marked");
  const items = news?.[tab] || [];
  return (
    <Card title="Nyheter" sub="Google News, siste dager">
      <div className="scroll-thin -mt-1 mb-3 flex gap-1 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${tab === t ? "bg-accent text-white" : "bg-ink/5 text-ink2 hover:text-ink"}`}>{t}</button>
        ))}
      </div>
      {!news && <div className="skeleton h-40" />}
      {news && !items.length && <div className="py-6 text-center text-sm text-muted"><Newspaper className="mx-auto mb-1 h-5 w-5" />Ingen nyheter</div>}
      <ul className="space-y-2.5">
        {items.slice(0, 8).map((n, i) => (
          <li key={i}>
            <a href={n.url} target="_blank" rel="noopener noreferrer" className="group block">
              <div className="text-sm leading-snug text-ink group-hover:text-accent">{n.title} <ExternalLink className="inline h-3 w-3 opacity-0 group-hover:opacity-60" /></div>
              <div className="text-[11px] text-muted">{n.source} · {ago(n.published)}</div>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PortfolioMini() {
  const { portfolio, go } = useApp();
  if (!portfolio?.holdings.length) {
    return (
      <Card title="Min portefølje">
        <p className="text-sm text-ink2">Legg inn kjøpene dine for å følge verdi, gevinst i NOK, fordeling og risiko.</p>
        <button className="btn-outline mt-3" onClick={() => go("portefolje")}><Wallet className="h-4 w-4" /> Sett opp portefølje</button>
      </Card>
    );
  }
  return (
    <Card title="Min portefølje" right={<button className="btn-ghost text-xs" onClick={() => go("portefolje")}>Detaljer <ArrowRight className="h-3 w-3" /></button>}>
      <div className="text-2xl font-semibold text-ink">{nok(portfolio.value)}</div>
      <div className="mt-1 flex flex-wrap gap-x-4 text-sm">
        <span className={tone(portfolio.day)}>{signedNok(portfolio.day)} i dag ({pct(portfolio.dayPct, 2)})</span>
        <span className={tone(portfolio.pnl)}>{signedNok(portfolio.pnl)} totalt ({pct(portfolio.pnlPct)})</span>
      </div>
      <div className="mt-3 space-y-1">
        {portfolio.holdings.slice(0, 5).map(h => (
          <div key={h.ticker} className="flex items-center justify-between text-sm">
            <span className="truncate text-ink2">{h.short}</span>
            <span className="num text-ink">{pct(h.weight * 100, 0, false)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SignalChanges() {
  const [st] = useStore(signalLogStore);
  const { etfMap, openEtf, hits, go } = useApp();
  const recent = (st.log || []).slice(0, 6);
  if (!recent.length && !hits.length) return null;
  return (
    <Card title="Varsler og signalendringer" right={<button className="btn-ghost text-xs" onClick={() => go("overvaking")}>Alle <ArrowRight className="h-3 w-3" /></button>}>
      {hits.map(h => (
        <button key={h.alert.id} onClick={() => openEtf(h.alert.ticker)} className="mb-1 flex w-full items-center gap-2 rounded-lg bg-warn/10 px-2 py-1.5 text-left text-sm">
          <Bell className="h-3.5 w-3.5 shrink-0 text-ink" aria-hidden />
          <span className="truncate"><b className="font-medium">{etfMap[h.alert.ticker]?.short}</b> – {h.metric.label} {h.alert.op === "above" ? "over" : "under"} {num(h.alert.value, 2)}</span>
        </button>
      ))}
      {recent.map((c, i) => (
        <button key={i} onClick={() => openEtf(c.ticker)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ink/5">
          <span className="truncate text-ink">{etfMap[c.ticker]?.short}</span>
          <span className="shrink-0 text-xs text-ink2">{describeChange(c)} · {date(c.date, { day: "numeric", month: "short" })}</span>
        </button>
      ))}
    </Card>
  );
}

export default function Overview() {
  const { market, news, portfolio } = useApp();
  const [settings] = useStore(settingsStore);
  const etfs = useFiltered();
  const { etfs: all } = useApp();

  return (
    <div className="space-y-4">
      <MarketStrip />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Markedsoversikt</h1>
        <div className="flex flex-wrap gap-2"><RegionSeg /><ProfileSeg /></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Dagens AI-brief" sub="Gemini oppsummerer markedet, sektorrotasjon og hva som skjer fremover" className="lg:col-span-2">
          <AiBox
            cacheKey={`brief|${settings.profile}|${portfolio?.holdings.length || 0}`}
            cta="Lag dagens markedsbrief"
            hint="Gemini leser tallene i dashbordet, søker etter dagens nyheter og skriver en kort brief tilpasset porteføljen din."
            buildPrompt={() => briefPrompt({ etfs: all, market, news, portfolio, profile: settings.profile })}
          />
        </Card>
        <Card title="Signaler" sub={`${PROFILES.find(p => p.id === settings.profile).long} · ${etfs.length} ETF-er`}>
          <TopSignals etfs={etfs} />
        </Card>
      </div>

      <Card title="Sektorvarmekart" sub={`Snittavkastning per sektor i ${settings.currency === "NOK" ? "NOK" : "lokal valuta"}. Klikk en rad for å se ETF-ene.`}>
        <SectorHeatmap etfs={etfs} currency={settings.currency} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Movers etfs={etfs} currency={settings.currency} />
        <NewsCard />
        <div className="space-y-4">
          <PortfolioMini />
          <SignalChanges />
        </div>
      </div>
    </div>
  );
}

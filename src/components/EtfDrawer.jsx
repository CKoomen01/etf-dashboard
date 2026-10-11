import { useEffect, useMemo, useState } from "react";
import { Bell, ExternalLink, GitCompare, MessageSquare, Plus, Star, X } from "lucide-react";
import { useApp } from "../lib/context.js";
import { compareStore, useStore, watchStore } from "../lib/store.js";
import { loadHistory, movingAverage, PROFILES, rangeStart, RANGES, sliceFrom, toNok } from "../lib/data.js";
import { etfPrompt } from "../lib/prompts.js";
import { CHROME, SERIES, useDark } from "../lib/colors.js";
import { ago, big, date, num, pct, price } from "../lib/format.js";
import { Delta, Modal, RegionTag, Seg, SignalBadge, Spinner, TrendTag, ValTag } from "./ui.jsx";
import LineChart from "./LineChart.jsx";
import AiBox from "./AiBox.jsx";
import { AlertForm, TxForm } from "./Forms.jsx";

function Section({ title, children, right }) {
  return (
    <section className="border-t border-line px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="h-title">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function KV({ k, v, hint }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm" title={hint}>
      <span className="text-ink2">{k}</span>
      <span className="num text-right font-medium text-ink">{v}</span>
    </div>
  );
}

function PriceChart({ e }) {
  const { fx, settings } = useApp();
  const dark = useDark();
  const [hist, setHist] = useState(null);
  const [range, setRange] = useState("1Y");
  const [cur, setCur] = useState(settings.currency === "NOK" ? "NOK" : "LOCAL");
  const [ma, setMa] = useState({ 50: true, 200: true });

  useEffect(() => { loadHistory(e.ticker).then(setHist).catch(() => setHist({ error: true })); }, [e.ticker]);

  const series = useMemo(() => {
    if (!hist || hist.error) return [];
    const h = cur === "NOK" ? toNok(hist, fx) : hist;
    const m50 = movingAverage(h.c, 50), m200 = movingAverage(h.c, 200);
    const start = rangeStart(range, h.d.at(-1));
    const i0 = Math.max(0, h.d.findIndex(d => d >= start));
    const pts = (arr) => h.d.slice(i0).map((d, i) => ({ time: d, value: arr[i0 + i] })).filter(p => p.value != null);
    const pal = SERIES[dark ? "dark" : "light"];
    const out = [{ id: "px", label: e.short, color: pal[0], data: pts(h.c), area: true }];
    if (ma[50]) out.push({ id: "ma50", label: "MA50", color: pal[1], data: pts(m50), width: 1.5 });
    if (ma[200]) out.push({ id: "ma200", label: "MA200", color: CHROME[dark ? "dark" : "light"].ink2, data: pts(m200), width: 1.5 });
    return out;
  }, [hist, cur, range, ma, fx, dark, e.short]);

  const first = series[0]?.data[0]?.value, last = series[0]?.data.at(-1)?.value;
  const chg = first && last ? (last / first - 1) * 100 : null;
  const unit = cur === "NOK" ? "NOK" : e.currency;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Seg label="Periode" value={range} onChange={setRange} options={RANGES.map(r => r.id)} />
        <div className="flex flex-wrap items-center gap-2">
          {[50, 200].map(n => (
            <label key={n} className="flex items-center gap-1 text-xs text-ink2">
              <input type="checkbox" className="accent-[rgb(var(--accent))]" checked={ma[n]} onChange={() => setMa(m => ({ ...m, [n]: !m[n] }))} /> MA{n}
            </label>
          ))}
          <Seg label="Valuta" value={cur} onChange={setCur} options={[["LOCAL", e.currency], ["NOK", "NOK"]]} />
        </div>
      </div>
      {!hist ? <div className="skeleton h-[300px]" /> : hist.error ? <div className="text-sm text-down">Fant ikke kurshistorikk.</div> : (
        <>
          <LineChart series={series} height={280} format={v => num(v, v >= 1000 ? 0 : 2)} />
          <div className="mt-1 text-xs text-ink2">Endring i perioden ({unit}): <Delta v={chg} /> <span className="text-muted">· historikk fra {date(hist.d[0])}</span></div>
        </>
      )}
    </div>
  );
}

function Returns({ e }) {
  const keys = [["1D", "I dag"], ["1W", "1 uke"], ["1M", "1 mnd"], ["3M", "3 mnd"], ["6M", "6 mnd"], ["YTD", "Hittil i år"], ["1Y", "1 år"], ["3Y", "3 år p.a."], ["5Y", "5 år p.a."]];
  return (
    <table className="w-full text-sm">
      <thead><tr><th className="th pl-0">Periode</th><th className="th text-right">{e.currency}</th><th className="th pr-0 text-right">NOK</th></tr></thead>
      <tbody>
        {keys.map(([k, l]) => (
          <tr key={k} className="border-t border-line/60">
            <td className="py-1 text-ink2">{l}</td>
            <td className="py-1 text-right"><Delta v={e.ret[k]} /></td>
            <td className="py-1 text-right"><Delta v={e.ret_nok[k]} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Signals({ e }) {
  const s = e.scores;
  return (
    <div className="space-y-3">
      {PROFILES.map(p => {
        const pr = s.profiles[p.id];
        return (
          <div key={p.id}>
            <div className="flex items-center justify-between gap-2">
              <div><div className="text-sm font-medium text-ink">{p.long}</div><div className="text-[11px] text-muted">{p.weights}</div></div>
              <SignalBadge signal={pr.signal} score={pr.score} />
            </div>
            <div className="relative mt-1.5 h-1.5 rounded-full bg-line" aria-hidden>
              <div className="absolute inset-y-0 left-[40%] right-[40%] bg-ink/10" />
              <div className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded bg-ink" style={{ left: `calc(${pr.score}% - 2px)` }} />
            </div>
          </div>
        );
      })}
      <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
        <div>
          <div className="mb-1 font-medium text-ink">Verdsettelse <span className="num text-muted">{Math.round(s.val)}/100</span></div>
          <ul className="space-y-0.5 text-ink2">{s.val_notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
        <div>
          <div className="mb-1 font-medium text-ink">Trend <span className="num text-muted">{Math.round(s.trend)}/100</span></div>
          <ul className="space-y-0.5 text-ink2">{s.trend_notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      </div>
      {s.fund_note && <div className="text-xs text-ink2">Fundamental justering: {s.fund_note} ({s.fund_adj > 0 ? "+" : ""}{s.fund_adj})</div>}
      <p className="text-[11px] leading-relaxed text-muted">Score 0–100. Kjøp ≥ 60, Selg &lt; 40. Verdsettelse er kursbasert: lav prosentil = billig mot egen historikk og trend.</p>
    </div>
  );
}

function Valuation({ e }) {
  const v = e.valuation;
  return (
    <div>
      <div className="mb-3 rounded-lg bg-ink/[0.03] p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink">Trendjustert (5 år)</span>
          <ValTag p={v.detrended_pct} label={v.detrended_label} />
        </div>
        <div className="mt-1 text-xs text-ink2">
          {v.trend_dev != null
            ? <>Kursen ligger <b className="text-ink">{pct(v.trend_dev)}</b> fra sin langsiktige trendlinje ({pct(v.trend_cagr, 1, false)} årlig trendvekst). Prosentil {Math.round(v.detrended_pct)} av siste 5 års avvik.</>
            : "For kort historikk til trendjustert verdsettelse."}
        </div>
      </div>
      <table className="w-full text-sm">
        <thead><tr><th className="th pl-0">Vindu</th><th className="th">Prisprosentil</th><th className="th text-right">Laveste</th><th className="th pr-0 text-right">Høyeste</th></tr></thead>
        <tbody>
          {Object.entries(v.windows).map(([k, w]) => (
            <tr key={k} className="border-t border-line/60">
              <td className="py-1 text-ink2">{k}</td>
              <td className="py-1"><ValTag p={w.pct} label={w.label} /></td>
              <td className="py-1 text-right num text-ink2">{num(w.min, 2)}</td>
              <td className="py-1 text-right num text-ink2">{num(w.max, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Related({ e }) {
  const { corr, etfMap, openEtf } = useApp();
  if (!corr) return <div className="skeleton h-24" />;
  const i = corr.tickers.indexOf(e.ticker);
  if (i < 0) return <div className="text-sm text-muted">Ingen korrelasjonsdata.</div>;
  const row = corr.tickers.map((t, j) => ({ t, c: corr.m[i][j] })).filter(x => x.t !== e.ticker && x.c != null);
  row.sort((a, b) => b.c - a.c);
  const Item = ({ x }) => (
    <button onClick={() => openEtf(x.t)} className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-ink/5">
      <span className="truncate text-ink">{etfMap[x.t]?.short}</span>
      <span className="num text-xs text-ink2">{num(x.c, 2)}</span>
    </button>
  );
  return (
    <div className="grid grid-cols-2 gap-4">
      <div><div className="h-sub mb-1">Mest lik (høy korrelasjon)</div>{row.slice(0, 5).map(x => <Item key={x.t} x={x} />)}</div>
      <div><div className="h-sub mb-1">Best diversifisering</div>{row.slice(-5).reverse().map(x => <Item key={x.t} x={x} />)}</div>
      <p className="col-span-2 text-[11px] text-muted">{corr.window}.</p>
    </div>
  );
}

export default function EtfDrawer({ ticker, onClose }) {
  const { etfMap, etfs, news, corr, openChat } = useApp();
  const [watch, setWatch] = useStore(watchStore);
  const [compare, setCompare] = useStore(compareStore);
  const [modal, setModal] = useState(null);
  const e = etfMap[ticker];

  useEffect(() => {
    const k = ev => ev.key === "Escape" && !modal && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose, modal]);

  const sectorNews = news?.[e.sector] || [];
  const watched = watch.includes(ticker);
  const inCompare = compare.includes(ticker);

  const buildPrompt = () => {
    let neighbors = [];
    if (corr) {
      const i = corr.tickers.indexOf(ticker);
      if (i >= 0) neighbors = corr.tickers.map((t, j) => [t, corr.m[i][j]]).filter(([t, c]) => t !== ticker && c != null)
        .sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t, c]) => `${etfMap[t].short} (${c})`);
    }
    const ucitsAlt = e.region === "US" ? etfs.filter(x => x.region === "UCITS" && (x.sub === e.sub || x.sector === e.sector)).slice(0, 4).map(x => `${x.ticker} ${x.short}`) : [];
    return etfPrompt(e, { news: sectorNews, neighbors, ucitsAlt });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 animate-fade-in" onMouseDown={ev => ev.target === ev.currentTarget && onClose()}>
      <aside className="scroll-thin h-full w-full max-w-3xl overflow-y-auto bg-surface shadow-2xl animate-slide-in" role="dialog" aria-modal="true" aria-label={e.name}>
        <div className="sticky top-0 z-10 border-b border-line bg-surface/95 px-5 py-3 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <RegionTag region={e.region} />
                <span className="chip">{e.sector}</span>
                <span className="chip">{e.sub}</span>
              </div>
              <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-ink">{e.name}</h2>
              <div className="text-xs text-muted">{e.ticker} · {e.currency} · kurs per {date(e.date)}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xl font-semibold text-ink">{price(e.price, e.currency)}</div>
              <div className="text-sm"><Delta v={e.ret["1D"]} d={2} /> <span className="text-xs text-muted">· {price(e.price_nok, "kr")}</span></div>
            </div>
            <button className="btn-ghost -mr-2 p-1.5" onClick={onClose} aria-label="Lukk"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={`btn-outline text-xs ${watched ? "border-warn text-ink" : ""}`} onClick={() => setWatch(w => (watched ? w.filter(x => x !== ticker) : [...w, ticker]))}>
              <Star className={`h-3.5 w-3.5 ${watched ? "fill-warn text-warn" : ""}`} /> {watched ? "Overvåkes" : "Overvåk"}
            </button>
            <button className="btn-outline text-xs" onClick={() => setModal("tx")}><Plus className="h-3.5 w-3.5" /> Legg i portefølje</button>
            <button className="btn-outline text-xs" onClick={() => setModal("alert")}><Bell className="h-3.5 w-3.5" /> Lag varsel</button>
            <button className={`btn-outline text-xs ${inCompare ? "border-accent text-accent" : ""}`} onClick={() => setCompare(c => (inCompare ? c.filter(x => x !== ticker) : [...c, ticker].slice(-6)))}>
              <GitCompare className="h-3.5 w-3.5" /> {inCompare ? "I sammenligning" : "Sammenlign"}
            </button>
            <button className="btn-outline text-xs" onClick={() => openChat(`Hva bør jeg vite om ${e.short} (${e.ticker}) akkurat nå?`)}><MessageSquare className="h-3.5 w-3.5" /> Spør AI</button>
          </div>
          {e.region === "US" && (
            <p className="mt-2 rounded-lg bg-warn/10 px-3 py-1.5 text-xs text-ink">
              Amerikansk ETF: vises som markedssignal, men kan ikke kjøpes av norske privatkunder (PRIIPs/KID). Se UCITS-alternativer i samme sektor.
            </p>
          )}
        </div>

        <div className="px-5 py-4"><PriceChart e={e} /></div>

        <div className="grid sm:grid-cols-2">
          <Section title="Avkastning"><Returns e={e} /></Section>
          <Section title="Signaler"><Signals e={e} /></Section>
        </div>

        <Section title="AI-analyse" right={<span className="text-[11px] text-muted">Gemini + Google-søk</span>}>
          <AiBox cacheKey={`etf|${ticker}`} buildPrompt={buildPrompt}
            hint="Gemini tolker tallene, søker etter ferske nyheter om sektoren og vurderer ETF-en under alle tre profilene." />
        </Section>

        <div className="grid sm:grid-cols-2">
          <Section title="Trend">
            <div className="mb-2"><TrendTag label={e.trend.label} /></div>
            <KV k="50-dagers snitt" v={num(e.trend.ma50, 2)} />
            <KV k="200-dagers snitt" v={num(e.trend.ma200, 2)} />
            <KV k="Avstand til MA200" v={<Delta v={e.trend.dist_ma200} />} />
            <KV k="Trendhelning (3 mnd)" v={<>{pct(e.trend.slope_month)}/mnd</>} hint={`R² ${num(e.trend.r2, 2)}`} />
            <KV k="RSI (14)" v={num(e.trend.rsi, 0)} />
            <KV k="Momentum 12–1 mnd" v={<Delta v={e.trend.mom_12_1} />} />
            <KV k="Relativ styrke vs ACWI (3M)" v={<Delta v={e.rel_3m} />} />
            <KV k="52-ukers spenn" v={`${num(e.trend.low_52w, 2)} – ${num(e.trend.high_52w, 2)}`} />
            <KV k="Fra 52-ukers topp" v={<Delta v={e.trend.from_high_52w} />} />
            <KV k="Fra all-time high" v={<Delta v={e.trend.from_ath} />} />
          </Section>
          <Section title="Risiko (i NOK)">
            <KV k="Volatilitet 1 år" v={pct(e.risk.vol_1y, 1, false)} />
            <KV k="Volatilitet 3 år" v={pct(e.risk.vol_3y, 1, false)} />
            <KV k="Maks fall 1 / 3 / 5 år" v={`${pct(e.risk.maxdd_1y, 0)} / ${pct(e.risk.maxdd_3y, 0)} / ${pct(e.risk.maxdd_5y, 0)}`} />
            <KV k="Sharpe 1 år / 3 år" v={`${num(e.risk.sharpe_1y, 2)} / ${num(e.risk.sharpe_3y, 2)}`} hint="Risikofri rente = 0" />
            <KV k="Sortino 1 år" v={num(e.risk.sortino_1y, 2)} />
            <KV k="Beta mot ACWI" v={num(e.risk.beta, 2)} />
            <KV k="Korrelasjon mot ACWI" v={num(e.risk.corr_bench, 2)} />
            <KV k="VaR 95 % (én dag)" v={<Delta v={e.risk.var95_1d} />} hint="Historisk: 1 av 20 dager falt mer enn dette siste år" />
          </Section>
        </div>

        <div className="grid sm:grid-cols-2">
          <Section title="Verdsettelse vs historikk"><Valuation e={e} /></Section>
          <Section title="Fondsfakta">
            <KV k="Forvaltningshonorar (TER)" v={e.fund.ter != null ? `${num(e.fund.ter, 2)} %` : "–"} />
            <KV k="Forvaltningskapital" v={big(e.fund.aum)} />
            <KV k="Utbytteavkastning" v={e.fund.yield != null ? `${num(e.fund.yield, 2)} %` : "–"} />
            <KV k="P/E (snitt beholdning)" v={num(e.fund.pe, 1)} />
            <KV k="P/B" v={num(e.fund.pb, 2)} />
            <KV k="Forvalter" v={e.fund.family || "–"} />
            <KV k="Oppstart" v={date(e.fund.inception)} />
            <KV k="Kurshistorikk fra" v={date(e.history_start)} />
            <a className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline" href={`https://finance.yahoo.com/quote/${encodeURIComponent(e.ticker)}`} target="_blank" rel="noopener noreferrer">
              Se på Yahoo Finance <ExternalLink className="h-3 w-3" />
            </a>
            {e.region === "UCITS" && (
              <a className="ml-4 mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline" href={`https://www.justetf.com/no/search.html?query=${encodeURIComponent(e.name)}`} target="_blank" rel="noopener noreferrer">
                Finn på justETF <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </Section>
        </div>

        <Section title="Korrelasjon med andre ETF-er"><Related e={e} /></Section>

        <Section title={`Nyheter: ${e.sector}`}>
          {!news ? <Spinner /> : !sectorNews.length ? <div className="text-sm text-muted">Ingen nyheter.</div> : (
            <ul className="space-y-2">
              {sectorNews.slice(0, 8).map((n, i) => (
                <li key={i}>
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="group block">
                    <div className="text-sm leading-snug text-ink group-hover:text-accent">{n.title}</div>
                    <div className="text-[11px] text-muted">{n.source} · {ago(n.published)}</div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <div className="h-10" />
      </aside>

      {modal === "tx" && <Modal title="Legg til transaksjon" onClose={() => setModal(null)}><TxForm ticker={ticker} onDone={() => setModal(null)} /></Modal>}
      {modal === "alert" && <Modal title="Nytt varsel" onClose={() => setModal(null)} wide><AlertForm ticker={ticker} onDone={() => setModal(null)} /></Modal>}
    </div>
  );
}

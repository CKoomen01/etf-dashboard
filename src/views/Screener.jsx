import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Download, GitCompare, Search, Star } from "lucide-react";
import { useApp } from "../lib/context.js";
import { compareStore, settingsStore, useStore, watchStore } from "../lib/store.js";
import { PROFILES } from "../lib/data.js";
import { SECTOR_ORDER } from "../lib/colors.js";
import { big, num, pct, price } from "../lib/format.js";
import { Delta, RegionTag, Seg, SignalBadge, Sparkline, TrendTag, ValTag } from "../components/ui.jsx";
import { ProfileSeg, RegionSeg, useFiltered } from "./Overview.jsx";

const n0 = v => num(v, 0), n2 = v => num(v, 2);
const PRESETS = {
  avkastning: {
    label: "Avkastning",
    cols: [
      ["1D", "I dag", (e, R) => R(e)["1D"], v => <Delta v={v} d={2} />],
      ["1W", "1 uke", (e, R) => R(e)["1W"], v => <Delta v={v} />],
      ["1M", "1 mnd", (e, R) => R(e)["1M"], v => <Delta v={v} />],
      ["3M", "3 mnd", (e, R) => R(e)["3M"], v => <Delta v={v} />],
      ["YTD", "Hittil i år", (e, R) => R(e).YTD, v => <Delta v={v} />],
      ["1Y", "1 år", (e, R) => R(e)["1Y"], v => <Delta v={v} />],
      ["3Y", "3 år p.a.", (e, R) => R(e)["3Y"], v => <Delta v={v} />],
    ],
  },
  teknisk: {
    label: "Teknisk",
    cols: [
      ["trend", "Trend", e => e.trend.label, v => <TrendTag label={v} />],
      ["rsi", "RSI", e => e.trend.rsi, v => <span className={v > 70 ? "text-down" : v < 30 ? "text-up" : ""}>{n0(v)}</span>],
      ["ma200", "vs MA200", e => e.trend.dist_ma200, v => <Delta v={v} />],
      ["slope", "Helning/mnd", e => e.trend.slope_month, v => <Delta v={v} />],
      ["mom", "12–1 mnd", e => e.trend.mom_12_1, v => <Delta v={v} />],
      ["hi", "Fra 52u-topp", e => e.trend.from_high_52w, v => <Delta v={v} />],
      ["rel", "Rel. styrke 3M", e => e.rel_3m, v => <Delta v={v} />],
    ],
  },
  risiko: {
    label: "Risiko",
    cols: [
      ["vol", "Volatilitet 1 år", e => e.risk.vol_1y, v => pct(v, 1, false)],
      ["dd", "Maks fall 3 år", e => e.risk.maxdd_3y, v => <Delta v={v} />],
      ["sharpe", "Sharpe 1 år", e => e.risk.sharpe_1y, n2],
      ["sortino", "Sortino 1 år", e => e.risk.sortino_1y, n2],
      ["beta", "Beta", e => e.risk.beta, n2],
      ["corr", "Korr. ACWI", e => e.risk.corr_bench, n2],
      ["var", "VaR 95 % (dag)", e => e.risk.var95_1d, v => <Delta v={v} />],
    ],
  },
  verdi: {
    label: "Verdsettelse",
    cols: [
      ["detr", "Trendjustert", e => e.valuation.detrended_pct, (v, e) => <ValTag p={v} label={e.valuation.detrended_label} />],
      ["dev", "Fra trendlinje", e => e.valuation.trend_dev, v => <Delta v={v} />],
      ["p1", "Pris-pct 1 år", e => e.valuation.windows["1Y"]?.pct, n0],
      ["p5", "Pris-pct 5 år", e => e.valuation.windows["5Y"]?.pct, n0],
      ["ter", "TER", e => e.fund.ter, v => (v == null ? "–" : `${num(v, 2)} %`)],
      ["yield", "Utbytte", e => e.fund.yield, v => (v == null ? "–" : `${num(v, 2)} %`)],
      ["pe", "P/E", e => e.fund.pe, v => num(v, 1)],
      ["aum", "Størrelse", e => e.fund.aum, v => big(v)],
    ],
  },
  signaler: {
    label: "Signaler",
    cols: [
      ...PROFILES.map(p => [p.id, p.label, e => e.scores.profiles[p.id].score, (v, e) => <SignalBadge signal={e.scores.profiles[p.id].signal} score={v} />]),
      ["vs", "Verdi-score", e => e.scores.val, n0],
      ["ts", "Trend-score", e => e.scores.trend, n0],
    ],
  },
};

function toCsv(rows, cols, R) {
  const head = ["Ticker", "Navn", "Region", "Sektor", "Undersektor", "Kurs", "Valuta", ...cols.map(c => c[1])];
  const body = rows.map(e => [e.ticker, e.name, e.region, e.sector, e.sub, e.price, e.currency, ...cols.map(c => c[2](e, R) ?? "")]);
  return [head, ...body].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
}

export default function Screener({ params }) {
  const { openEtf, go } = useApp();
  const [settings] = useStore(settingsStore);
  const [watch, setWatch] = useStore(watchStore);
  const [compare, setCompare] = useStore(compareStore);
  const base = useFiltered();
  const [q, setQ] = useState("");
  const [sector, setSector] = useState(params.sector || "");
  const [sig, setSig] = useState("");
  const [preset, setPreset] = useState("avkastning");
  const [sort, setSort] = useState({ key: "sector", dir: 1 });
  const [onlyWatch, setOnlyWatch] = useState(false);
  useEffect(() => { if (params.sector) setSector(params.sector); }, [params.sector]);

  const R = e => (settings.currency === "NOK" ? e.ret_nok : e.ret);
  const cols = PRESETS[preset].cols;
  const p = settings.profile;

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = base.filter(e =>
      (!sector || e.sector === sector) &&
      (!sig || e.scores.profiles[p].signal === sig) &&
      (!onlyWatch || watch.includes(e.ticker)) &&
      (!s || [e.ticker, e.name, e.short, e.sector, e.sub].some(x => x.toLowerCase().includes(s))));
    const col = cols.find(c => c[0] === sort.key);
    const get = sort.key === "sector" ? e => SECTOR_ORDER.indexOf(e.sector) * 1000 + (e.region === "UCITS" ? 0 : 500)
      : sort.key === "name" ? e => e.short
        : sort.key === "signal" ? e => e.scores.profiles[p].score
          : col ? e => col[2](e, R) : () => 0;
    list = [...list].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      return (typeof va === "string" ? va.localeCompare(vb, "nb") : va - vb) * sort.dir;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, q, sector, sig, sort, preset, settings.currency, p, onlyWatch, watch]);

  const toggleSort = key => setSort(s => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === "name" || key === "sector" ? 1 : -1 }));
  const Th = ({ k, children, right }) => (
    <th className={`th cursor-pointer hover:text-ink ${right ? "text-right" : ""}`} onClick={() => toggleSort(k)} aria-sort={sort.key === k ? (sort.dir > 0 ? "ascending" : "descending") : undefined}>
      {children}{sort.key === k && (sort.dir > 0 ? <ChevronUp className="ml-0.5 inline h-3 w-3" /> : <ChevronDown className="ml-0.5 inline h-3 w-3" />)}
    </th>
  );

  const toggleCompare = t => setCompare(c => (c.includes(t) ? c.filter(x => x !== t) : [...c, t].slice(-6)));
  const toggleWatch = t => setWatch(w => (w.includes(t) ? w.filter(x => x !== t) : [...w, t]));

  function downloadCsv() {
    const blob = new Blob(["﻿" + toCsv(rows, cols, R)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `etf-screener-${preset}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Screener</h1>
        <div className="flex flex-wrap gap-2"><RegionSeg /><ProfileSeg /></div>
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-8" placeholder="Søk etter navn, ticker eller tema …" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={sector} onChange={e => setSector(e.target.value)} aria-label="Sektor">
          <option value="">Alle sektorer</option>
          {SECTOR_ORDER.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="input w-auto" value={sig} onChange={e => setSig(e.target.value)} aria-label="Signal">
          <option value="">Alle signaler</option>
          <option value="BUY">Kjøp</option><option value="HOLD">Hold</option><option value="SELL">Selg</option>
        </select>
        <button className={`btn-outline ${onlyWatch ? "border-accent text-accent" : ""}`} onClick={() => setOnlyWatch(v => !v)} aria-pressed={onlyWatch}>
          <Star className={`h-4 w-4 ${onlyWatch ? "fill-current" : ""}`} /> Overvåket
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Seg label="Kolonner" value={preset} onChange={setPreset} options={Object.entries(PRESETS).map(([k, v]) => [k, v.label])} />
        <div className="flex items-center gap-2 text-xs text-muted">
          {rows.length} av {base.length} ETF-er
          {compare.length > 0 && <button className="btn-outline text-xs" onClick={() => go("sammenlign")}><GitCompare className="h-3.5 w-3.5" /> Sammenlign ({compare.length})</button>}
          <button className="btn-ghost text-xs" onClick={downloadCsv}><Download className="h-3.5 w-3.5" /> CSV</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-b border-line bg-ink/[0.02]">
              <tr>
                <th className="th w-8" aria-label="Overvåk" />
                <Th k="name">ETF</Th>
                <Th k="sector">Sektor</Th>
                <th className="th text-right">Kurs</th>
                {cols.map(c => <Th key={c[0]} k={c[0]} right>{c[1]}</Th>)}
                <th className="th">3 mnd</th>
                {preset !== "signaler" && <Th k="signal">Signal</Th>}
                <th className="th w-8" aria-label="Sammenlign" />
              </tr>
            </thead>
            <tbody>
              {rows.map(e => {
                const pr = e.scores.profiles[p];
                return (
                  <tr key={e.ticker} className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-ink/[0.03]" onClick={() => openEtf(e.ticker)}>
                    <td className="td pr-0" onClick={ev => { ev.stopPropagation(); toggleWatch(e.ticker); }}>
                      <Star className={`h-4 w-4 ${watch.includes(e.ticker) ? "fill-warn text-warn" : "text-muted hover:text-ink"}`} aria-label={watch.includes(e.ticker) ? "Fjern fra overvåking" : "Overvåk"} />
                    </td>
                    <td className="td max-w-[280px]">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-ink">{e.short}</span>
                        <RegionTag region={e.region} />
                      </div>
                      <div className="truncate text-[11px] text-muted">{e.ticker} · {e.name}</div>
                    </td>
                    <td className="td"><div className="text-ink2">{e.sector}</div><div className="text-[11px] text-muted">{e.sub}</div></td>
                    <td className="td text-right num">
                      {settings.currency === "NOK" ? <span className="text-ink">{price(e.price_nok, "kr")}</span> : <span className="text-ink">{price(e.price, e.currency)}</span>}
                    </td>
                    {cols.map(c => {
                      const v = c[2](e, R);
                      return <td key={c[0]} className="td text-right num">{c[3](v, e)}</td>;
                    })}
                    <td className="td"><Sparkline data={e.spark} width={84} height={24} /></td>
                    {preset !== "signaler" && <td className="td"><SignalBadge signal={pr.signal} score={pr.score} /></td>}
                    <td className="td pl-0" onClick={ev => ev.stopPropagation()}>
                      <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={compare.includes(e.ticker)} onChange={() => toggleCompare(e.ticker)}
                        title="Legg til i sammenligning" aria-label={`Sammenlign ${e.short}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && <div className="py-10 text-center text-sm text-muted">Ingen ETF-er matcher filteret.</div>}
        </div>
      </div>
    </div>
  );
}

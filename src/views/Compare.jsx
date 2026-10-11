import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { useApp } from "../lib/context.js";
import { compareStore, settingsStore, useStore } from "../lib/store.js";
import { loadHistory, PROFILES, rangeStart, RANGES, toNok } from "../lib/data.js";
import { diverging, inkOn, SERIES, useDark } from "../lib/colors.js";
import { num, pct } from "../lib/format.js";
import { Card, Delta, Empty, RegionTag, Seg, SignalBadge, TrendTag, ValTag } from "../components/ui.jsx";
import LineChart from "../components/LineChart.jsx";
import Scatter from "../components/Scatter.jsx";
import { EtfSelect } from "../components/Forms.jsx";
import { RegionSeg, useFiltered } from "./Overview.jsx";

const ROWS = [
  ["Region", e => <RegionTag region={e.region} />],
  ["Sektor", e => e.sub],
  ["I dag", (e, R) => <Delta v={R(e)["1D"]} d={2} />],
  ["1 mnd", (e, R) => <Delta v={R(e)["1M"]} />],
  ["Hittil i år", (e, R) => <Delta v={R(e).YTD} />],
  ["1 år", (e, R) => <Delta v={R(e)["1Y"]} />],
  ["3 år p.a.", (e, R) => <Delta v={R(e)["3Y"]} />],
  ["5 år p.a.", (e, R) => <Delta v={R(e)["5Y"]} />],
  ["Trend", e => <TrendTag label={e.trend.label} />],
  ["RSI", e => num(e.trend.rsi, 0)],
  ["Trendjustert verdsettelse", e => <ValTag p={e.valuation.detrended_pct} label={e.valuation.detrended_label} />],
  ["Volatilitet 1 år", e => pct(e.risk.vol_1y, 1, false)],
  ["Maks fall 3 år", e => <Delta v={e.risk.maxdd_3y} />],
  ["Sharpe 1 år", e => num(e.risk.sharpe_1y, 2)],
  ["Beta mot ACWI", e => num(e.risk.beta, 2)],
  ["TER", e => (e.fund.ter != null ? `${num(e.fund.ter, 2)} %` : "–")],
  ...PROFILES.map(p => [`Signal ${p.label}`, e => <SignalBadge signal={e.scores.profiles[p.id].signal} score={e.scores.profiles[p.id].score} small />]),
];

function CorrTable({ tickers }) {
  const { corr, etfMap } = useApp();
  const dark = useDark();
  if (!corr) return null;
  const idx = tickers.map(t => corr.tickers.indexOf(t));
  if (idx.some(i => i < 0)) return null;
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="border-separate text-xs" style={{ borderSpacing: 2 }}>
        <thead><tr><th />{tickers.map(t => <th key={t} className="th max-w-[90px] truncate text-center">{etfMap[t].short}</th>)}</tr></thead>
        <tbody>
          {tickers.map((t, a) => (
            <tr key={t}>
              <th className="whitespace-nowrap pr-2 text-left font-normal text-ink2">{etfMap[t].short}</th>
              {tickers.map((u, b) => {
                const v = corr.m[idx[a]][idx[b]];
                const bg = a === b ? "rgb(var(--line))" : diverging(v, 1, dark);
                return <td key={u} className="h-9 min-w-[64px] rounded-[4px] text-center font-medium num" style={{ background: bg, color: a === b ? "rgb(var(--muted))" : inkOn(bg) }}>{a === b ? "–" : num(v, 2)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted">1 = beveger seg helt likt, 0 = uavhengig, negativ = motsatt. {corr.window}.</p>
    </div>
  );
}

export default function Compare() {
  const { etfMap, fx, openEtf } = useApp();
  const [settings] = useStore(settingsStore);
  const [list, setList] = useStore(compareStore);
  const dark = useDark();
  const [range, setRange] = useState("1Y");
  const [cur, setCur] = useState(settings.currency === "NOK" ? "NOK" : "LOCAL");
  const [hists, setHists] = useState({});
  const [adding, setAdding] = useState("EUNL.DE");
  const scatterEtfs = useFiltered();
  const tickers = list.filter(t => etfMap[t]);
  const pal = SERIES[dark ? "dark" : "light"];
  const R = e => (cur === "NOK" ? e.ret_nok : e.ret);

  useEffect(() => {
    tickers.filter(t => !hists[t]).forEach(t => loadHistory(t).then(h => setHists(x => ({ ...x, [t]: h }))).catch(() => {}));
  }, [tickers.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const series = useMemo(() => {
    const ready = tickers.filter(t => hists[t]);
    if (!ready.length) return [];
    const last = ready.map(t => hists[t].d.at(-1)).sort().at(-1);
    let start = rangeStart(range, last);
    // Felles startdato: den seneste første-datoen blant ETF-ene
    start = [start, ...ready.map(t => hists[t].d[0])].sort().at(-1);
    return tickers.map((t, i) => {
      const h0 = hists[t];
      if (!h0) return null;
      const h = cur === "NOK" ? toNok(h0, fx) : h0;
      const j = h.d.findIndex(d => d >= start);
      if (j < 0) return null;
      const base = h.c[j];
      return { id: t, label: etfMap[t].short, color: pal[i], data: h.d.slice(j).map((d, k) => ({ time: d, value: (h.c[j + k] / base) * 100 })) };
    }).filter(Boolean);
  }, [tickers.join(","), hists, range, cur, fx, dark]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = () => setList(l => (l.includes(adding) ? l : [...l, adding].slice(-6)));
  const remove = t => setList(l => l.filter(x => x !== t));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Sammenlign</h1>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {tickers.map((t, i) => (
            <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-line py-1 pl-2.5 pr-1 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: pal[i] }} aria-hidden />
              <button className="text-ink hover:text-accent" onClick={() => openEtf(t)}>{etfMap[t].short}</button>
              <button className="rounded-full p-0.5 text-muted hover:bg-ink/5 hover:text-ink" onClick={() => remove(t)} aria-label={`Fjern ${etfMap[t].short}`}><X className="h-3.5 w-3.5" /></button>
            </span>
          ))}
          {tickers.length < 6 && (
            <div className="flex items-center gap-1.5">
              <EtfSelect value={adding} onChange={setAdding} className="w-56" />
              <button className="btn-outline" onClick={add}><Plus className="h-4 w-4" /> Legg til</button>
            </div>
          )}
          <span className="text-xs text-muted">Maks 6 ETF-er</span>
        </div>
      </Card>

      {!tickers.length ? (
        <Card><Empty title="Velg ETF-er å sammenligne">Legg til opptil seks ETF-er over, eller huk av i screeneren.</Empty></Card>
      ) : (
        <>
          <Card title="Utvikling, indeksert til 100" sub="Samme startdato for alle, slik at kurvene kan sammenlignes direkte"
            right={<div className="flex flex-wrap gap-2"><Seg label="Periode" value={range} onChange={setRange} options={RANGES.map(r => r.id)} /><Seg label="Valuta" value={cur} onChange={setCur} options={[["NOK", "NOK"], ["LOCAL", "Lokal"]]} /></div>}>
            {series.length ? <LineChart series={series} height={340} baseline={100} format={v => num(v, 1)} /> : <div className="skeleton h-[340px]" />}
          </Card>

          <Card title="Nøkkeltall side om side" pad={false}>
            <div className="scroll-thin overflow-x-auto px-2 pb-3">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="th" />
                    {tickers.map((t, i) => (
                      <th key={t} className="th text-right">
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: pal[i] }} aria-hidden />{etfMap[t].short}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(([label, fn]) => (
                    <tr key={label} className="border-t border-line/60">
                      <td className="td text-ink2">{label}</td>
                      {tickers.map(t => <td key={t} className="td text-right num">{fn(etfMap[t], R)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {tickers.length > 1 && <Card title="Korrelasjon" sub="Lav korrelasjon gir bedre spredning av risiko"><CorrTable tickers={tickers} /></Card>}
        </>
      )}

      <Card title="Risiko mot avkastning" sub="Siste 12 måneder i NOK. Opp og til venstre er best. Klikk en prikk for detaljer." right={<RegionSeg />}>
        <Scatter etfs={scatterEtfs} highlight={tickers} onSelect={openEtf} />
      </Card>
    </div>
  );
}

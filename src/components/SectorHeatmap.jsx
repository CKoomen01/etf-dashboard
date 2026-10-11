// Sektor × periode. Hver celle er snittavkastningen for ETF-ene i sektoren.
// Fargeskalaen er divergerende (rød ↔ grå ↔ blå) og skaleres per kolonne, siden 1D og 1Y har ulike størrelser.
import { useMemo } from "react";
import { useApp } from "../lib/context.js";
import { diverging, inkOn, SECTOR_ORDER, useDark } from "../lib/colors.js";
import { pct } from "../lib/format.js";
import { useTip } from "./ui.jsx";

const H = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y"];

export default function SectorHeatmap({ etfs, currency }) {
  const { go } = useApp();
  const dark = useDark();
  const tip = useTip();
  const key = currency === "NOK" ? "ret_nok" : "ret";

  const { rows, max } = useMemo(() => {
    const by = {};
    for (const e of etfs) (by[e.sector] ||= []).push(e);
    const rows = SECTOR_ORDER.filter(s => by[s]).map(s => ({
      sector: s,
      list: by[s],
      vals: Object.fromEntries(H.map(h => {
        const xs = by[s].map(e => e[key][h]).filter(v => v != null);
        return [h, xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null];
      })),
    }));
    const max = Object.fromEntries(H.map(h => [h, Math.max(0.5, ...rows.map(r => Math.abs(r.vals[h] ?? 0)))]));
    return { rows, max };
  }, [etfs, key]);

  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full min-w-[560px] border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="th pl-1">Sektor</th>
            {H.map(h => <th key={h} className="th text-center">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.sector} className="group cursor-pointer" onClick={() => go("screener", { sector: r.sector })}>
              <td className="whitespace-nowrap py-1 pl-1 pr-3 text-sm text-ink group-hover:text-accent">
                {r.sector} <span className="text-[11px] text-muted">({r.list.length})</span>
              </td>
              {H.map(h => {
                const v = r.vals[h];
                const bg = diverging(v, max[h], dark);
                return (
                  <td key={h} className="h-9 min-w-[64px] rounded-[4px] text-center text-xs font-medium num"
                    style={{ background: bg, color: inkOn(bg) }}
                    onMouseMove={ev => tip.show(ev, (
                      <div>
                        <div className="mb-1 font-semibold">{r.sector} · {h}</div>
                        {[...r.list].sort((a, b) => (b[key][h] ?? -999) - (a[key][h] ?? -999)).map(e => (
                          <div key={e.ticker} className="flex justify-between gap-4"><span className="text-ink2">{e.short}</span><span className="num">{pct(e[key][h])}</span></div>
                        ))}
                      </div>
                    ))}
                    onMouseLeave={tip.hide}>
                    {pct(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {tip.node}
    </div>
  );
}

// Risiko/avkastning: x = volatilitet 1 år, y = avkastning 1 år (NOK). Én prikk per ETF.
// To kategorier (UCITS / US) i de to første palettfargene; valgte ETF-er får etikett og ring.
import { useMemo, useRef, useState } from "react";
import { CHROME, SERIES, useDark } from "../lib/colors.js";
import { num, pct } from "../lib/format.js";
import { Legend } from "./ui.jsx";

const W = 720, H = 380, M = { l: 48, r: 16, t: 12, b: 36 };

function ticks(min, max, n = 6) {
  const step = Math.pow(10, Math.floor(Math.log10((max - min) / n)));
  const err = (max - min) / n / step;
  const s = step * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1);
  const out = [];
  for (let v = Math.ceil(min / s) * s; v <= max; v += s) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

export default function Scatter({ etfs, highlight = [], onSelect, xKey = e => e.risk.vol_1y, yKey = e => e.ret_nok["1Y"] }) {
  const dark = useDark();
  const c = CHROME[dark ? "dark" : "light"];
  const pal = SERIES[dark ? "dark" : "light"];
  const svg = useRef(null);
  const [hover, setHover] = useState(null);

  const pts = useMemo(() => etfs.map(e => ({ e, x: xKey(e), y: yKey(e) })).filter(p => p.x != null && p.y != null), [etfs, xKey, yKey]);
  if (!pts.length) return null;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = 0, x1 = Math.max(...xs) * 1.05;
  const pad = (Math.max(...ys) - Math.min(...ys)) * 0.06 || 5;
  const y0 = Math.min(0, Math.min(...ys) - pad), y1 = Math.max(...ys) + pad;
  const sx = v => M.l + ((v - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = v => H - M.b - ((v - y0) / (y1 - y0)) * (H - M.t - M.b);

  function onMove(ev) {
    const r = svg.current.getBoundingClientRect();
    const mx = ((ev.clientX - r.left) / r.width) * W, my = ((ev.clientY - r.top) / r.height) * H;
    let best = null, bd = 30 * 30;
    for (const p of pts) {
      const d = (sx(p.x) - mx) ** 2 + (sy(p.y) - my) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    setHover(best);
  }

  const color = e => (e.region === "UCITS" ? pal[0] : pal[1]);
  const hl = new Set(highlight);

  return (
    <div>
      <Legend items={[{ label: "UCITS (kjøpbar i Norge)", color: pal[0] }, { label: "US (kun signal)", color: pal[1] }]} />
      <div className="relative mt-2">
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="w-full cursor-crosshair" role="img" aria-label="Risiko mot avkastning"
          onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={() => hover && onSelect?.(hover.e.ticker)}>
          {ticks(y0, y1).map(t => (
            <g key={`y${t}`}>
              <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? c.axis : c.grid} strokeWidth="1" />
              <text x={M.l - 6} y={sy(t)} dy="0.32em" textAnchor="end" fontSize="10" fill={c.muted}>{num(t, 0)} %</text>
            </g>
          ))}
          {ticks(x0, x1).map(t => (
            <text key={`x${t}`} x={sx(t)} y={H - M.b + 16} textAnchor="middle" fontSize="10" fill={c.muted}>{num(t, 0)} %</text>
          ))}
          <text x={W - M.r} y={H - 4} textAnchor="end" fontSize="10" fill={c.ink2}>Volatilitet 1 år →</text>
          <text x={M.l} y={M.t - 2} fontSize="10" fill={c.ink2} dy="0.8em" dx="4">↑ Avkastning 1 år (NOK)</text>
          {pts.map(p => (
            <circle key={p.e.ticker} cx={sx(p.x)} cy={sy(p.y)} r={hl.has(p.e.ticker) ? 6 : 4.5}
              fill={color(p.e)} fillOpacity={hl.size && !hl.has(p.e.ticker) ? 0.35 : 0.9}
              stroke={c.surface} strokeWidth="2" />
          ))}
          {pts.filter(p => hl.has(p.e.ticker)).map(p => (
            <text key={`l${p.e.ticker}`} x={sx(p.x) + 9} y={sy(p.y)} dy="0.32em" fontSize="11" fontWeight="600" fill={c.ink}
              stroke={c.surface} strokeWidth="3" paintOrder="stroke">{p.e.short}</text>
          ))}
          {hover && <circle cx={sx(hover.x)} cy={sy(hover.y)} r="9" fill="none" stroke={c.ink} strokeWidth="1.5" />}
        </svg>
        {hover && (
          <div className="pointer-events-none absolute z-10 rounded-lg border border-line bg-raised px-3 py-2 text-xs shadow-lg"
            style={{ left: `${(sx(hover.x) / W) * 100}%`, top: `${(sy(hover.y) / H) * 100}%`, transform: `translate(${sx(hover.x) > W * 0.7 ? "-110%" : "12px"}, -50%)` }}>
            <div className="font-semibold text-ink">{hover.e.short} <span className="font-normal text-muted">{hover.e.ticker}</span></div>
            <div className="text-ink2">Avkastning 1 år: <span className="num text-ink">{pct(hover.y)}</span></div>
            <div className="text-ink2">Volatilitet: <span className="num text-ink">{pct(hover.x, 1, false)}</span></div>
            <div className="text-ink2">Sharpe: <span className="num text-ink">{num(hover.e.risk.sharpe_1y, 2)}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

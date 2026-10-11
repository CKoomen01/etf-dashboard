// Tynn innpakning rundt TradingView Lightweight Charts med tema, krysshår og forklaring.
import { useEffect, useRef, useState } from "react";
import { createChart, CrosshairMode, LineStyle } from "lightweight-charts";
import { CHROME, useDark } from "../lib/colors.js";
import { date as fmtDate, num } from "../lib/format.js";

/**
 * series: [{ id, label, color, data: [{time:"YYYY-MM-DD", value}], area?, dashed?, width? }]
 * format: (v) => string   formatering av verdier i aksen og forklaringen
 */
export default function LineChart({ series, height = 320, format = v => num(v, 2), baseline = null }) {
  const el = useRef(null);
  const chartRef = useRef(null);
  const apiRefs = useRef([]);
  const dark = useDark();
  const [hover, setHover] = useState(null);

  // Opprett diagram én gang
  useEffect(() => {
    const chart = createChart(el.current, {
      autoSize: true,
      crosshair: { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      handleScale: { axisPressedMouseMove: false },
      localization: { locale: "nb-NO" },
    });
    chartRef.current = chart;
    chart.subscribeCrosshairMove(p => {
      if (!p.time || !p.point) { setHover(null); return; }
      const vals = apiRefs.current.map(({ meta, api }) => ({ ...meta, value: p.seriesData.get(api)?.value }));
      setHover({ time: p.time, vals });
    });
    return () => { chart.remove(); chartRef.current = null; apiRefs.current = []; };
  }, []);

  // Tema
  useEffect(() => {
    const c = CHROME[dark ? "dark" : "light"];
    chartRef.current?.applyOptions({
      layout: { background: { type: "solid", color: "transparent" }, textColor: c.muted, fontFamily: "Inter, system-ui, sans-serif", fontSize: 11 },
      grid: { vertLines: { visible: false }, horzLines: { color: c.grid } },
      crosshair: { vertLine: { color: c.axis, labelBackgroundColor: c.ink2 }, horzLine: { color: c.axis, labelBackgroundColor: c.ink2 } },
      localization: { locale: "nb-NO", priceFormatter: format },
    });
  }, [dark, format]);

  // Serier
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    apiRefs.current.forEach(({ api }) => chart.removeSeries(api));
    apiRefs.current = series.filter(s => s.data?.length).map(s => {
      const common = {
        lineWidth: s.width ?? 2,
        priceLineVisible: false,
        lastValueVisible: !s.dashed,
        lineStyle: s.dashed ? LineStyle.Dashed : LineStyle.Solid,
        crosshairMarkerRadius: 4,
      };
      const api = s.area
        ? chart.addAreaSeries({ ...common, lineColor: s.color, topColor: `${s.color}33`, bottomColor: `${s.color}00` })
        : chart.addLineSeries({ ...common, color: s.color });
      api.setData(s.data);
      if (baseline != null && apiRefs.current.length === 0) {
        api.createPriceLine({ price: baseline, color: CHROME[dark ? "dark" : "light"].axis, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: false });
      }
      return { api, meta: { id: s.id, label: s.label, color: s.color } };
    });
    chart.timeScale().fitContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, baseline]);

  const last = series.filter(s => s.data?.length).map(s => ({ id: s.id, label: s.label, color: s.color, value: s.data.at(-1).value }));
  const shown = hover?.vals ?? last;

  return (
    <div>
      <div className="mb-1 flex min-h-5 flex-wrap items-center gap-x-4 gap-y-0.5 text-xs">
        <span className="text-muted num">{hover ? fmtDate(hover.time) : "Siste"}</span>
        {shown.map(v => (
          <span key={v.id} className="inline-flex items-center gap-1.5 text-ink2">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: v.color }} aria-hidden />
            {v.label}
            <span className="num font-medium text-ink">{v.value != null ? format(v.value) : "–"}</span>
          </span>
        ))}
      </div>
      <div ref={el} style={{ height }} />
    </div>
  );
}

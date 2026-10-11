// Prisvarsler og logg over signalendringer. Evalueres hver gang ny data lastes.
import { PROFILES, SIGNAL_TEXT } from "./data.js";
import { signalLogStore } from "./store.js";

export const METRICS = [
  { id: "price", label: "Kurs (lokal valuta)", get: e => e.price, unit: "" },
  { id: "price_nok", label: "Kurs i NOK", get: e => e.price_nok, unit: " kr" },
  { id: "ret1d", label: "Endring i dag (%)", get: e => e.ret["1D"], unit: " %" },
  { id: "ret1m", label: "Endring 1 mnd (%)", get: e => e.ret["1M"], unit: " %" },
  { id: "rsi", label: "RSI (14)", get: e => e.trend.rsi, unit: "" },
  { id: "from_high", label: "Fra 52-ukers topp (%)", get: e => e.trend.from_high_52w, unit: " %" },
  { id: "dist_ma200", label: "Avstand til MA200 (%)", get: e => e.trend.dist_ma200, unit: " %" },
  { id: "detr", label: "Trendjustert prosentil", get: e => e.valuation.detrended_pct, unit: "" },
  ...PROFILES.map(p => ({ id: `score_${p.id}`, label: `Score ${p.label}`, get: e => e.scores.profiles[p.id].score, unit: "" })),
];

export const OPS = [
  { id: "above", label: "over" },
  { id: "below", label: "under" },
];

export function evaluate(alert, etfMap) {
  const e = etfMap[alert.ticker];
  const m = METRICS.find(x => x.id === alert.metric);
  if (!e || !m) return { value: null, hit: false };
  const value = m.get(e);
  if (value == null) return { value, hit: false };
  const hit = alert.op === "above" ? value > alert.value : value < alert.value;
  return { value, hit, metric: m };
}

export function triggered(alerts, etfMap) {
  return alerts.filter(a => a.active !== false).map(a => ({ alert: a, ...evaluate(a, etfMap) })).filter(x => x.hit);
}

/**
 * Sammenligner signalene med forrige gang appen så nye data, og logger endringer.
 * Kjøres én gang per datadato.
 */
export function updateSignalLog(etfs, generated) {
  const st = signalLogStore.get();
  if (st.date === generated) return;
  const now = {};
  const changes = [];
  for (const e of etfs) {
    now[e.ticker] = Object.fromEntries(PROFILES.map(p => [p.id, e.scores.profiles[p.id].signal]));
    const before = st.prev?.[e.ticker];
    if (!before) continue;
    for (const p of PROFILES) {
      if (before[p.id] && before[p.id] !== now[e.ticker][p.id]) {
        changes.push({ date: e.date, ticker: e.ticker, profile: p.id, from: before[p.id], to: now[e.ticker][p.id] });
      }
    }
  }
  signalLogStore.set({ date: generated, prev: now, log: [...changes, ...(st.log || [])].slice(0, 300) });
}

export const describeChange = c =>
  `${PROFILES.find(p => p.id === c.profile)?.label}: ${SIGNAL_TEXT[c.from]} → ${SIGNAL_TEXT[c.to]}`;

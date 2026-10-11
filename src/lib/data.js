// Leser de statiske JSON-filene som GitHub Actions lager (scripts/fetch_data.py).

const BASE = "./data/";
const memo = new Map();

async function getJson(path) {
  if (!memo.has(path)) {
    memo.set(path, fetch(BASE + path, { cache: "no-cache" }).then(res => {
      if (!res.ok) throw new Error(`Fant ikke ${path} (${res.status})`);
      return res.json();
    }).catch(err => { memo.delete(path); throw err; }));
  }
  return memo.get(path);
}

export const loadMeta = () => getJson("meta.json");
export const loadSnapshot = () => getJson("snapshot.json");
export const loadMarket = () => getJson("market.json");
export const loadNews = () => getJson("news.json");
export const loadCorrelation = () => getJson("correlation.json");
export const loadFx = () => getJson("fx.json");

export const safeName = t => t.replace(/\^/g, "_").replace(/=/g, "_").replace(/\//g, "_");
export const loadHistory = ticker => getJson(`history/${safeName(ticker)}.json`);

/** Lager en oppslagsfunksjon dato -> verdi med «siste kjente verdi» (forward fill). */
export function asOf(series) {
  const { d, c } = series;
  return day => {
    let lo = 0, hi = d.length - 1;
    if (day < d[0]) return c[0];
    if (day >= d[hi]) return c[hi];
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (d[mid] <= day) lo = mid; else hi = mid - 1;
    }
    return c[lo];
  };
}

/** Konverterer en historikk ({d, c}) til NOK med daglige valutakurser. */
export function toNok(hist, fx) {
  if (!hist || hist.cur === "NOK" || !fx?.[hist.cur]) return hist;
  const rate = asOf(fx[hist.cur]);
  return { ...hist, cur: "NOK", c: hist.c.map((v, i) => v * rate(hist.d[i])) };
}

export function fxRate(fx, cur, day) {
  if (cur === "NOK") return 1;
  if (!fx?.[cur]) return null;
  const s = fx[cur];
  return asOf(s)(day || s.d[s.d.length - 1]);
}

const DAY = 86400000;
export const RANGES = [
  { id: "1M", days: 31 },
  { id: "3M", days: 92 },
  { id: "6M", days: 183 },
  { id: "YTD", days: null, ytd: true },
  { id: "1Y", days: 366 },
  { id: "3Y", days: 365 * 3 + 1 },
  { id: "5Y", days: 365 * 5 + 2 },
  { id: "10Y", days: 3653 },
  { id: "Maks", days: null },
];

export function rangeStart(id, lastDay) {
  const r = RANGES.find(x => x.id === id);
  const last = new Date(`${lastDay}T12:00:00`);
  if (!r || (!r.days && !r.ytd)) return "0000-00-00";
  if (r.ytd) return `${last.getFullYear()}-01-01`;
  return new Date(last.getTime() - r.days * DAY).toISOString().slice(0, 10);
}

export function sliceFrom(hist, start) {
  const i = hist.d.findIndex(x => x >= start);
  if (i <= 0) return hist;
  return { ...hist, d: hist.d.slice(i), c: hist.c.slice(i) };
}

export function movingAverage(values, n) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

export const PROFILES = [
  { id: "value", label: "Verdi", long: "Verdi-ledet", weights: "70 % verdsettelse · 30 % trend",
    desc: "Vektlegger at kursen er lav sammenlignet med egen historikk og langsiktig trend, selv om momentum er flatt." },
  { id: "balanced", label: "Balansert", long: "Balansert", weights: "50 % verdsettelse · 50 % trend",
    desc: "Lik vekt på verdsettelse og markedsdynamikk. Leter etter at begge signalene peker samme vei." },
  { id: "momentum", label: "Momentum", long: "Momentum-ledet", weights: "30 % verdsettelse · 70 % trend",
    desc: "Følger trenden: glidende snitt, trendhelning, 12–1 mnd momentum og relativ styrke mot verdensindeksen." },
];

export const SIGNAL_TEXT = { BUY: "Kjøp", HOLD: "Hold", SELL: "Selg" };

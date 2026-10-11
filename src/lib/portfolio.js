// Porteføljeberegninger: gjennomsnittskost, verdi i NOK, historikk og risiko.
import { asOf, fxRate, loadHistory, toNok } from "./data.js";

const sortTx = txs => [...txs].sort((a, b) => a.date.localeCompare(b.date) || (a.type === "buy" ? -1 : 1));

/** Beholdninger og nøkkeltall basert på siste kurser i snapshot. */
export function summarize(transactions, etfMap, fx) {
  const pos = {};
  let realized = 0;
  for (const tx of sortTx(transactions)) {
    const e = etfMap[tx.ticker];
    const cur = e?.currency || "EUR";
    const rate = fxRate(fx, cur, tx.date) ?? 1;
    const p = (pos[tx.ticker] ||= { ticker: tx.ticker, units: 0, costNok: 0, costLocal: 0, realized: 0 });
    const units = Number(tx.units) || 0;
    const fee = Number(tx.fee) || 0;
    if (tx.type === "buy") {
      p.units += units;
      p.costNok += units * tx.price * rate + fee;
      p.costLocal += units * tx.price;
    } else if (p.units > 0) {
      const u = Math.min(units, p.units);
      const avgNok = p.costNok / p.units, avgLocal = p.costLocal / p.units;
      const gain = u * tx.price * rate - fee - avgNok * u;
      p.realized += gain;
      realized += gain;
      p.costNok -= avgNok * u;
      p.costLocal -= avgLocal * u;
      p.units -= u;
    }
  }

  const holdings = Object.values(pos).filter(p => p.units > 1e-9).map(p => {
    const e = etfMap[p.ticker];
    const valueNok = e ? p.units * e.price_nok : 0;
    const d1 = e?.ret_nok?.["1D"];
    const dayNok = d1 != null ? valueNok - valueNok / (1 + d1 / 100) : 0;
    return {
      ...p,
      short: e?.short || p.ticker, name: e?.name || p.ticker,
      sector: e?.sector || "Ukjent", region: e?.region || "?", currency: e?.currency || "?",
      avgPrice: p.costLocal / p.units,
      valueNok, dayNok,
      pnlNok: valueNok - p.costNok,
      pnlPct: p.costNok ? (valueNok / p.costNok - 1) * 100 : null,
      etf: e,
    };
  });
  const value = holdings.reduce((a, h) => a + h.valueNok, 0);
  const cost = holdings.reduce((a, h) => a + h.costNok, 0);
  const day = holdings.reduce((a, h) => a + h.dayNok, 0);
  holdings.forEach(h => { h.weight = value ? h.valueNok / value : 0; });
  holdings.sort((a, b) => b.valueNok - a.valueNok);

  const group = key => {
    const m = {};
    for (const h of holdings) m[h[key]] = (m[h[key]] || 0) + h.weight;
    return Object.entries(m).map(([k, w]) => ({ key: k, weight: w })).sort((a, b) => b.weight - a.weight);
  };

  return {
    holdings, value, cost, day, realized,
    pnl: value - cost,
    pnlPct: cost ? (value / cost - 1) * 100 : null,
    dayPct: value - day ? (day / (value - day)) * 100 : null,
    bySector: group("sector"),
    byRegion: group("region"),
    byCurrency: group("currency"),
  };
}

async function nokHistories(tickers, fx) {
  const out = {};
  await Promise.all(tickers.map(async t => {
    try { out[t] = toNok(await loadHistory(t), fx); } catch { /* mangler */ }
  }));
  return out;
}

/** Daglig verdi av porteføljen, innskutt kapital og «samme innskudd i en referanseindeks». */
export async function valueHistory(transactions, etfMap, fx, benchTicker = "SPYY.DE") {
  if (!transactions.length) return [];
  const txs = sortTx(transactions);
  const tickers = [...new Set(txs.map(t => t.ticker))];
  const hists = await nokHistories([...tickers, benchTicker], fx);
  const start = txs[0].date;

  const days = new Set();
  for (const t of tickers) hists[t]?.d.forEach(d => d >= start && days.add(d));
  const dates = [...days].sort();
  const look = Object.fromEntries(Object.entries(hists).map(([t, h]) => [t, asOf(h)]));

  const units = {};
  let invested = 0, benchUnits = 0, i = 0;
  const out = [];
  for (const d of dates) {
    while (i < txs.length && txs[i].date <= d) {
      const tx = txs[i++];
      const rate = fxRate(fx, etfMap[tx.ticker]?.currency || "EUR", tx.date) ?? 1;
      const flow = tx.units * tx.price * rate;
      const bp = look[benchTicker]?.(tx.date);
      if (tx.type === "buy") {
        units[tx.ticker] = (units[tx.ticker] || 0) + Number(tx.units);
        invested += flow + (Number(tx.fee) || 0);
        if (bp) benchUnits += (flow + (Number(tx.fee) || 0)) / bp;
      } else {
        const held = units[tx.ticker] || 0;
        const frac = held ? Math.min(1, tx.units / held) : 0;
        // Uttak: reduser innskutt kapital og referanseporteføljen forholdsmessig
        const valueBefore = tickers.reduce((a, t) => a + (units[t] || 0) * (look[t]?.(d) || 0), 0);
        invested -= flow - (Number(tx.fee) || 0);
        if (valueBefore > 0 && bp) benchUnits -= benchUnits * Math.min(1, flow / valueBefore);
        units[tx.ticker] = held * (1 - frac);
      }
    }
    const value = tickers.reduce((a, t) => a + (units[t] || 0) * (look[t]?.(d) || 0), 0);
    out.push({ date: d, value, invested, bench: look[benchTicker] ? benchUnits * look[benchTicker](d) : null });
  }
  return out;
}

function fridays(from, to) {
  const out = [];
  const d = new Date(`${from}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7));
  const end = new Date(`${to}T12:00:00Z`);
  while (d <= end) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 7); }
  return out;
}

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const std = a => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
function corr(a, b) {
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return num / Math.sqrt(da * db);
}

/** Risiko for dagens vekter, beregnet på ukentlige NOK-avkastninger de siste ~2 årene. */
export async function portfolioRisk(holdings, fx, bench = "ACWI") {
  if (!holdings.length) return null;
  const hists = await nokHistories([...holdings.map(h => h.ticker), bench], fx);
  const lastDay = hists[bench]?.d.at(-1) || new Date().toISOString().slice(0, 10);
  const from = new Date(new Date(`${lastDay}T12:00:00Z`).getTime() - 730 * 86400000).toISOString().slice(0, 10);
  const grid = fridays(from, lastDay);
  const rets = {};
  for (const [t, h] of Object.entries(hists)) {
    if (h.d[0] > grid[0]) continue; // for kort historikk
    const look = asOf(h);
    const px = grid.map(look);
    rets[t] = px.slice(1).map((v, i) => v / px[i] - 1);
  }
  const usable = holdings.filter(h => rets[h.ticker]);
  if (!usable.length) return null;
  const wsum = usable.reduce((a, h) => a + h.weight, 0);
  const n = grid.length - 1;
  const port = Array.from({ length: n }, (_, i) => usable.reduce((a, h) => a + (h.weight / wsum) * rets[h.ticker][i], 0));

  let peak = 1, cum = 1, maxdd = 0;
  for (const r of port) { cum *= 1 + r; peak = Math.max(peak, cum); maxdd = Math.min(maxdd, cum / peak - 1); }

  let beta = null;
  if (rets[bench]) {
    const b = rets[bench], mb = mean(b), mp = mean(port);
    let cov = 0, vb = 0;
    for (let i = 0; i < n; i++) { cov += (port[i] - mp) * (b[i] - mb); vb += (b[i] - mb) ** 2; }
    beta = cov / vb;
  }

  let cw = 0, cs = 0;
  for (let i = 0; i < usable.length; i++) for (let j = i + 1; j < usable.length; j++) {
    const w = usable[i].weight * usable[j].weight;
    cs += w * corr(rets[usable[i].ticker], rets[usable[j].ticker]);
    cw += w;
  }
  const annRet = (cum ** (52 / n) - 1) * 100;
  const vol = std(port) * Math.sqrt(52) * 100;
  return {
    vol, beta, maxdd: maxdd * 100, annRet,
    sharpe: vol ? annRet / vol : null,
    avgCorr: cw ? cs / cw : null,
    effN: 1 / holdings.reduce((a, h) => a + h.weight ** 2, 0),
    weeks: n,
    covered: wsum,
  };
}

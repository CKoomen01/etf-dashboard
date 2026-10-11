import { useEffect, useState } from "react";
import { useApp } from "../lib/context.js";
import { alertStore, portfolioStore, uid, useStore } from "../lib/store.js";
import { asOf, fxRate, loadHistory } from "../lib/data.js";
import { METRICS, OPS } from "../lib/alerts.js";
import { nok, num } from "../lib/format.js";

export function EtfSelect({ value, onChange, onlyUcits = false, className = "" }) {
  const { etfs } = useApp();
  const list = etfs.filter(e => !onlyUcits || e.region === "UCITS");
  return (
    <select className={`input ${className}`} value={value} onChange={e => onChange(e.target.value)} aria-label="Velg ETF">
      {["UCITS", "US"].map(reg => (
        <optgroup key={reg} label={reg === "UCITS" ? "Kjøpbare i Norge (UCITS)" : "Amerikanske (kun signal)"}>
          {list.filter(e => e.region === reg).map(e => <option key={e.ticker} value={e.ticker}>{e.short} – {e.ticker}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export function TxForm({ ticker: initialTicker, tx, onDone }) {
  const { etfMap, fx } = useApp();
  const [, setPf] = useStore(portfolioStore);
  const [f, setF] = useState(() => tx || { ticker: initialTicker || "VWCE.DE", type: "buy", date: todayIso(), units: "", price: "", fee: "" });
  const [priceHint, setPriceHint] = useState(null);
  const e = etfMap[f.ticker];

  // Foreslå sluttkurs for valgt dato
  useEffect(() => {
    let live = true;
    loadHistory(f.ticker).then(h => {
      if (!live) return;
      const p = asOf(h)(f.date);
      const v = h.cur === "GBp" ? p / 100 : p;
      setPriceHint(v);
      if (!tx) setF(x => (x.priceTouched ? x : { ...x, price: v ? String(Math.round(v * 100) / 100) : "" }));
    }).catch(() => setPriceHint(null));
    return () => { live = false; };
  }, [f.ticker, f.date, tx]);

  const units = parseFloat(String(f.units).replace(",", "."));
  const pr = parseFloat(String(f.price).replace(",", "."));
  const fee = parseFloat(String(f.fee).replace(",", ".")) || 0;
  const rate = e ? fxRate(fx, e.currency, f.date) : null;
  const valid = e && units > 0 && pr > 0 && f.date;

  function save(ev) {
    ev.preventDefault();
    if (!valid) return;
    const clean = { id: tx?.id || uid(), ticker: f.ticker, type: f.type, date: f.date, units, price: pr, fee };
    setPf(p => ({ ...p, transactions: tx ? p.transactions.map(t => (t.id === tx.id ? clean : t)) : [...p.transactions, clean] }));
    onDone?.();
  }

  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="h-sub">ETF</span>
        <EtfSelect value={f.ticker} onChange={v => setF(x => ({ ...x, ticker: v, priceTouched: false }))} />
        {e?.region === "US" && <span className="mt-1 block text-xs text-down">Merk: amerikanske ETF-er kan ikke kjøpes av norske privatkunder.</span>}
      </label>
      <label>
        <span className="h-sub">Type</span>
        <select className="input" value={f.type} onChange={ev => setF(x => ({ ...x, type: ev.target.value }))}>
          <option value="buy">Kjøp</option><option value="sell">Salg</option>
        </select>
      </label>
      <label>
        <span className="h-sub">Dato</span>
        <input type="date" className="input" max={todayIso()} value={f.date} onChange={ev => setF(x => ({ ...x, date: ev.target.value, priceTouched: false }))} />
      </label>
      <label>
        <span className="h-sub">Antall andeler</span>
        <input className="input" inputMode="decimal" placeholder="f.eks. 12" value={f.units} onChange={ev => setF(x => ({ ...x, units: ev.target.value }))} />
      </label>
      <label>
        <span className="h-sub">Kurs per andel ({e?.currency})</span>
        <input className="input" inputMode="decimal" value={f.price} onChange={ev => setF(x => ({ ...x, price: ev.target.value, priceTouched: true }))} />
        {priceHint != null && <span className="mt-0.5 block text-[11px] text-muted">Sluttkurs denne dagen: {num(priceHint, 2)} {e?.currency}</span>}
      </label>
      <label>
        <span className="h-sub">Kurtasje / gebyr (NOK)</span>
        <input className="input" inputMode="decimal" placeholder="0" value={f.fee} onChange={ev => setF(x => ({ ...x, fee: ev.target.value }))} />
      </label>
      <div className="self-end text-sm text-ink2">
        {valid && rate && <>Sum ≈ <b className="text-ink">{nok(units * pr * rate + fee)}</b><div className="text-[11px] text-muted">{e.currency}/NOK {num(rate, 3)}</div></>}
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        {onDone && <button type="button" className="btn-ghost" onClick={onDone}>Avbryt</button>}
        <button className="btn-primary" disabled={!valid}>{tx ? "Lagre endring" : f.type === "buy" ? "Legg til kjøp" : "Legg til salg"}</button>
      </div>
    </form>
  );
}

export function AlertForm({ ticker: initialTicker, onDone }) {
  const { etfMap } = useApp();
  const [, setAlerts] = useStore(alertStore);
  const [f, setF] = useState({ ticker: initialTicker || "VWCE.DE", metric: "price", op: "below", value: "" });
  const e = etfMap[f.ticker];
  const m = METRICS.find(x => x.id === f.metric);
  const current = e ? m.get(e) : null;
  const value = parseFloat(String(f.value).replace(",", "."));

  function save(ev) {
    ev.preventDefault();
    if (Number.isNaN(value)) return;
    setAlerts(a => [...a, { id: uid(), ticker: f.ticker, metric: f.metric, op: f.op, value, created: new Date().toISOString(), active: true }]);
    onDone?.();
  }

  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr_1fr_auto] sm:items-end">
      <label><span className="h-sub">ETF</span><EtfSelect value={f.ticker} onChange={v => setF(x => ({ ...x, ticker: v }))} /></label>
      <label>
        <span className="h-sub">Når</span>
        <select className="input" value={f.metric} onChange={ev => setF(x => ({ ...x, metric: ev.target.value }))}>
          {METRICS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </label>
      <label>
        <span className="h-sub">er</span>
        <select className="input" value={f.op} onChange={ev => setF(x => ({ ...x, op: ev.target.value }))}>
          {OPS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <label>
        <span className="h-sub">Verdi</span>
        <input className="input" inputMode="decimal" placeholder={current != null ? num(current, 2) : ""} value={f.value} onChange={ev => setF(x => ({ ...x, value: ev.target.value }))} />
      </label>
      <button className="btn-primary justify-center" disabled={Number.isNaN(value)}>Lag varsel</button>
      {current != null && <div className="text-[11px] text-muted sm:col-span-5">Nåverdi: {num(current, 2)}{m.unit}</div>}
    </form>
  );
}

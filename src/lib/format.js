const cache = new Map();
function nf(min, max, extra = {}) {
  const key = `${min}|${max}|${JSON.stringify(extra)}`;
  if (!cache.has(key)) {
    cache.set(key, new Intl.NumberFormat("nb-NO", { minimumFractionDigits: min, maximumFractionDigits: max, ...extra }));
  }
  return cache.get(key);
}

const MINUS = "−";
const fix = s => s.replace(/-/g, MINUS);

export function num(v, d = 2) {
  if (v == null || Number.isNaN(v)) return "–";
  return fix(nf(d, d).format(v));
}

export function pct(v, d = 1, sign = true) {
  if (v == null || Number.isNaN(v)) return "–";
  const s = nf(d, d).format(Math.abs(v));
  const zero = Math.abs(v) < 0.5 * 10 ** -d;
  const pre = zero ? "" : v > 0 && sign ? "+" : v < 0 ? MINUS : "";
  return `${pre}${s} %`;
}

export function price(v, cur) {
  if (v == null) return "–";
  const d = v >= 1000 ? 0 : v >= 100 ? 1 : 2;
  return `${nf(d, d).format(v)}${cur ? ` ${cur}` : ""}`;
}

export function nok(v, d = 0) {
  if (v == null || Number.isNaN(v)) return "–";
  return `${fix(nf(d, d).format(v))} kr`;
}

export function signedNok(v, d = 0) {
  if (v == null || Number.isNaN(v)) return "–";
  return `${v > 0 ? "+" : v < 0 ? MINUS : ""}${nf(d, d).format(Math.abs(v))} kr`;
}

export function big(v, cur = "") {
  if (v == null) return "–";
  const a = Math.abs(v);
  const [n, u] = a >= 1e12 ? [v / 1e12, "bill."] : a >= 1e9 ? [v / 1e9, "mrd."] : a >= 1e6 ? [v / 1e6, "mill."] : [v, ""];
  return `${fix(nf(0, 1).format(n))} ${u}${cur ? ` ${cur}` : ""}`.trim();
}

export function date(s, opts = { day: "numeric", month: "short", year: "numeric" }) {
  if (!s) return "–";
  const d = typeof s === "string" ? new Date(s.length === 10 ? `${s}T12:00:00` : s) : s;
  return d.toLocaleDateString("nb-NO", opts);
}

export function ago(iso) {
  if (!iso) return "";
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 90) return "akkurat nå";
  if (sec < 3600) return `${Math.round(sec / 60)} min siden`;
  if (sec < 86400 * 1.5) return `${Math.round(sec / 3600)} t siden`;
  return `${Math.round(sec / 86400)} dager siden`;
}

/** Tailwind-klasse for opp/ned-tekst. Fortegnet står alltid i teksten (ikke bare farge). */
export function tone(v) {
  if (v == null || Math.abs(v) < 0.05) return "text-ink2";
  return v > 0 ? "text-up" : "text-down";
}

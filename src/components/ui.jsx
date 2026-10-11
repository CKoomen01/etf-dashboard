import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { ArrowDownRight, ArrowRight, ArrowUpRight, X } from "lucide-react";
import { SIGNAL_TEXT } from "../lib/data.js";
import { pct, tone } from "../lib/format.js";
import { SERIES, useDark } from "../lib/colors.js";

// ── Signal / trend / verdsettelse ────────────────────────────────────
const SIG_STYLE = {
  BUY: "bg-good/10 text-up border-good/30",
  HOLD: "bg-ink/5 text-ink2 border-line",
  SELL: "bg-bad/10 text-down border-bad/30",
};
const SIG_ICON = { BUY: ArrowUpRight, HOLD: ArrowRight, SELL: ArrowDownRight };

export function SignalBadge({ signal, score, small }) {
  if (!signal) return <span className="text-muted">–</span>;
  const Icon = SIG_ICON[signal];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border font-semibold ${SIG_STYLE[signal]} ${small ? "px-1.5 py-0 text-[11px]" : "px-2 py-0.5 text-xs"}`}
      title={score != null ? `Score ${Math.round(score)}/100` : undefined}>
      <Icon className={small ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      {SIGNAL_TEXT[signal]}
      {score != null && !small && <span className="font-normal opacity-70 num">{Math.round(score)}</span>}
    </span>
  );
}

const TREND = {
  "sterk opp": ["text-up", "▲▲"], opp: ["text-up", "▲"], sidelengs: ["text-ink2", "◆"],
  ned: ["text-down", "▼"], "sterk ned": ["text-down", "▼▼"], ukjent: ["text-muted", "?"],
};
export function TrendTag({ label }) {
  const [cls, sym] = TREND[label] || TREND.ukjent;
  return <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}><span className="text-[9px]" aria-hidden>{sym}</span>{label}</span>;
}

export function ValTag({ p, label }) {
  if (p == null) return <span className="text-muted text-xs">–</span>;
  const cls = label === "Billig" ? "text-up" : label === "Dyr" ? "text-down" : "text-ink2";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" title={`Prosentil ${Math.round(p)} av 100`}>
      <span className="relative h-1.5 w-10 rounded-full bg-line">
        <span className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded bg-ink" style={{ left: `${p}%` }} />
      </span>
      <span className={`font-medium ${cls}`}>{label}</span>
    </span>
  );
}

export function Delta({ v, d = 1, className = "" }) {
  return <span className={`num ${tone(v)} ${className}`}>{pct(v, d)}</span>;
}

export function RegionTag({ region }) {
  return region === "UCITS"
    ? <span className="chip border-accent/30 text-accent" title="Kan kjøpes av norske privatpersoner">UCITS</span>
    : <span className="chip" title="Amerikansk ETF – ikke kjøpbar for norske privatkunder (PRIIPs)">US</span>;
}

// ── Sparkline ───────────────────────────────────────────────────────
export function Sparkline({ data, width = 96, height = 28, color }) {
  const dark = useDark();
  if (!data?.length) return <div style={{ width, height }} />;
  const vals = data.filter(v => v != null);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * (width - 2) + 1},${height - 2 - ((v - min) / span) * (height - 4)}`).join(" ");
  const up = vals.at(-1) >= vals[0];
  const c = color || (up ? (dark ? "#0ca30c" : "#008300") : (dark ? "#e66767" : "#d03b3b"));
  return (
    <svg width={width} height={height} className="block" aria-hidden>
      <polyline points={pts} fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Markdown ────────────────────────────────────────────────────────
marked.setOptions({ gfm: true, breaks: false });
export function Markdown({ text }) {
  const html = useMemo(() => {
    const raw = DOMPurify.sanitize(marked.parse(text || ""));
    return raw.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
  }, [text]);
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Sources({ sources }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-3 border-t border-line pt-2">
      <div className="h-sub mb-1">Kilder fra Google-søk</div>
      <div className="flex flex-wrap gap-1.5">
        {sources.slice(0, 10).map((s, i) => (
          <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="chip hover:text-accent max-w-[220px] truncate">
            {i + 1}. {s.title}
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Diverse ─────────────────────────────────────────────────────────
export function Seg({ value, onChange, options, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(o => {
        const [id, text] = Array.isArray(o) ? o : [o, o];
        return <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>{text}</button>;
      })}
    </div>
  );
}

export function Stat({ label, value, sub, className = "" }) {
  return (
    <div className={`card card-pad ${className}`}>
      <div className="h-sub">{label}</div>
      <div className="mt-1 text-xl font-semibold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs">{sub}</div>}
    </div>
  );
}

export function Card({ title, sub, right, children, className = "", pad = true }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-5">
          <div>
            {title && <h2 className="h-title">{title}</h2>}
            {sub && <p className="h-sub mt-0.5">{sub}</p>}
          </div>
          {right}
        </header>
      )}
      <div className={pad ? "p-4 sm:p-5" : ""}>{children}</div>
    </section>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {Icon && <Icon className="h-8 w-8 text-muted" aria-hidden />}
      <div className="text-sm font-medium text-ink">{title}</div>
      {children && <div className="max-w-md text-sm text-ink2">{children}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[8vh] animate-fade-in"
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`card w-full ${wide ? "max-w-2xl" : "max-w-lg"} bg-surface shadow-2xl`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button className="btn-ghost p-1" onClick={onClose} aria-label="Lukk"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Flytende tooltip som følger musa. Bruk: const tip = useTip(); <div onMouseMove={e=>tip.show(e, content)} onMouseLeave={tip.hide}/> {tip.node} */
export function useTip() {
  const [state, setState] = useState(null);
  const ref = useRef(null);
  const show = (e, content) => setState({ x: e.clientX, y: e.clientY, content });
  const hide = () => setState(null);
  const node = state && createPortal(
    <div ref={ref} className="pointer-events-none fixed z-[70] max-w-xs rounded-lg border border-line bg-raised px-3 py-2 text-xs text-ink shadow-xl"
      style={{ left: Math.min(state.x + 14, window.innerWidth - 260), top: state.y + 14 }}>
      {state.content}
    </div>,
    document.body,
  );
  return { show, hide, node };
}

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink2">
      {items.map(it => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3.5 rounded-sm" style={{ background: it.color }} aria-hidden />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function seriesColor(i, dark) {
  return SERIES[dark ? "dark" : "light"][i % 8];
}

export function Spinner({ className = "h-4 w-4" }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-hidden />;
}

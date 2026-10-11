import { useEffect, useRef, useState } from "react";
import { Bell, Moon, Settings, Sparkles, Sun, SunMoon } from "lucide-react";
import { useApp } from "../lib/context.js";
import { settingsStore, useStore } from "../lib/store.js";
import { ago, date, num } from "../lib/format.js";
import { ROUTES } from "../lib/routes.js";
import { Seg } from "./ui.jsx";

const THEMES = { system: [SunMoon, "Følg systemet"], light: [Sun, "Lyst tema"], dark: [Moon, "Mørkt tema"] };
const NEXT = { system: "light", light: "dark", dark: "system" };

function AlertsMenu() {
  const { hits, openEtf, go, etfMap } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const k = e => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", k);
    return () => document.removeEventListener("mousedown", k);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative p-2" onClick={() => setOpen(o => !o)} aria-label={`Varsler (${hits.length} utløst)`}>
        <Bell className="h-4 w-4" />
        {hits.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">{hits.length}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-line bg-raised p-2 shadow-xl animate-fade-in">
          <div className="px-2 py-1 text-xs font-semibold text-ink">Utløste varsler</div>
          {hits.length === 0 && <div className="px-2 py-3 text-xs text-ink2">Ingen varsler er utløst med dagens data.</div>}
          {hits.map(h => (
            <button key={h.alert.id} className="block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-ink/5"
              onClick={() => { openEtf(h.alert.ticker); setOpen(false); }}>
              <span className="font-medium text-ink">{etfMap[h.alert.ticker]?.short}</span>
              <span className="text-ink2"> · {h.metric.label} {h.alert.op === "above" ? "over" : "under"} {num(h.alert.value, 2)} (nå {num(h.value, 2)})</span>
            </button>
          ))}
          <button className="btn-ghost mt-1 w-full justify-center text-xs" onClick={() => { go("overvaking"); setOpen(false); }}>Administrer varsler</button>
        </div>
      )}
    </div>
  );
}

function Nav({ className }) {
  const { route, go } = useApp();
  return (
    <nav className={`no-scrollbar items-center gap-0.5 overflow-x-auto ${className}`} aria-label="Hovedmeny">
      {ROUTES.map(r => (
        <button key={r.id} onClick={() => go(r.id)} aria-current={route.id === r.id ? "page" : undefined}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors ${route.id === r.id ? "bg-accent/10 font-semibold text-accent" : "text-ink2 hover:bg-ink/5 hover:text-ink"}`}>
          {r.label}
        </button>
      ))}
    </nav>
  );
}

export default function Header() {
  const { meta, openChat, openSettings, etfs } = useApp();
  const [settings, setSettings] = useStore(settingsStore);
  const [ThemeIcon, themeLabel] = THEMES[settings.theme] || THEMES.system;
  const lastDate = etfs.reduce((m, e) => (e.date > m ? e.date : m), "");

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-2.5 sm:px-6">
        <a href="#/oversikt" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-ink">
          <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden><rect width="32" height="32" rx="7" fill="rgb(var(--accent))" /><path d="M6 22l6-7 5 4 9-10" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span className="hidden sm:inline">ETF Dashboard</span>
        </a>

        <Nav className="hidden flex-1 md:flex" />
        <div className="flex-1 md:hidden" />

        <div className="hidden text-right text-[11px] leading-tight text-muted lg:block" title={`Generert ${new Date(meta.generated).toLocaleString("nb-NO")}`}>
          <div>Kurser per {date(lastDate, { day: "numeric", month: "short" })}</div>
          <div>Oppdatert {ago(meta.generated)}</div>
        </div>
        <div className="hidden md:block">
          <Seg label="Valuta" value={settings.currency} onChange={v => setSettings(s => ({ ...s, currency: v }))}
            options={[["NOK", "NOK"], ["LOCAL", "Lokal"]]} />
        </div>
        <button className="btn-primary hidden sm:inline-flex" onClick={() => openChat()}>
          <Sparkles className="h-4 w-4" /> Spør AI
        </button>
        <button className="btn-ghost p-2 sm:hidden" onClick={() => openChat()} aria-label="Spør AI"><Sparkles className="h-4 w-4" /></button>
        <AlertsMenu />
        <button className="btn-ghost p-2" title={themeLabel} aria-label={themeLabel}
          onClick={() => setSettings(s => ({ ...s, theme: NEXT[s.theme] || "system" }))}>
          <ThemeIcon className="h-4 w-4" />
        </button>
        <button className="btn-ghost p-2" onClick={openSettings} aria-label="Innstillinger"><Settings className="h-4 w-4" /></button>
      </div>
      <Nav className="flex border-t border-line px-3 py-1.5 md:hidden" />
    </header>
  );
}

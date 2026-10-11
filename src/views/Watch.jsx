import { useState } from "react";
import { Bell, BellOff, Star, Trash2 } from "lucide-react";
import { useApp } from "../lib/context.js";
import { alertStore, settingsStore, signalLogStore, useStore, watchStore } from "../lib/store.js";
import { describeChange, evaluate } from "../lib/alerts.js";
import { date, num, price } from "../lib/format.js";
import { Card, Delta, Empty, RegionTag, SignalBadge, Sparkline, TrendTag, ValTag } from "../components/ui.jsx";
import { AlertForm, EtfSelect } from "../components/Forms.jsx";
import { ProfileSeg } from "./Overview.jsx";

export default function Watch() {
  const { etfMap, openEtf } = useApp();
  const [settings] = useStore(settingsStore);
  const [watch, setWatch] = useStore(watchStore);
  const [alerts, setAlerts] = useStore(alertStore);
  const [log, setLog] = useStore(signalLogStore);
  const [adding, setAdding] = useState("VWCE.DE");
  const [onlyWatched, setOnlyWatched] = useState(true);
  const p = settings.profile;
  const R = e => (settings.currency === "NOK" ? e.ret_nok : e.ret);
  const list = watch.map(t => etfMap[t]).filter(Boolean);
  const changes = (log.log || []).filter(c => !onlyWatched || watch.includes(c.ticker));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Overvåking</h1>
        <ProfileSeg />
      </div>

      <Card title="Overvåkingsliste" sub="Stjernemerk ETF-er i screeneren eller detaljvisningen"
        right={<div className="flex items-center gap-1.5"><EtfSelect value={adding} onChange={setAdding} className="w-56" /><button className="btn-outline" onClick={() => setWatch(w => (w.includes(adding) ? w : [...w, adding]))}><Star className="h-4 w-4" /> Legg til</button></div>}
        pad={false}>
        {!list.length ? <Empty icon={Star} title="Ingen ETF-er overvåkes">Trykk på stjernen ved en ETF for å følge den her.</Empty> : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-line"><tr>
                <th className="th">ETF</th><th className="th text-right">Kurs</th><th className="th text-right">I dag</th><th className="th text-right">1 mnd</th>
                <th className="th text-right">Hittil i år</th><th className="th">Trend</th><th className="th">Verdsettelse</th><th className="th">3 mnd</th><th className="th">Signal</th><th className="th" />
              </tr></thead>
              <tbody>
                {list.map(e => (
                  <tr key={e.ticker} className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-ink/[0.03]" onClick={() => openEtf(e.ticker)}>
                    <td className="td"><div className="flex items-center gap-2"><span className="font-medium text-ink">{e.short}</span><RegionTag region={e.region} /></div><div className="text-[11px] text-muted">{e.ticker}</div></td>
                    <td className="td text-right num">{settings.currency === "NOK" ? price(e.price_nok, "kr") : price(e.price, e.currency)}</td>
                    <td className="td text-right"><Delta v={R(e)["1D"]} d={2} /></td>
                    <td className="td text-right"><Delta v={R(e)["1M"]} /></td>
                    <td className="td text-right"><Delta v={R(e).YTD} /></td>
                    <td className="td"><TrendTag label={e.trend.label} /></td>
                    <td className="td"><ValTag p={e.valuation.detrended_pct} label={e.valuation.detrended_label} /></td>
                    <td className="td"><Sparkline data={e.spark} width={80} height={22} /></td>
                    <td className="td"><SignalBadge signal={e.scores.profiles[p].signal} score={e.scores.profiles[p].score} /></td>
                    <td className="td" onClick={ev => ev.stopPropagation()}>
                      <button className="btn-ghost p-1" onClick={() => setWatch(w => w.filter(x => x !== e.ticker))} aria-label="Fjern"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Varsler" sub="Sjekkes hver gang du åpner dashbordet med nye data. Utløste varsler vises i bjella øverst.">
        <AlertForm />
        {alerts.length > 0 && (
          <div className="mt-4 divide-y divide-line border-t border-line">
            {alerts.map(a => {
              const ev = evaluate(a, etfMap);
              const e = etfMap[a.ticker];
              return (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <button className="min-w-0 text-left" onClick={() => openEtf(a.ticker)}>
                    <span className="font-medium text-ink">{e?.short || a.ticker}</span>
                    <span className="text-ink2"> · {ev.metric?.label} {a.op === "above" ? "over" : "under"} {num(a.value, 2)}</span>
                    <span className="text-muted"> (nå {num(ev.value, 2)})</span>
                  </button>
                  <div className="flex items-center gap-2">
                    {a.active === false ? <span className="chip">Pauset</span>
                      : ev.hit ? <span className="chip border-warn/60 bg-warn/15 text-ink"><Bell className="h-3 w-3" /> Utløst</span>
                        : <span className="chip">Venter</span>}
                    <button className="btn-ghost p-1" title={a.active === false ? "Aktiver" : "Pause"} onClick={() => setAlerts(xs => xs.map(x => (x.id === a.id ? { ...x, active: x.active === false } : x)))}>
                      {a.active === false ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                    </button>
                    <button className="btn-ghost p-1 hover:text-down" onClick={() => setAlerts(xs => xs.filter(x => x.id !== a.id))} aria-label="Slett varsel"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Signalendringer" sub="Logget når dashbordet åpnes med nye data og et signal har endret seg siden sist"
        right={<div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-ink2"><input type="checkbox" className="accent-[rgb(var(--accent))]" checked={onlyWatched} onChange={() => setOnlyWatched(v => !v)} /> Bare overvåkede</label>
          {log.log?.length > 0 && <button className="btn-ghost text-xs" onClick={() => setLog(s => ({ ...s, log: [] }))}>Tøm logg</button>}
        </div>}>
        {!changes.length ? (
          <p className="text-sm text-ink2">Ingen signalendringer logget ennå. Loggen bygges opp over tid: hver gang dataene oppdateres og du åpner dashbordet, sammenlignes signalene med forrige gang.</p>
        ) : (
          <div className="divide-y divide-line">
            {changes.slice(0, 50).map((c, i) => (
              <button key={i} onClick={() => openEtf(c.ticker)} className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:text-accent">
                <span className="truncate"><span className="font-medium text-ink">{etfMap[c.ticker]?.short || c.ticker}</span> <span className="text-ink2">· {describeChange(c)}</span></span>
                <span className="shrink-0 text-xs text-muted">{date(c.date)}</span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

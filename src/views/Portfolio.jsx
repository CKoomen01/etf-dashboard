import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Pencil, Plus, Trash2, Upload, Wallet } from "lucide-react";
import { useApp } from "../lib/context.js";
import { exportUserData, importUserData, portfolioStore, useStore } from "../lib/store.js";
import { rangeStart } from "../lib/data.js";
import { valueHistory } from "../lib/portfolio.js";
import { portfolioPrompt } from "../lib/prompts.js";
import { CHROME, SERIES, useDark } from "../lib/colors.js";
import { date, nok, num, pct, signedNok, tone } from "../lib/format.js";
import { Card, Delta, Empty, Modal, RegionTag, Seg, SignalBadge, Stat } from "../components/ui.jsx";
import LineChart from "../components/LineChart.jsx";
import AiBox from "../components/AiBox.jsx";
import { TxForm } from "../components/Forms.jsx";

function Bars({ items }) {
  const dark = useDark();
  const color = SERIES[dark ? "dark" : "light"][0];
  return (
    <div className="space-y-2">
      {items.map(it => (
        <div key={it.key}>
          <div className="flex justify-between text-xs"><span className="text-ink2">{it.key}</span><span className="num font-medium text-ink">{pct(it.weight * 100, 1, false)}</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${it.weight * 100}%`, background: color }} /></div>
        </div>
      ))}
    </div>
  );
}

function ValueChart({ transactions }) {
  const { etfMap, fx } = useApp();
  const dark = useDark();
  const [hist, setHist] = useState(null);
  const [range, setRange] = useState("Maks");
  useEffect(() => {
    let live = true;
    setHist(null);
    valueHistory(transactions, etfMap, fx).then(h => live && setHist(h));
    return () => { live = false; };
  }, [transactions, etfMap, fx]);

  const series = useMemo(() => {
    if (!hist?.length) return [];
    const start = rangeStart(range, hist.at(-1).date);
    const h = hist.filter(x => x.date >= start);
    const pal = SERIES[dark ? "dark" : "light"];
    return [
      { id: "v", label: "Markedsverdi", color: pal[0], area: true, data: h.map(x => ({ time: x.date, value: x.value })) },
      { id: "i", label: "Innskutt", color: CHROME[dark ? "dark" : "light"].ink2, width: 1.5, data: h.map(x => ({ time: x.date, value: x.invested })) },
      { id: "b", label: "Samme innskudd i MSCI ACWI", color: pal[1], width: 1.5, data: h.filter(x => x.bench != null).map(x => ({ time: x.date, value: x.bench })) },
    ];
  }, [hist, range, dark]);

  return (
    <Card title="Verdiutvikling" sub="I NOK. Referansen viser hva samme innskudd på samme datoer ville vært verdt i SPDR MSCI ACWI (UCITS)."
      right={<Seg label="Periode" value={range} onChange={setRange} options={["3M", "6M", "YTD", "1Y", "3Y", "Maks"]} />}>
      {!hist ? <div className="skeleton h-[300px]" /> : <LineChart series={series} height={300} format={v => nok(v)} />}
    </Card>
  );
}

export default function Portfolio() {
  const { portfolio: pf, etfs, openEtf } = useApp();
  const [store, setStore] = useStore(portfolioStore);
  const [modal, setModal] = useState(null);
  const fileRef = useRef(null);
  const txs = store.transactions;

  function exportFile() {
    const blob = new Blob([JSON.stringify(exportUserData(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `etf-dashboard-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function importFile(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      importUserData(JSON.parse(await file.text()));
    } catch (e) {
      alert(e.message);
    }
    ev.target.value = "";
  }
  const remove = id => confirm("Slette transaksjonen?") && setStore(p => ({ ...p, transactions: p.transactions.filter(t => t.id !== id) }));

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-lg font-semibold tracking-tight">Min portefølje</h1>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => setModal({ type: "add" })}><Plus className="h-4 w-4" /> Ny transaksjon</button>
        <button className="btn-outline" onClick={exportFile} title="Lagre portefølje, overvåkingsliste og varsler som fil"><Download className="h-4 w-4" /> Eksporter</button>
        <button className="btn-outline" onClick={() => fileRef.current.click()} title="Hent inn fra fil, f.eks. fra en annen enhet"><Upload className="h-4 w-4" /> Importer</button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importFile} />
      </div>
    </div>
  );

  const modalNode = modal && (
    <Modal title={modal.type === "edit" ? "Endre transaksjon" : "Ny transaksjon"} onClose={() => setModal(null)}>
      <TxForm tx={modal.tx} onDone={() => setModal(null)} />
    </Modal>
  );

  if (!txs.length) {
    return (
      <div className="space-y-4">
        {header}
        <Card>
          <Empty icon={Wallet} title="Ingen beholdninger ennå">
            Legg inn kjøpene dine (ETF, dato, antall og kurs). Dashbordet regner ut verdi og gevinst i NOK med historiske valutakurser,
            viser fordeling og risiko, og sammenligner med hva du ville hatt i en global indeks. Alt lagres kun i denne nettleseren. Bruk Eksporter/Importer for å flytte mellom enheter.
          </Empty>
        </Card>
        {modalNode}
      </div>
    );
  }

  const r = pf?.risk;
  return (
    <div className="space-y-4">
      {header}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Markedsverdi" value={nok(pf.value)} sub={<span className={tone(pf.day)}>{signedNok(pf.day)} i dag ({pct(pf.dayPct, 2)})</span>} />
        <Stat label="Investert (kostpris)" value={nok(pf.cost)} sub={<span className="text-muted">{pf.holdings.length} posisjoner</span>} />
        <Stat label="Urealisert gevinst" value={<span className={tone(pf.pnl)}>{signedNok(pf.pnl)}</span>} sub={<Delta v={pf.pnlPct} />} />
        <Stat label="Realisert gevinst" value={<span className={tone(pf.realized)}>{signedNok(pf.realized)}</span>} sub={<span className="text-muted">fra salg</span>} />
        <Stat label="Risiko (2 år, dagens vekter)" value={r ? pct(r.vol, 1, false) : "…"} className="col-span-2 lg:col-span-1"
          sub={r && <span className="text-ink2">Beta {num(r.beta, 2)} · maks fall {pct(r.maxdd, 0)}</span>} />
      </div>

      <ValueChart transactions={txs} />

      <Card title="Beholdninger" pad={false}>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-line"><tr>
              <th className="th">ETF</th><th className="th text-right">Antall</th><th className="th text-right">Snittkurs</th>
              <th className="th text-right">Verdi (NOK)</th><th className="th text-right">Vekt</th><th className="th text-right">I dag</th>
              <th className="th text-right">Gevinst</th><th className="th text-right">%</th><th className="th">Signal</th>
            </tr></thead>
            <tbody>
              {pf.holdings.map(h => (
                <tr key={h.ticker} className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-ink/[0.03]" onClick={() => openEtf(h.ticker)}>
                  <td className="td"><div className="flex items-center gap-2"><span className="font-medium text-ink">{h.short}</span><RegionTag region={h.region} /></div><div className="text-[11px] text-muted">{h.ticker} · {h.sector}</div></td>
                  <td className="td text-right num">{num(h.units, h.units % 1 ? 3 : 0)}</td>
                  <td className="td text-right num">{num(h.avgPrice, 2)} {h.currency}</td>
                  <td className="td text-right num font-medium text-ink">{nok(h.valueNok)}</td>
                  <td className="td text-right num">{pct(h.weight * 100, 1, false)}</td>
                  <td className={`td text-right num ${tone(h.dayNok)}`}>{signedNok(h.dayNok)}</td>
                  <td className={`td text-right num ${tone(h.pnlNok)}`}>{signedNok(h.pnlNok)}</td>
                  <td className="td text-right"><Delta v={h.pnlPct} /></td>
                  <td className="td">{h.etf && <SignalBadge signal={h.etf.scores.profiles.balanced.signal} score={h.etf.scores.profiles.balanced.score} small />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Fordeling per sektor"><Bars items={pf.bySector} /></Card>
        <Card title="Fordeling per valuta" sub="Valutaen fondet handles i. Underliggende eksponering kan avvike."><Bars items={pf.byCurrency} /></Card>
        <Card title="Diversifisering">
          {!r ? <div className="skeleton h-28" /> : (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-ink2">Effektivt antall posisjoner</span><span className="num font-medium">{num(r.effN, 1)}</span></div>
              <div className="flex justify-between"><span className="text-ink2">Snittkorrelasjon mellom posisjoner</span><span className="num font-medium">{num(r.avgCorr, 2)}</span></div>
              <div className="flex justify-between"><span className="text-ink2">Årlig avkastning (2 år, simulert)</span><span className="num font-medium"><Delta v={r.annRet} /></span></div>
              <div className="flex justify-between"><span className="text-ink2">Sharpe (rf = 0)</span><span className="num font-medium">{num(r.sharpe, 2)}</span></div>
              <div className="flex justify-between"><span className="text-ink2">Beta mot ACWI</span><span className="num font-medium">{num(r.beta, 2)}</span></div>
              <p className="pt-2 text-[11px] text-muted">Beregnet på ukentlige NOK-avkastninger siste {r.weeks} uker med dagens vekter{r.covered < 0.999 ? ` (dekker ${pct(r.covered * 100, 0, false)} av porteføljen)` : ""}.</p>
            </div>
          )}
        </Card>
      </div>

      <Card title="AI-gjennomgang av porteføljen" sub="Gemini vurderer konsentrasjon, signaler og makrorisiko, og foreslår UCITS-alternativer">
        <AiBox cacheKey={`pf|${txs.length}|${Math.round(pf.value)}`} cta="Analyser porteføljen min"
          buildPrompt={() => portfolioPrompt({ etfs, portfolio: pf })} />
      </Card>

      <Card title="Transaksjoner" pad={false}>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-line"><tr>
              <th className="th">Dato</th><th className="th">Type</th><th className="th">ETF</th><th className="th text-right">Antall</th>
              <th className="th text-right">Kurs</th><th className="th text-right">Gebyr</th><th className="th" />
            </tr></thead>
            <tbody>
              {[...txs].sort((a, b) => b.date.localeCompare(a.date)).map(t => (
                <tr key={t.id} className="border-b border-line/60 last:border-0">
                  <td className="td num">{date(t.date)}</td>
                  <td className="td"><span className={t.type === "buy" ? "text-up" : "text-down"}>{t.type === "buy" ? "Kjøp" : "Salg"}</span></td>
                  <td className="td">{etfs.find(e => e.ticker === t.ticker)?.short || t.ticker}</td>
                  <td className="td text-right num">{num(t.units, t.units % 1 ? 3 : 0)}</td>
                  <td className="td text-right num">{num(t.price, 2)}</td>
                  <td className="td text-right num">{t.fee ? nok(t.fee) : "–"}</td>
                  <td className="td text-right">
                    <button className="btn-ghost p-1" onClick={() => setModal({ type: "edit", tx: t })} aria-label="Endre"><Pencil className="h-3.5 w-3.5" /></button>
                    <button className="btn-ghost p-1 hover:text-down" onClick={() => remove(t.id)} aria-label="Slett"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {modalNode}
    </div>
  );
}

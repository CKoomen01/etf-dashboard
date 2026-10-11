import { useState } from "react";
import { CheckCircle2, ExternalLink, Eye, EyeOff } from "lucide-react";
import { settingsStore, useStore } from "../lib/store.js";
import { listModels, PREFERRED_MODELS } from "../lib/gemini.js";
import { useApp } from "../lib/context.js";
import { PROFILES } from "../lib/data.js";
import { Modal, Seg, Spinner } from "./ui.jsx";

export default function SettingsModal({ onClose }) {
  const { meta } = useApp();
  const [settings, setSettings] = useStore(settingsStore);
  const [key, setKey] = useState(settings.apiKey);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = patch => setSettings(s => ({ ...s, ...patch }));

  async function test() {
    setBusy(true); setStatus(null);
    try {
      const models = await listModels(key.trim());
      set({ apiKey: key.trim(), models });
      setStatus({ ok: true, text: `Nøkkelen virker. ${models.length} Gemini-modeller tilgjengelig.` });
    } catch (e) {
      setStatus({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  }

  const modelOptions = settings.models?.length
    ? [...PREFERRED_MODELS.filter(m => settings.models.includes(m)), ...settings.models.filter(m => !PREFERRED_MODELS.includes(m))]
    : PREFERRED_MODELS;

  return (
    <Modal title="Innstillinger" onClose={onClose} wide>
      <div className="space-y-6">
        <section>
          <h3 className="h-title">Google Gemini (AI)</h3>
          <p className="mt-1 text-sm text-ink2">
            Lag en gratis nøkkel i Google AI Studio og lim den inn her. Nøkkelen lagres bare i denne nettleseren og sendes kun til Google.
          </p>
          <a className="mt-1 inline-flex items-center gap-1 text-sm text-accent hover:underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
            aistudio.google.com/apikey <ExternalLink className="h-3 w-3" />
          </a>
          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <input className="input pr-9 font-mono" type={show ? "text" : "password"} placeholder="AIza…" value={key} onChange={e => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink" onClick={() => setShow(s => !s)} aria-label={show ? "Skjul" : "Vis"}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button className="btn-primary" onClick={test} disabled={!key.trim() || busy}>{busy ? <Spinner /> : null} Lagre og test</button>
          </div>
          {status && <p className={`mt-2 flex items-center gap-1.5 text-sm ${status.ok ? "text-up" : "text-down"}`}>{status.ok && <CheckCircle2 className="h-4 w-4" />}{status.text}</p>}
          {settings.apiKey && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label>
                <span className="h-sub">Modell</span>
                <select className="input" value={settings.model} onChange={e => set({ model: e.target.value })}>
                  <option value="">Automatisk (anbefalt)</option>
                  {modelOptions.map(m => <option key={m}>{m}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink2">
                <input type="checkbox" className="accent-[rgb(var(--accent))]" checked={settings.search} onChange={e => set({ search: e.target.checked })} />
                Bruk Google-søk for ferske nyheter
              </label>
              <button className="btn-ghost justify-start text-xs text-down sm:col-span-2" onClick={() => { set({ apiKey: "", models: [], model: "" }); setKey(""); }}>Fjern nøkkel fra denne nettleseren</button>
            </div>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="h-title mb-2">Visning av kurser og avkastning</h3>
            <Seg label="Valuta" value={settings.currency} onChange={v => set({ currency: v })} options={[["NOK", "I NOK"], ["LOCAL", "Fondets valuta"]]} />
          </div>
          <div>
            <h3 className="h-title mb-2">Tema</h3>
            <Seg label="Tema" value={settings.theme} onChange={v => set({ theme: v })} options={[["system", "System"], ["light", "Lyst"], ["dark", "Mørkt"]]} />
          </div>
          <div className="sm:col-span-2">
            <h3 className="h-title mb-2">Standard signalprofil</h3>
            <Seg label="Profil" value={settings.profile} onChange={v => set({ profile: v })} options={PROFILES.map(p => [p.id, p.long])} />
            <p className="mt-1.5 text-xs text-ink2">{PROFILES.find(p => p.id === settings.profile).desc}</p>
          </div>
        </section>

        <section className="rounded-lg bg-ink/[0.03] p-3 text-xs leading-relaxed text-ink2">
          <b className="text-ink">Om dataene.</b> Kurser hentes fra Yahoo Finance og nyheter fra Google News av en automatisk jobb (GitHub Actions) hver handelsdag.
          Sist oppdatert {new Date(meta.generated).toLocaleString("nb-NO")} · {meta.n_ucits} UCITS- og {meta.n_us} US-ETF-er.
          {meta.failures?.length > 0 && <> Advarsler: {meta.failures.join("; ")}.</>}
          {" "}Portefølje, overvåkingsliste, varsler og AI-nøkkel lagres kun lokalt i nettleseren din.
        </section>
      </div>
    </Modal>
  );
}

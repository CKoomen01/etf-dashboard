// Gjenbrukbar boks for AI-analyser: generer, vis markdown med kilder, hurtigbuffer per datadato.
import { useState } from "react";
import { KeyRound, RefreshCw, Sparkles } from "lucide-react";
import { generate } from "../lib/gemini.js";
import { SYSTEM_BASE } from "../lib/prompts.js";
import { aiCacheGet, aiCacheSet, settingsStore, useStore } from "../lib/store.js";
import { useApp } from "../lib/context.js";
import { ago } from "../lib/format.js";
import { Markdown, Sources, Spinner } from "./ui.jsx";

export default function AiBox({ cacheKey, buildPrompt, cta = "Generer AI-analyse", hint, compact }) {
  const { meta, openSettings } = useApp();
  const [settings] = useStore(settingsStore);
  const key = `${cacheKey}|${meta.generated}`;
  const [res, setRes] = useState(() => aiCacheGet(key));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function run() {
    setBusy(true); setErr(null);
    try {
      const out = await generate({ system: SYSTEM_BASE, messages: [{ role: "user", text: buildPrompt() }], search: settings.search });
      const value = { ...out, at: new Date().toISOString() };
      aiCacheSet(key, value);
      setRes(value);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!settings.apiKey) {
    return (
      <div className="rounded-lg border border-dashed border-line p-4 text-sm text-ink2">
        <div className="mb-1 flex items-center gap-2 font-medium text-ink"><KeyRound className="h-4 w-4" /> Koble til Gemini</div>
        AI-analysene bruker Google Gemini med Google-søk. Legg inn en gratis API-nøkkel fra Google AI Studio for å slå dem på.
        <div className="mt-3"><button className="btn-primary" onClick={openSettings}>Legg inn nøkkel</button></div>
      </div>
    );
  }

  if (!res) {
    return (
      <div className={`flex flex-col items-start gap-2 ${compact ? "" : "py-2"}`}>
        {hint && <p className="text-sm text-ink2">{hint}</p>}
        <button className="btn-primary" onClick={run} disabled={busy}>
          {busy ? <Spinner /> : <Sparkles className="h-4 w-4" />} {busy ? "Analyserer med Gemini og Google-søk …" : cta}
        </button>
        {err && <p className="text-sm text-down">{err}</p>}
      </div>
    );
  }

  return (
    <div className={busy ? "opacity-50 transition-opacity" : ""}>
      <Markdown text={res.text} />
      <Sources sources={res.sources} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span>Gemini ({res.model}) · {ago(res.at)}{res.sources?.length ? " · med Google-søk" : ""}</span>
        <button className="btn-ghost px-2 py-1 text-xs" onClick={run} disabled={busy}>
          {busy ? <Spinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />} Lag ny
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-down">{err}</p>}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Globe, Send, Sparkles, Trash2, X } from "lucide-react";
import { useApp } from "../lib/context.js";
import { chatStore, settingsStore, useStore } from "../lib/store.js";
import { generate } from "../lib/gemini.js";
import { chatSystem } from "../lib/prompts.js";
import { Markdown, Sources, Spinner } from "./ui.jsx";

const QUICK = [
  "Hvilke sektorer har sterkest momentum nå, og hvorfor?",
  "Hvilke kjøpbare UCITS-ETF-er ser billigst ut mot egen historikk?",
  "Analyser porteføljen min kort: hva er største risiko?",
  "Hva betyr kronekursen for avkastningen min i år?",
  "Forklar forskjellen på Verdi-, Balansert- og Momentum-signalene.",
];

export default function ChatPanel({ initialPrompt, focus, onClose }) {
  const app = useApp();
  const [settings, setSettings] = useStore(settingsStore);
  const [msgs, setMsgs] = useStore(chatStore);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const endRef = useRef(null);
  const sentInitial = useRef(false);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => {
    const k = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput(""); setErr(null);
    const history = [...msgs, { role: "user", text: q }];
    setMsgs(history);
    setBusy(true);
    try {
      const system = chatSystem({ etfs: app.etfs, market: app.market, portfolio: app.portfolio, focus: focus ? app.etfMap[focus] : null });
      // Send bare de siste 12 meldingene for å holde forespørselen liten
      const out = await generate({ system, messages: history.slice(-12), search: settings.search });
      setMsgs([...history, { role: "model", text: out.text, sources: out.sources }]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (initialPrompt && !sentInitial.current && settings.apiKey) { sentInitial.current = true; send(initialPrompt); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  return (
    <div className="fixed inset-0 z-[55] flex justify-end bg-black/30 animate-fade-in" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <aside className="flex h-full w-full max-w-xl flex-col bg-surface shadow-2xl animate-slide-in" role="dialog" aria-label="AI-assistent">
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <div>
              <div className="text-sm font-semibold">Spør AI</div>
              <div className="text-[11px] text-muted">Gemini kjenner alle tallene i dashbordet{app.portfolio?.holdings.length ? " og porteføljen din" : ""}{focus ? ` · fokus: ${app.etfMap[focus]?.short}` : ""}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className={`btn-ghost px-2 text-xs ${settings.search ? "text-accent" : ""}`} onClick={() => setSettings(s => ({ ...s, search: !s.search }))}
              title="Slå Google-søk av/på" aria-pressed={settings.search}>
              <Globe className="h-3.5 w-3.5" /> Søk {settings.search ? "på" : "av"}
            </button>
            {msgs.length > 0 && <button className="btn-ghost p-1.5" onClick={() => setMsgs([])} aria-label="Tøm samtalen"><Trash2 className="h-4 w-4" /></button>}
            <button className="btn-ghost p-1.5" onClick={onClose} aria-label="Lukk"><X className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {!settings.apiKey && (
            <div className="rounded-lg border border-dashed border-line p-4 text-sm text-ink2">
              Legg inn en gratis Gemini API-nøkkel for å bruke chatten.
              <div className="mt-2"><button className="btn-primary" onClick={app.openSettings}>Åpne innstillinger</button></div>
            </div>
          )}
          {settings.apiKey && !msgs.length && (
            <div>
              <p className="mb-3 text-sm text-ink2">Spør om markedet, en sektor, en ETF eller porteføljen din. Med søk på henter Gemini ferske nyheter fra Google.</p>
              <div className="flex flex-col gap-2">
                {QUICK.map(q => <button key={q} className="rounded-lg border border-line px-3 py-2 text-left text-sm text-ink2 hover:border-accent hover:text-ink" onClick={() => send(q)}>{q}</button>)}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            m.role === "user"
              ? <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-sm text-white">{m.text}</div>
              : <div key={i} className="max-w-full"><Markdown text={m.text} /><Sources sources={m.sources} /></div>
          ))}
          {busy && <div className="flex items-center gap-2 text-sm text-ink2"><Spinner /> Tenker{settings.search ? " og søker" : ""} …</div>}
          {err && <div className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-down">{err}</div>}
          <div ref={endRef} />
        </div>

        <form className="border-t border-line p-3" onSubmit={e => { e.preventDefault(); send(); }}>
          <div className="flex items-end gap-2">
            <textarea className="input max-h-40 min-h-[42px] resize-none" rows={1} placeholder="Skriv et spørsmål …" value={input}
              onChange={e => setInput(e.target.value)} disabled={!settings.apiKey}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button className="btn-primary h-[38px]" disabled={!input.trim() || busy || !settings.apiKey} aria-label="Send"><Send className="h-4 w-4" /></button>
          </div>
          <p className="mt-1.5 text-[10px] text-muted">AI kan ta feil. Analyse, ikke personlig investeringsrådgivning.</p>
        </form>
      </aside>
    </div>
  );
}

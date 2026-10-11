// Google Gemini (gratisnivå) direkte fra nettleseren. Nøkkelen lagres kun lokalt hos brukeren.
// Bruker Google Search-grounding slik at analysene kan vise til ferske nyheter med kilder.
import { settingsStore } from "./store.js";

const API = "https://generativelanguage.googleapis.com/v1beta";

// Foretrukket rekkefølge. Ved kvotebrudd eller ukjent modell prøves neste.
export const PREFERRED_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

export class ApiError extends Error {
  constructor(message, status = 0, retryDelay = null, raw = "") {
    super(message);
    this.status = status;
    this.retryDelay = retryDelay;
    this.raw = raw;
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function friendly(status, raw = "") {
  if (status === 400 && /api key/i.test(raw)) return "API-nøkkelen er ugyldig. Sjekk den under Innstillinger.";
  if (status === 403) return "API-nøkkelen har ikke tilgang (403). Sjekk at den er laget i Google AI Studio.";
  if (status === 429) return "Gratiskvoten hos Google er brukt opp akkurat nå. Vent et minutt (eller til i morgen om dagskvoten er nådd).";
  if (status >= 500) return "Googles AI-servere er overbelastet akkurat nå. Prøv igjen om litt.";
  return `Feil fra AI-tjenesten (${status}): ${raw}`;
}

async function toApiError(res) {
  let body = {};
  try { body = await res.json(); } catch { /* tom */ }
  const err = body.error || {};
  const retry = (err.details || []).find(d => String(d["@type"]).includes("RetryInfo"))?.retryDelay;
  return new ApiError(friendly(res.status, err.message), res.status, retry ? parseFloat(retry) : null, err.message || "");
}

export async function listModels(apiKey) {
  const res = await fetch(`${API}/models?pageSize=1000`, { headers: { "x-goog-api-key": apiKey } });
  if (!res.ok) throw await toApiError(res);
  const data = await res.json();
  return (data.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map(m => m.name.replace(/^models\//, ""))
    .filter(n => /^gemini/.test(n) && !/(tts|image|live|embed|audio|robotics|transcribe|translate|computer|omni)/.test(n));
}

function candidateModels() {
  const { model, models } = settingsStore.get();
  const available = models?.length ? PREFERRED_MODELS.filter(m => models.includes(m)) : PREFERRED_MODELS;
  return [...new Set([model, ...available].filter(Boolean))].slice(0, 4);
}

function parse(data, model) {
  const cand = data.candidates?.[0];
  if (!cand) {
    const reason = data.promptFeedback?.blockReason;
    throw new ApiError(reason ? `AI-en avviste forespørselen (${reason}).` : "Fikk tomt svar fra AI-en. Prøv igjen.");
  }
  const text = (cand.content?.parts || []).filter(p => p.text && !p.thought).map(p => p.text).join("");
  if (!text) throw new ApiError(`AI-en stoppet uten svar (${cand.finishReason || "ukjent grunn"}). Prøv igjen.`);
  const gm = cand.groundingMetadata || {};
  const seen = new Set();
  const sources = (gm.groundingChunks || [])
    .map(c => c.web)
    .filter(w => w?.uri && !seen.has(w.uri) && seen.add(w.uri))
    .map(w => ({ title: w.title || w.uri, url: w.uri }));
  return { text, sources, queries: gm.webSearchQueries || [], model };
}

/**
 * Genererer tekst (markdown).
 * @param {object} o
 * @param {string} o.system   systeminstruks
 * @param {Array}  o.messages [{role:"user"|"model", text}]
 * @param {boolean} o.search  bruk Google Search-grounding
 */
export async function generate({ system, messages, search = true, temperature = 0.4 }) {
  const { apiKey } = settingsStore.get();
  if (!apiKey) throw new ApiError("Legg inn en gratis Gemini API-nøkkel under Innstillinger først.");

  const contents = messages.map(m => ({ role: m.role === "model" ? "model" : "user", parts: [{ text: m.text }] }));
  const makeBody = withSearch => JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents,
    ...(withSearch ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: { temperature, maxOutputTokens: 4096 },
  });

  let lastError;
  for (const model of candidateModels()) {
    let useSearch = search;
    for (let attempt = 0; attempt < 3; attempt++) {
      let res;
      try {
        res = await fetch(`${API}/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: makeBody(useSearch),
        });
      } catch {
        lastError = new ApiError("Fikk ikke kontakt med AI-tjenesten. Sjekk nettforbindelsen.");
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (res.ok) return parse(await res.json(), model);

      lastError = await toApiError(res);
      const { status } = res;
      // Søk er ikke tilgjengelig for alle modeller/kvoter: prøv samme modell uten søk
      if (useSearch && (status === 400 || status === 429) && /search|ground|tool/i.test(lastError.raw)) {
        useSearch = false;
        continue;
      }
      if (status === 429) {
        if (attempt === 0 && lastError.retryDelay != null && lastError.retryDelay <= 30) {
          await sleep(lastError.retryDelay * 1000 + 500);
          continue;
        }
        break;
      }
      if (status === 404 || (status === 400 && /model/i.test(lastError.raw) && !/api key/i.test(lastError.raw))) break;
      if (status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
      throw lastError;
    }
  }
  throw lastError;
}

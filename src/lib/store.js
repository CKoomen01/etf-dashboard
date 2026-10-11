// Små globale tilstandslagre som lagres i nettleseren (localStorage).
// Alt brukeren legger inn (API-nøkkel, portefølje, varsler) blir værende på denne enheten.
import { useSyncExternalStore } from "react";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function createStore(key, fallback) {
  let state = read(key, fallback);
  // Objekter slås sammen med standardverdiene slik at nye innstillinger får en verdi
  const isObj = v => v && typeof v === "object" && !Array.isArray(v);
  if (isObj(fallback)) state = isObj(state) ? { ...fallback, ...state } : fallback;
  else if (Array.isArray(fallback) && !Array.isArray(state)) state = fallback;
  const subs = new Set();
  return {
    get: () => state,
    set(next) {
      state = typeof next === "function" ? next(state) : next;
      try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* full eller blokkert */ }
      subs.forEach(fn => fn());
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

export const settingsStore = createStore("etf.settings", {
  apiKey: "",
  model: "",
  models: [],
  theme: "system",
  currency: "NOK",       // "NOK" eller "LOCAL"
  profile: "balanced",
  region: "ALL",         // "ALL" | "UCITS" | "US"
  search: true,          // Google-søk i AI-svar
});
export const portfolioStore = createStore("etf.portfolio", { transactions: [] });
export const watchStore = createStore("etf.watchlist", []);
export const alertStore = createStore("etf.alerts", []);
export const compareStore = createStore("etf.compare", ["VWCE.DE", "SEC0.DE", "4GLD.DE"]);
export const signalLogStore = createStore("etf.signallog", { date: null, prev: {}, log: [] });
export const chatStore = createStore("etf.chat", []);

export function useStore(store) {
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  return [state, store.set];
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ── AI-hurtigbuffer (én nøkkel per analyse) ─────────────────────────
export function aiCacheGet(key) {
  try { return JSON.parse(localStorage.getItem(`etf.ai.${key}`)); } catch { return null; }
}
export function aiCacheSet(key, value) {
  try {
    localStorage.setItem(`etf.ai.${key}`, JSON.stringify(value));
  } catch {
    // Rydd opp gamle analyser hvis lagringen er full
    Object.keys(localStorage).filter(k => k.startsWith("etf.ai.")).forEach(k => localStorage.removeItem(k));
  }
}

// ── Eksport / import av brukerdata ──────────────────────────────────
export function exportUserData() {
  return {
    app: "etf-dashboard",
    version: 2,
    exported: new Date().toISOString(),
    portfolio: portfolioStore.get(),
    watchlist: watchStore.get(),
    alerts: alertStore.get(),
    compare: compareStore.get(),
  };
}

export function importUserData(obj) {
  if (!obj || obj.app !== "etf-dashboard") throw new Error("Filen ser ikke ut som en eksport fra ETF Dashboard.");
  if (obj.portfolio?.transactions) portfolioStore.set(obj.portfolio);
  if (Array.isArray(obj.watchlist)) watchStore.set(obj.watchlist);
  if (Array.isArray(obj.alerts)) alertStore.set(obj.alerts);
  if (Array.isArray(obj.compare)) compareStore.set(obj.compare);
}

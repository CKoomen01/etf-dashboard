// Bygger promptene til Gemini. Tallene fra dashbordet sendes med som fasit,
// slik at AI-en ikke dikter opp kurser eller nøkkeltall.
import { PROFILES, SIGNAL_TEXT } from "./data.js";

const f = (v, d = 1) => (v == null ? "–" : Number(v).toFixed(d));
const today = () => new Date().toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });

export const SYSTEM_BASE = `Du er en erfaren, nøktern porteføljeanalytiker som skriver for en norsk privatinvestor med middels lang horisont (måneder til år).
- Svar alltid på norsk bokmål, kort og konkret. Bruk markdown med korte overskrifter og punktlister.
- Tallene du får fra dashbordet (kurser, avkastning, trend, verdsettelse, risiko, signaler) er fasit. Ikke finn på andre tall for disse.
- Bruk Google-søk for ferske nyheter, makro (renter, inflasjon, valuta, sentralbanker), geopolitikk og regulering. Si tydelig hva som kommer fra nyheter.
- «Verdsettelse» i dashbordet er kursbasert (prosentil av egen kurshistorikk og avvik fra langsiktig trend), ikke P/E. Forklar det hvis det er relevant.
- Amerikanske ETF-er (region US) kan ikke kjøpes av norske privatpersoner (PRIIPs/KID). Når du omtaler dem, pek på et UCITS-alternativ fra listen hvis det finnes.
- Avkastning i NOK påvirkes av valuta. Kommenter valutaeffekten når den er stor.
- Du gir analyse og vurderinger, ikke personlig investeringsrådgivning. Avslutt aldri med lange forbehold; én kort setning holder ved behov.
Dagens dato: ${today()}.`;

export function etfLine(e) {
  const p = e.scores.profiles;
  return [
    e.ticker, e.short, e.region, e.sector, e.sub,
    `1M ${f(e.ret_nok["1M"])}%`, `3M ${f(e.ret_nok["3M"])}%`, `YTD ${f(e.ret_nok.YTD)}%`, `1Y ${f(e.ret_nok["1Y"])}%`,
    `trend ${e.trend.label}`, `RSI ${f(e.trend.rsi, 0)}`,
    `trendjust.pct ${f(e.valuation.detrended_pct, 0)}`, `vol ${f(e.risk.vol_1y, 0)}%`,
    `signal V/B/M ${p.value.signal}/${p.balanced.signal}/${p.momentum.signal}`,
  ].join(" | ");
}

export function dataTable(etfs) {
  return `Kolonner: ticker | navn | region | sektor | undersektor | avkastning i NOK | trend | RSI | trendjustert prisprosentil (0=billig,100=dyr) | volatilitet 1 år | signal (Verdi/Balansert/Momentum)\n${etfs.map(etfLine).join("\n")}`;
}

export function marketLines(market) {
  return (market || []).map(m => `${m.name}: ${f(m.price, 2)} (1D ${f(m.ret["1D"])}%, 1M ${f(m.ret["1M"])}%, YTD ${f(m.ret.YTD)}%)`).join("\n");
}

function sectorSummary(etfs) {
  const by = {};
  for (const e of etfs) (by[e.sector] ||= []).push(e);
  return Object.entries(by).map(([s, list]) => {
    const avg = k => list.reduce((a, e) => a + (e.ret_nok[k] ?? 0), 0) / list.length;
    return `${s}: 1M ${f(avg("1M"))}%, 3M ${f(avg("3M"))}%, YTD ${f(avg("YTD"))}%`;
  }).join("\n");
}

export function portfolioText(summary) {
  if (!summary || !summary.holdings?.length) return "Brukeren har ikke lagt inn noen portefølje.";
  const lines = summary.holdings.map(h =>
    `${h.ticker} (${h.short}, ${h.sector}, ${h.region}): vekt ${f(h.weight * 100)}%, verdi ${f(h.valueNok, 0)} NOK, gevinst ${f(h.pnlPct)}%`);
  return `Markedsverdi ${f(summary.value, 0)} NOK, investert ${f(summary.cost, 0)} NOK, urealisert ${f(summary.pnlPct)}%.
Porteføljerisiko (nåværende vekter, siste 2 år): volatilitet ${f(summary.risk?.vol)}%, beta mot ACWI ${f(summary.risk?.beta, 2)}, maks fall ${f(summary.risk?.maxdd)}%.
Beholdninger:\n${lines.join("\n")}`;
}

export function etfPrompt(e, { news = [], neighbors = [], ucitsAlt = [] } = {}) {
  const v = e.valuation, t = e.trend, r = e.risk, s = e.scores;
  const prof = PROFILES.map(p => `${p.long} (${p.weights}): ${SIGNAL_TEXT[s.profiles[p.id].signal]} – score ${f(s.profiles[p.id].score, 0)}/100`).join("\n");
  return `Skriv en analyse av ${e.name} (${e.ticker}), ${e.region === "US" ? "amerikansk ETF (ikke kjøpbar for norske privatkunder)" : "UCITS-ETF kjøpbar i Norge"}.
Sektor: ${e.sector} – ${e.sub}. Handles i ${e.currency}. Siste kurs ${f(e.price, 2)} ${e.currency} (${f(e.price_nok, 2)} NOK) per ${e.date}.

AVKASTNING (lokal valuta / NOK):
${["1W", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y"].map(k => `${k}: ${f(e.ret[k])}% / ${f(e.ret_nok[k])}%`).join(", ")} (3Y og 5Y annualisert)
TREND: ${t.label}. Over MA50: ${t.above_ma50}, over MA200: ${t.above_ma200}, MA50>MA200: ${t.golden_cross}. Avstand til MA200 ${f(t.dist_ma200)}%. Trendhelning 3M ${f(t.slope_month)}%/mnd. RSI ${f(t.rsi, 0)}. 12–1 mnd momentum ${f(t.mom_12_1)}%. ${f(t.from_high_52w)}% fra 52-ukers topp. Relativ styrke vs ACWI 3M ${f(e.rel_3m)} pp.
VERDSETTELSE (kursbasert): trendjustert prosentil ${f(v.detrended_pct, 0)} (${v.detrended_label || "–"}), ${f(v.trend_dev)}% fra 5-års trendlinje. Prisprosentil 1Y ${f(v.windows["1Y"]?.pct, 0)}, 3Y ${f(v.windows["3Y"]?.pct, 0)}, 5Y ${f(v.windows["5Y"]?.pct, 0)}.
RISIKO (NOK): volatilitet 1Y ${f(r.vol_1y)}%, maks fall 3Y ${f(r.maxdd_3y)}%, Sharpe 1Y ${f(r.sharpe_1y, 2)}, beta mot ACWI ${f(r.beta, 2)}, korrelasjon ${f(r.corr_bench, 2)}.
FOND: TER ${e.fund.ter != null ? f(e.fund.ter, 2) + "%" : "–"}, P/E ${f(e.fund.pe)}, utbytte ${f(e.fund.yield, 2)}%.
REGELBASERTE SIGNALER:\n${prof}
Begrunnelse trend: ${s.trend_notes.join("; ")}. Verdsettelse: ${s.val_notes.join("; ")}.
${neighbors.length ? `Mest korrelerte ETF-er: ${neighbors.join(", ")}.` : ""}
${ucitsAlt.length ? `UCITS-alternativer i samme undersektor: ${ucitsAlt.join(", ")}.` : ""}
${news.length ? `Siste overskrifter i sektoren:\n${news.slice(0, 8).map(n => `- ${n.title} (${n.source})`).join("\n")}` : ""}

Struktur:
## Kort oppsummert
2–3 setninger med hovedkonklusjonen, og én linje per profil (Verdi / Balansert / Momentum) med signal og hvorfor.
## Hva tallene sier
Trend, verdsettelse og risiko – tolk tallene, ikke bare gjenta dem.
## Makro og nyheter nå
Søk etter det viktigste som driver denne sektoren nå (renter, råvarepriser, regulering, geopolitikk, inntjening).
## Risikoer og hva du bør følge med på
3–5 punkter, gjerne med konkrete nivåer (MA200, 52-ukers topp/bunn) eller hendelser med dato.
${e.region === "US" ? "## Kjøpbart alternativ i Norge\nForeslå UCITS-alternativ(er)." : ""}`;
}

export function briefPrompt({ etfs, market, news, portfolio, profile }) {
  const top = [...etfs].sort((a, b) => b.scores.profiles[profile].score - a.scores.profiles[profile].score);
  const headlines = Object.entries(news || {})
    .filter(([k]) => ["Marked", "Norge"].includes(k))
    .flatMap(([k, list]) => list.slice(0, 6).map(n => `- [${k}] ${n.title} (${n.source})`)).join("\n");
  return `Lag dagens markedsbrief for dashbordet.

MARKEDSSTRIPE:
${marketLines(market)}

SEKTORER (snitt NOK-avkastning):
${sectorSummary(etfs)}

HØYEST SCORE (${profile}): ${top.slice(0, 6).map(e => `${e.ticker} ${e.short} ${f(e.scores.profiles[profile].score, 0)}`).join(", ")}
LAVEST SCORE: ${top.slice(-5).map(e => `${e.ticker} ${e.short} ${f(e.scores.profiles[profile].score, 0)}`).join(", ")}

OVERSKRIFTER:
${headlines}

PORTEFØLJE:
${portfolioText(portfolio)}

Struktur (maks ca. 350 ord):
## Markedet nå
## Sektorrotasjon
Hvilke sektorer leder og henger etter, og hvorfor (søk etter årsaker).
## Verdt å merke seg i signalene
## Hva betyr det for porteføljen din
(Hopp over hvis ingen portefølje.)
## Kommende hendelser
Søk etter viktige hendelser de neste 1–2 ukene (rentemøter, KPI, store regnskap) med datoer.`;
}

export function portfolioPrompt({ etfs, portfolio }) {
  const held = new Set(portfolio.holdings.map(h => h.ticker));
  const ucits = etfs.filter(e => e.region === "UCITS" && !held.has(e.ticker));
  return `Vurder porteføljen min.

${portfolioText(portfolio)}

Fordeling per sektor: ${portfolio.bySector.map(x => `${x.key} ${f(x.weight * 100)}%`).join(", ")}
Fordeling per valuta: ${portfolio.byCurrency.map(x => `${x.key} ${f(x.weight * 100)}%`).join(", ")}
Effektivt antall posisjoner: ${f(portfolio.risk?.effN, 1)}. Snittkorrelasjon mellom posisjonene: ${f(portfolio.risk?.avgCorr, 2)}.

Nøkkeltall for beholdningene:
${dataTable(etfs.filter(e => held.has(e.ticker)))}

Andre kjøpbare UCITS-ETF-er i dashbordet (for forslag til diversifisering):
${ucits.map(e => `${e.ticker} ${e.short} (${e.sector}, signal B: ${e.scores.profiles.balanced.signal}, korr. ACWI ${f(e.risk.corr_bench, 2)})`).join("; ")}

Struktur:
## Helhetsvurdering
## Konsentrasjon og diversifisering
Sektor-, region- og valutarisiko, overlapp mellom fond.
## Signaler i beholdningene
## Mulige justeringer
Konkrete forslag fra listen over (UCITS), med begrunnelse. Vær balansert.
## Makrorisiko å følge med på`;
}

export function chatSystem({ etfs, market, portfolio, focus }) {
  return `${SYSTEM_BASE}

Du er innebygd i et ETF-dashbord og svarer på spørsmål fra brukeren. Hold svarene korte med mindre brukeren ber om mer.

MARKEDSSTRIPE:
${marketLines(market)}

ALLE ETF-ER I DASHBORDET:
${dataTable(etfs)}

PORTEFØLJE:
${portfolioText(portfolio)}
${focus ? `\nBrukeren ser nå på: ${etfLine(focus)}` : ""}`;
}

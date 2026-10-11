# ETF Dashboard

Et ETF-dashbord for norske investorer. Det viser sektortrender, verdsettelse mot egen historikk, risiko, regelbaserte signaler, egen portefølje i NOK og AI-analyser med Google Gemini.

## Hva det gjør

- **Oversikt:** markedsstripe med indekser, rente, olje, gull, VIX og NOK-kurser. Her finner du også et sektorvarmekart, de største bevegelsene, nyheter og en daglig AI-brief.
- **Screener:** 87 ETF-er med søk og filtre. 46 er UCITS-ETF-er som kan kjøpes i Norge, og 41 er amerikanske ETF-er som kun vises som markedssignal. Du kan velge mellom kolonnesettene avkastning, teknisk, risiko, verdsettelse og signaler, og eksportere til CSV.
- **ETF-detaljer:** kursgraf med MA50/MA200 i lokal valuta eller NOK, og avkastning i begge valutaer. Signaler vises for tre profiler (Verdi, Balansert og Momentum) med begrunnelse. I tillegg finner du trendjustert verdsettelse, risikotall, fondsfakta, korrelasjon og nyheter, og en AI-analyse med Google-søk.
- **Sammenlign:** opptil 6 ETF-er, indeksert til 100. Nøkkeltall vises side om side sammen med en korrelasjonsmatrise og et risiko/avkastningsplott.
- **Portefølje:** du legger inn kjøp og salg, og verdi og gevinst regnes i NOK med historiske valutakurser. Siden viser også verdiutvikling mot «samme innskudd i MSCI ACWI», fordeling, risiko og en AI-gjennomgang. Data kan eksporteres og importeres som fil.
- **Overvåking:** overvåkingsliste, varsler (kurs, RSI, avstand fra topp, score osv.) og en logg over signalendringer.
- **Spør AI:** chat med Gemini. Den kjenner alle tallene i dashbordet og porteføljen din, og kan søke i Google etter ferske nyheter.

## Slik fungerer det

```
GitHub Actions (hver handelsdag)
  └─ scripts/fetch_data.py  → Yahoo Finance + Google News → public/data/*.json
  └─ npm run build           → statisk nettside (dist/)
  └─ publiseres
Nettleseren
  └─ leser JSON-filene, regner portefølje/risiko lokalt
  └─ kaller Gemini direkte med brukerens egen nøkkel
```

Nettsiden trenger ingen server. Portefølje, varsler og Gemini-nøkkel lagres bare i nettleseren til den som bruker siden.

## Gemini-nøkkel

1. Gå til <https://aistudio.google.com/apikey> og lag en gratis nøkkel.
2. Åpne dashbordet, trykk på tannhjulet og lim inn nøkkelen.

## Kjøre lokalt

Du trenger Python 3.11+ og Node 20+.

```bash
pip install -r scripts/requirements.txt
npm install
npm run data
npm run dev
```

## Om signalene

Signalene er regelbaserte. Hver ETF får to delscorer fra 0 til 100:

- **Verdsettelse:** hvor kursen ligger i forhold til sin egen 5-års trendlinje (60 %), og prisprosentilen over 1 og 3 år (20 % hver). Lav verdi betyr billig mot egen historikk. ETF-er har ikke fritt tilgjengelig historisk P/E, så dette er kursbasert.
- **Trend:** posisjon mot MA50 og MA200, golden cross, trendhelning over 3 måneder, 12–1 måneders momentum, RSI og relativ styrke mot MSCI ACWI.

Profilene vekter disse ulikt: Verdi 70/30, Balansert 50/50 og Momentum 30/70. Score 60 eller mer gir Kjøp, og under 40 gir Selg.

Dette er et analyseverktøy, ikke personlig investeringsrådgivning.

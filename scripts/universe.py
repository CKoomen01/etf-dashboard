"""
ETF-universet for dashbordet.

To grupper:
  UCITS — europeisk-noterte ETF-er som norske privatpersoner kan kjøpe (Nordnet, DNB m.fl.).
  US    — amerikanske sektor-ETF-er. Gode og likvide markedssignaler, men ikke kjøpbare
          for norske privatkunder pga. PRIIPs/KID-reglene.

Alle tickere er sjekket mot Yahoo Finance (oktober 2026).
"""

SECTORS = [
    "Brede indekser", "Teknologi", "Energi", "Helse", "Finans", "Industri",
    "Forbruk", "Materialer", "Råvarer", "Forsyning", "Eiendom", "Kommunikasjon",
    "Obligasjoner",
]


def _e(ticker, name, short, sector, sub, region, keywords=()):
    return {
        "ticker": ticker,
        "name": name,
        "short": short,
        "sector": sector,
        "sub": sub,
        "region": region,              # "UCITS" eller "US"
        "buyable_no": region == "UCITS",
        "keywords": list(keywords),
    }


UCITS = [
    # Brede indekser
    _e("VWCE.DE", "Vanguard FTSE All-World UCITS ETF (Acc)", "FTSE All-World", "Brede indekser", "Global", "UCITS"),
    _e("SPYY.DE", "SPDR MSCI All Country World UCITS ETF", "MSCI ACWI", "Brede indekser", "Global", "UCITS"),
    _e("EUNL.DE", "iShares Core MSCI World UCITS ETF (Acc)", "MSCI World", "Brede indekser", "Utviklede markeder", "UCITS"),
    _e("SXR8.DE", "iShares Core S&P 500 UCITS ETF (Acc)", "S&P 500", "Brede indekser", "USA", "UCITS"),
    _e("EXXT.DE", "iShares NASDAQ-100 UCITS ETF (DE)", "Nasdaq-100", "Brede indekser", "USA vekst", "UCITS"),
    _e("EXSA.DE", "iShares STOXX Europe 600 UCITS ETF (DE)", "Europa 600", "Brede indekser", "Europa", "UCITS"),
    _e("IS3N.DE", "iShares Core MSCI EM IMI UCITS ETF (Acc)", "Fremvoksende", "Brede indekser", "Fremvoksende markeder", "UCITS"),
    _e("ZPDJ.DE", "SPDR MSCI Japan UCITS ETF", "Japan", "Brede indekser", "Japan", "UCITS"),
    _e("IUSN.DE", "iShares MSCI World Small Cap UCITS ETF (Acc)", "Småselskaper", "Brede indekser", "Small cap global", "UCITS"),
    _e("VVGM.DE", "VanEck Morningstar Global Wide Moat UCITS ETF", "Wide Moat", "Brede indekser", "Kvalitet", "UCITS"),
    # Teknologi
    _e("XDWT.DE", "Xtrackers MSCI World Information Technology UCITS ETF", "Verden IT", "Teknologi", "Bred IT", "UCITS"),
    _e("EXV3.DE", "iShares STOXX Europe 600 Technology UCITS ETF (DE)", "Europa tech", "Teknologi", "Europeisk IT", "UCITS"),
    _e("SEC0.DE", "iShares MSCI Global Semiconductors UCITS ETF (Acc)", "Halvledere", "Teknologi", "Halvledere", "UCITS"),
    _e("VVSM.DE", "VanEck Semiconductor UCITS ETF", "Halvledere (VanEck)", "Teknologi", "Halvledere", "UCITS"),
    _e("XAIX.DE", "Xtrackers Artificial Intelligence & Big Data UCITS ETF", "AI & Big Data", "Teknologi", "Kunstig intelligens", "UCITS"),
    _e("2B76.DE", "iShares Automation & Robotics UCITS ETF (Acc)", "Robotikk", "Teknologi", "Robotikk & automasjon", "UCITS"),
    _e("USPY.DE", "L&G Cyber Security UCITS ETF", "Cybersikkerhet", "Teknologi", "Cybersikkerhet", "UCITS"),
    # Energi
    _e("XDW0.DE", "Xtrackers MSCI World Energy UCITS ETF", "Verden energi", "Energi", "Bred energi", "UCITS"),
    _e("EXH1.DE", "iShares STOXX Europe 600 Oil & Gas UCITS ETF (DE)", "Europa olje & gass", "Energi", "Olje & gass", "UCITS"),
    _e("IS0D.DE", "iShares Oil & Gas Exploration & Production UCITS ETF", "Olje & gass E&P", "Energi", "Olje & gass", "UCITS"),
    _e("IQQH.DE", "iShares Global Clean Energy UCITS ETF", "Ren energi", "Energi", "Fornybar", "UCITS"),
    _e("URNU.DE", "Global X Uranium UCITS ETF (Acc)", "Uran", "Energi", "Kjernekraft", "UCITS"),
    _e("U3O8.DE", "Sprott Uranium Miners UCITS ETF (Acc)", "Urangruver", "Energi", "Kjernekraft", "UCITS"),
    # Helse
    _e("XDWH.DE", "Xtrackers MSCI World Health Care UCITS ETF", "Verden helse", "Helse", "Bred helse", "UCITS"),
    _e("QDVG.DE", "iShares S&P 500 Health Care Sector UCITS ETF (Acc)", "USA helse", "Helse", "Bred helse", "UCITS"),
    _e("2B70.DE", "iShares Nasdaq US Biotechnology UCITS ETF (Acc)", "Bioteknologi", "Helse", "Bioteknologi", "UCITS"),
    # Finans
    _e("XDWF.DE", "Xtrackers MSCI World Financials UCITS ETF", "Verden finans", "Finans", "Bred finans", "UCITS"),
    _e("EXV1.DE", "iShares STOXX Europe 600 Banks UCITS ETF (DE)", "Europeiske banker", "Finans", "Banker", "UCITS"),
    # Industri
    _e("XDWI.DE", "Xtrackers MSCI World Industrials UCITS ETF", "Verden industri", "Industri", "Bred industri", "UCITS"),
    _e("DFEN.DE", "VanEck Defense UCITS ETF", "Forsvar", "Industri", "Forsvar & luftfart", "UCITS"),
    # Forbruk
    _e("XDWC.DE", "Xtrackers MSCI World Consumer Discretionary UCITS ETF", "Verden forbruk (sykl.)", "Forbruk", "Syklisk forbruk", "UCITS"),
    _e("XDWS.DE", "Xtrackers MSCI World Consumer Staples UCITS ETF", "Verden konsumvarer", "Forbruk", "Defensivt forbruk", "UCITS"),
    # Materialer
    _e("XDWM.DE", "Xtrackers MSCI World Materials UCITS ETF", "Verden materialer", "Materialer", "Bred materialer", "UCITS"),
    _e("EXV6.DE", "iShares STOXX Europe 600 Basic Resources UCITS ETF (DE)", "Europa råstoff", "Materialer", "Gruvedrift", "UCITS"),
    # Råvarer
    _e("4GLD.DE", "Xetra-Gold", "Gull", "Råvarer", "Gull", "UCITS"),
    _e("PHAG.L", "WisdomTree Physical Silver", "Sølv", "Råvarer", "Sølv", "UCITS"),
    _e("COPX.L", "Global X Copper Miners UCITS ETF", "Kobbergruver", "Råvarer", "Kobber", "UCITS"),
    _e("VVMX.DE", "VanEck Rare Earth and Strategic Metals UCITS ETF", "Sjeldne jordarter", "Råvarer", "Strategiske metaller", "UCITS"),
    _e("BATE.DE", "L&G Battery Value-Chain UCITS ETF", "Batteri-verdikjede", "Råvarer", "Litium & batteri", "UCITS"),
    # Forsyning
    _e("XDWU.DE", "Xtrackers MSCI World Utilities UCITS ETF", "Verden forsyning", "Forsyning", "Bred forsyning", "UCITS"),
    _e("EXH9.DE", "iShares STOXX Europe 600 Utilities UCITS ETF (DE)", "Europa forsyning", "Forsyning", "Bred forsyning", "UCITS"),
    _e("IQQQ.DE", "iShares Global Water UCITS ETF", "Vann", "Forsyning", "Vann", "UCITS"),
    # Eiendom
    _e("IQQ6.DE", "iShares Developed Markets Property Yield UCITS ETF", "Global eiendom", "Eiendom", "REITs", "UCITS"),
    # Kommunikasjon
    _e("XWTS.DE", "Xtrackers MSCI World Communication Services UCITS ETF", "Verden kommunikasjon", "Kommunikasjon", "Bred kommunikasjon", "UCITS"),
    # Obligasjoner
    _e("EUNA.DE", "iShares Core Global Aggregate Bond UCITS ETF EUR Hedged (Acc)", "Globale obligasjoner", "Obligasjoner", "Global aggregat (EUR-sikret)", "UCITS"),
    _e("EXX6.DE", "iShares eb.rexx Government Germany 10.5+yr UCITS ETF", "Tyske statsobl. 10+ år", "Obligasjoner", "Lang rente", "UCITS"),
]

US = [
    # Brede indekser
    _e("SPY", "SPDR S&P 500 ETF Trust", "S&P 500 (US)", "Brede indekser", "USA", "US"),
    _e("QQQ", "Invesco QQQ Trust", "Nasdaq-100 (US)", "Brede indekser", "USA vekst", "US"),
    _e("ACWI", "iShares MSCI ACWI ETF", "MSCI ACWI (US)", "Brede indekser", "Global", "US"),
    # Teknologi
    _e("XLK", "Technology Select Sector SPDR Fund", "Teknologi (US)", "Teknologi", "Bred IT", "US"),
    _e("SOXX", "iShares Semiconductor ETF", "Halvledere (US)", "Teknologi", "Halvledere", "US"),
    _e("CIBR", "First Trust NASDAQ Cybersecurity ETF", "Cybersikkerhet (US)", "Teknologi", "Cybersikkerhet", "US"),
    _e("BOTZ", "Global X Robotics & AI ETF", "Robotikk & AI (US)", "Teknologi", "Robotikk & automasjon", "US"),
    _e("SKYY", "First Trust Cloud Computing ETF", "Sky & programvare (US)", "Teknologi", "Programvare", "US"),
    # Energi
    _e("XLE", "Energy Select Sector SPDR Fund", "Energi (US)", "Energi", "Bred energi", "US"),
    _e("XOP", "SPDR S&P Oil & Gas E&P ETF", "Olje & gass E&P (US)", "Energi", "Olje & gass", "US"),
    _e("URA", "Global X Uranium ETF", "Uran (US)", "Energi", "Kjernekraft", "US"),
    _e("ICLN", "iShares Global Clean Energy ETF", "Ren energi (US)", "Energi", "Fornybar", "US"),
    _e("TAN", "Invesco Solar ETF", "Solenergi (US)", "Energi", "Fornybar", "US"),
    # Helse
    _e("XLV", "Health Care Select Sector SPDR Fund", "Helse (US)", "Helse", "Bred helse", "US"),
    _e("XBI", "SPDR S&P Biotech ETF", "Bioteknologi (US)", "Helse", "Bioteknologi", "US"),
    _e("IHI", "iShares U.S. Medical Devices ETF", "Medisinsk utstyr (US)", "Helse", "Medisinsk utstyr", "US"),
    _e("XPH", "SPDR S&P Pharmaceuticals ETF", "Legemidler (US)", "Helse", "Legemidler", "US"),
    # Finans
    _e("XLF", "Financial Select Sector SPDR Fund", "Finans (US)", "Finans", "Bred finans", "US"),
    _e("KBE", "SPDR S&P Bank ETF", "Banker (US)", "Finans", "Banker", "US"),
    _e("IAK", "iShares U.S. Insurance ETF", "Forsikring (US)", "Finans", "Forsikring", "US"),
    # Industri
    _e("XLI", "Industrial Select Sector SPDR Fund", "Industri (US)", "Industri", "Bred industri", "US"),
    _e("ITA", "iShares U.S. Aerospace & Defense ETF", "Forsvar (US)", "Industri", "Forsvar & luftfart", "US"),
    _e("PAVE", "Global X U.S. Infrastructure Development ETF", "Infrastruktur (US)", "Industri", "Infrastruktur", "US"),
    _e("JETS", "U.S. Global Jets ETF", "Flyselskaper (US)", "Industri", "Reise & luftfart", "US"),
    # Forbruk
    _e("XLY", "Consumer Discretionary Select Sector SPDR Fund", "Syklisk forbruk (US)", "Forbruk", "Syklisk forbruk", "US"),
    _e("XLP", "Consumer Staples Select Sector SPDR Fund", "Konsumvarer (US)", "Forbruk", "Defensivt forbruk", "US"),
    _e("XRT", "SPDR S&P Retail ETF", "Detaljhandel (US)", "Forbruk", "Detaljhandel", "US"),
    # Materialer
    _e("XLB", "Materials Select Sector SPDR Fund", "Materialer (US)", "Materialer", "Bred materialer", "US"),
    _e("XME", "SPDR S&P Metals & Mining ETF", "Metaller & gruver (US)", "Materialer", "Gruvedrift", "US"),
    # Råvarer
    _e("GLD", "SPDR Gold Shares", "Gull (US)", "Råvarer", "Gull", "US"),
    _e("SLV", "iShares Silver Trust", "Sølv (US)", "Råvarer", "Sølv", "US"),
    _e("COPX", "Global X Copper Miners ETF", "Kobbergruver (US)", "Råvarer", "Kobber", "US"),
    _e("REMX", "VanEck Rare Earth/Strategic Metals ETF", "Sjeldne jordarter (US)", "Råvarer", "Strategiske metaller", "US"),
    _e("LIT", "Global X Lithium & Battery Tech ETF", "Litium & batteri (US)", "Råvarer", "Litium & batteri", "US"),
    _e("DBA", "Invesco DB Agriculture Fund", "Landbruk (US)", "Råvarer", "Landbruk", "US"),
    # Forsyning
    _e("XLU", "Utilities Select Sector SPDR Fund", "Forsyning (US)", "Forsyning", "Bred forsyning", "US"),
    _e("PHO", "Invesco Water Resources ETF", "Vann (US)", "Forsyning", "Vann", "US"),
    # Eiendom
    _e("VNQ", "Vanguard Real Estate ETF", "Eiendom (US)", "Eiendom", "REITs", "US"),
    # Kommunikasjon
    _e("XLC", "Communication Services Select Sector SPDR Fund", "Kommunikasjon (US)", "Kommunikasjon", "Bred kommunikasjon", "US"),
    # Obligasjoner
    _e("TLT", "iShares 20+ Year Treasury Bond ETF", "US statsobl. 20+ år", "Obligasjoner", "Lang rente", "US"),
    _e("AGG", "iShares Core U.S. Aggregate Bond ETF", "US obligasjoner", "Obligasjoner", "Aggregat", "US"),
]

ETFS = UCITS + US

# Referanseindeks for beta/korrelasjon og relativ styrke (omregnet til NOK)
BENCHMARK = "ACWI"

# Markedsstripe øverst i dashbordet
MARKET_TICKERS = [
    ("^GSPC", "S&P 500"),
    ("^IXIC", "Nasdaq"),
    ("^STOXX", "STOXX 600"),
    ("OSEBX.OL", "Oslo Børs (OSEBX)"),
    ("^N225", "Nikkei 225"),
    ("^VIX", "VIX"),
    ("^TNX", "US 10 år rente"),
    ("BZ=F", "Brent"),
    ("GC=F", "Gull"),
    ("BTC-USD", "Bitcoin"),
]

FX_TICKERS = {"USD": "USDNOK=X", "EUR": "EURNOK=X", "GBP": "GBPNOK=X"}

# Google News-søk per sektor (engelsk gir best dekning av globale markeder)
NEWS_QUERIES = {
    "Marked":         '"stock market" OR "global markets" OR "Federal Reserve" OR "ECB"',
    "Norge":          '"Oslo Børs" OR "Norges Bank" OR kronekursen OR OSEBX OR "rentebeslutning"',
    "Brede indekser": '"S&P 500" OR "MSCI World" OR "equity markets" outlook',
    "Teknologi":      'semiconductor OR "artificial intelligence" stocks OR Nvidia OR "tech stocks"',
    "Energi":         '"oil price" OR OPEC OR "natural gas" OR uranium OR "clean energy" stocks',
    "Helse":          'pharma OR biotech OR "FDA approval" OR "healthcare stocks"',
    "Finans":         '"bank stocks" OR "interest rates" banks OR "financial sector"',
    "Industri":       '"defense spending" OR "defence stocks" OR "industrial stocks" OR infrastructure',
    "Forbruk":        '"consumer spending" OR retail sales OR "luxury stocks"',
    "Materialer":     'mining stocks OR "iron ore" OR "chemical stocks"',
    "Råvarer":        '"gold price" OR "silver price" OR "copper price" OR lithium OR "rare earths"',
    "Forsyning":      '"utility stocks" OR "power grid" OR "electricity prices"',
    "Eiendom":        'REIT OR "commercial real estate" OR "property market"',
    "Kommunikasjon":  '"communication services" OR Alphabet OR Meta OR telecom stocks',
    "Obligasjoner":   '"bond yields" OR "treasury yields" OR "bond market"',
}

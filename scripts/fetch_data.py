"""
Henter markedsdata fra Yahoo Finance og nyheter fra Google News, beregner nøkkeltall
og skriver alt som statiske JSON-filer som nettsiden leser.

Kjøres automatisk av GitHub Actions hver handelsdag, eller lokalt:
    python scripts/fetch_data.py            # skriver til public/data
    python scripts/fetch_data.py --out dist/data

Filer som lages:
    meta.json          tidspunkt, antall ETF-er, feil
    snapshot.json      alle ETF-er med avkastning, trend, verdsettelse, risiko og signaler
    history/<t>.json   daglige (justerte) sluttkurser per ETF, full historikk
    fx.json            USD/EUR/GBP mot NOK, daglig
    market.json        markedsstripe (indekser, rente, olje, gull, VIX …)
    correlation.json   korrelasjonsmatrise (ukentlige NOK-avkastninger, 2 år)
    news.json          siste nyheter per sektor (Google News RSS)
"""
import argparse
import datetime as dt
import email.utils
import json
import math
import os
import sys
import time
import urllib.parse
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pandas as pd
import requests
import yfinance as yf

sys.path.insert(0, os.path.dirname(__file__))
from universe import BENCHMARK, ETFS, FX_TICKERS, MARKET_TICKERS, NEWS_QUERIES  # noqa: E402

TRADING_DAYS = 252
PROFILES = {
    # id: (vekt verdsettelse, vekt trend)
    "value": (0.70, 0.30),
    "balanced": (0.50, 0.50),
    "momentum": (0.30, 0.70),
}
BUY_AT, SELL_BELOW = 60, 40

FAILURES: list[str] = []


def log(msg: str) -> None:
    print(f"[{dt.datetime.now():%H:%M:%S}] {msg}", flush=True)


# ── Hjelpere ──────────────────────────────────────────────────────────────────

def clean(obj):
    """Gjør numpy/NaN om til JSON-vennlige verdier."""
    if isinstance(obj, dict):
        return {k: clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [clean(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        v = float(obj)
        return None if math.isnan(v) or math.isinf(v) else v
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    return obj


def r(v, n=2):
    if v is None:
        return None
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(v) or math.isinf(v) else round(v, n)


def write_json(path: str, data) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(clean(data), f, ensure_ascii=False, separators=(",", ":"))


def safe_name(ticker: str) -> str:
    return ticker.replace("^", "_").replace("=", "_").replace("/", "_")


def to_daily(s: pd.Series) -> pd.Series:
    s = s.dropna()
    s = s[s > 0]
    idx = pd.to_datetime([d.date() if hasattr(d, "date") else d for d in s.index])
    s = pd.Series(s.values.astype(float), index=idx)
    return s[~s.index.duplicated(keep="last")].sort_index()


# ── Nedlasting ────────────────────────────────────────────────────────────────

def download_closes(tickers: list[str], period: str = "max", chunk: int = 15) -> dict[str, pd.Series]:
    out: dict[str, pd.Series] = {}
    for i in range(0, len(tickers), chunk):
        part = tickers[i:i + chunk]
        for attempt in range(3):
            try:
                df = yf.download(part, period=period, auto_adjust=True, progress=False,
                                 group_by="ticker", threads=True)
                break
            except Exception as exc:  # nettverksfeil / rate limit
                log(f"  nedlasting feilet ({exc}), prøver igjen …")
                time.sleep(5 * (attempt + 1))
        else:
            continue
        for t in part:
            try:
                s = df[t]["Close"] if isinstance(df.columns, pd.MultiIndex) else df["Close"]
                s = to_daily(s)
                if len(s) >= 5:
                    out[t] = s
            except Exception:
                pass
        time.sleep(1)

    # Enkeltvis nytt forsøk for tickere som mangler
    for t in [t for t in tickers if t not in out]:
        try:
            s = to_daily(yf.Ticker(t).history(period=period, auto_adjust=True)["Close"])
            if len(s) >= 5:
                out[t] = s
        except Exception:
            pass
        if t not in out:
            FAILURES.append(f"Ingen kursdata for {t}")
    return out


def fetch_info(ticker: str) -> dict:
    for attempt in range(2):
        try:
            return yf.Ticker(ticker).info or {}
        except Exception:
            time.sleep(2)
    return {}


# ── Beregninger ───────────────────────────────────────────────────────────────

def ret_since(s: pd.Series, days: int):
    if len(s) < 2:
        return None
    cutoff = s.index[-1] - pd.Timedelta(days=days)
    past = s[s.index <= cutoff]
    if past.empty:
        return None
    return (s.iloc[-1] / past.iloc[-1] - 1) * 100


def ann_ret_since(s: pd.Series, years: int):
    tot = ret_since(s, int(365.25 * years))
    if tot is None:
        return None
    return ((1 + tot / 100) ** (1 / years) - 1) * 100


def ytd(s: pd.Series):
    last = s.index[-1]
    prev = s[s.index < pd.Timestamp(year=last.year, month=1, day=1)]
    if prev.empty:
        return None
    return (s.iloc[-1] / prev.iloc[-1] - 1) * 100


def returns_block(s: pd.Series) -> dict:
    return {
        "1D": r((s.iloc[-1] / s.iloc[-2] - 1) * 100) if len(s) > 1 else None,
        "1W": r(ret_since(s, 7)),
        "1M": r(ret_since(s, 30)),
        "3M": r(ret_since(s, 91)),
        "6M": r(ret_since(s, 182)),
        "YTD": r(ytd(s)),
        "1Y": r(ret_since(s, 365)),
        "3Y": r(ann_ret_since(s, 3)),   # annualisert
        "5Y": r(ann_ret_since(s, 5)),   # annualisert
    }


def rsi(s: pd.Series, period: int = 14):
    if len(s) < period + 2:
        return None
    d = s.diff().dropna()
    gain = d.clip(lower=0).ewm(alpha=1 / period, min_periods=period).mean().iloc[-1]
    loss = (-d).clip(lower=0).ewm(alpha=1 / period, min_periods=period).mean().iloc[-1]
    if loss == 0:
        return 100.0
    return 100 - 100 / (1 + gain / loss)


def max_drawdown(s: pd.Series):
    if len(s) < 2:
        return None
    return float((s / s.cummax() - 1).min() * 100)


def trend_block(s: pd.Series) -> dict:
    last = float(s.iloc[-1])
    ma50 = float(s.tail(50).mean()) if len(s) >= 50 else None
    ma200 = float(s.tail(200).mean()) if len(s) >= 200 else None

    slope_m, r2 = None, None
    win = s.tail(63)
    if len(win) >= 30:
        y = np.log(win.values)
        x = np.arange(len(y))
        b, a = np.polyfit(x, y, 1)
        fit = a + b * x
        ss_res = float(((y - fit) ** 2).sum())
        ss_tot = float(((y - y.mean()) ** 2).sum()) or 1e-12
        slope_m = (math.exp(b * 21) - 1) * 100       # % per måned
        r2 = 1 - ss_res / ss_tot

    checks = [
        ma50 is not None and last > ma50,
        ma200 is not None and last > ma200,
        ma50 is not None and ma200 is not None and ma50 > ma200,
        slope_m is not None and slope_m > 0,
    ]
    known = sum(x is not None for x in (ma50, ma200, slope_m)) > 0
    ups = sum(checks)
    if not known:
        label = "ukjent"
    elif ups == 4:
        label = "sterk opp"
    elif ups == 3:
        label = "opp"
    elif ups == 0:
        label = "sterk ned"
    elif ups == 1:
        label = "ned"
    else:
        label = "sidelengs"

    mom_12_1 = None
    if len(s) > TRADING_DAYS:
        mom_12_1 = (s.iloc[-22] / s.iloc[-TRADING_DAYS] - 1) * 100

    y1 = s[s.index > s.index[-1] - pd.Timedelta(days=365)]
    hi52, lo52 = float(y1.max()), float(y1.min())
    return {
        "label": label,
        "ma50": r(ma50, 4),
        "ma200": r(ma200, 4),
        "above_ma50": None if ma50 is None else last > ma50,
        "above_ma200": None if ma200 is None else last > ma200,
        "golden_cross": None if (ma50 is None or ma200 is None) else ma50 > ma200,
        "dist_ma200": r((last / ma200 - 1) * 100) if ma200 else None,
        "slope_month": r(slope_m),
        "r2": r(r2),
        "rsi": r(rsi(s), 1),
        "mom_12_1": r(mom_12_1),
        "high_52w": r(hi52, 4),
        "low_52w": r(lo52, 4),
        "from_high_52w": r((last / hi52 - 1) * 100),
        "from_ath": r((last / float(s.max()) - 1) * 100),
    }


VAL_WINDOWS = {"Maks": None, "10Y": 3652, "5Y": 1826, "3Y": 1095, "1Y": 365, "6M": 182, "3M": 91}


def pct_label(p):
    if p is None:
        return None
    return "Billig" if p <= 25 else "Dyr" if p >= 75 else "Normal"


def valuation_block(s: pd.Series) -> dict:
    """
    To mål for «billig/dyr» basert på kurshistorikk (ETF-er har ikke fri historisk P/E):
      1. Prisprosentil: hvor dagens kurs ligger i kursfordelingen i hvert vindu.
      2. Trendjustert: hvor langt kursen er fra sin egen langsiktige (log-lineære) trend,
         sammenlignet med historiske avvik. Straffer ikke ETF-er som bare har steget jevnt.
    """
    last = float(s.iloc[-1])
    out = {"windows": {}}
    for name, days in VAL_WINDOWS.items():
        w = s if days is None else s[s.index >= s.index[-1] - pd.Timedelta(days=days)]
        if len(w) < 20:
            continue
        arr = w.values
        p = float((arr <= last).mean() * 100)
        out["windows"][name] = {"pct": r(p, 1), "label": pct_label(p), "min": r(arr.min(), 4), "max": r(arr.max(), 4)}

    detr = None
    w = s[s.index >= s.index[-1] - pd.Timedelta(days=1826)]
    if len(w) >= 500:
        y = np.log(w.values)
        x = np.arange(len(y))
        b, a = np.polyfit(x, y, 1)
        resid = y - (a + b * x)
        detr = float((resid <= resid[-1]).mean() * 100)
        out["trend_dev"] = r((math.exp(resid[-1]) - 1) * 100)   # % over/under trendlinjen
        out["trend_cagr"] = r((math.exp(b * TRADING_DAYS) - 1) * 100)
    out["detrended_pct"] = r(detr, 1)
    out["detrended_label"] = pct_label(detr)
    return out


def risk_block(nok: pd.Series, bench_w: pd.Series | None) -> dict:
    d = np.log(nok).diff().dropna()
    d1 = d.tail(TRADING_DAYS)
    out = {}
    if len(d1) >= 120:
        vol = float(d1.std() * math.sqrt(TRADING_DAYS))
        ret1 = ret_since(nok, 365)
        downside = d1[d1 < 0]
        dvol = float(downside.std() * math.sqrt(TRADING_DAYS)) if len(downside) > 5 else None
        out["vol_1y"] = r(vol * 100)
        out["sharpe_1y"] = r((ret1 / 100) / vol if ret1 is not None and vol else None)
        out["sortino_1y"] = r((ret1 / 100) / dvol if ret1 is not None and dvol else None)
    d3 = d.tail(TRADING_DAYS * 3)
    if len(d3) >= TRADING_DAYS * 2.5:
        vol3 = float(d3.std() * math.sqrt(TRADING_DAYS))
        ann3 = ann_ret_since(nok, 3)
        out["vol_3y"] = r(vol3 * 100)
        out["sharpe_3y"] = r((ann3 / 100) / vol3 if ann3 is not None and vol3 else None)

    for label, days in (("1y", 365), ("3y", 1095), ("5y", 1826)):
        w = nok[nok.index >= nok.index[-1] - pd.Timedelta(days=days)]
        if len(w) > 60:
            out[f"maxdd_{label}"] = r(max_drawdown(w))

    # Daglig Value-at-Risk (historisk, 95 %) siste år
    if len(d1) >= 120:
        out["var95_1d"] = r((math.exp(float(np.percentile(d1, 5))) - 1) * 100)

    if bench_w is not None:
        w = weekly_returns(nok).tail(104)
        j = pd.concat([w, bench_w], axis=1, join="inner").dropna()
        if len(j) >= 40:
            cov = np.cov(j.iloc[:, 0], j.iloc[:, 1])
            out["beta"] = r(cov[0, 1] / cov[1, 1])
            out["corr_bench"] = r(float(j.iloc[:, 0].corr(j.iloc[:, 1])))
    return out


def weekly_returns(s: pd.Series) -> pd.Series:
    return s.resample("W-FRI").last().pct_change().dropna()


def to_nok(s: pd.Series, currency: str, fx: dict[str, pd.Series]) -> pd.Series:
    if currency == "NOK":
        return s
    rate = fx.get(currency)
    if rate is None:
        return s
    aligned = rate.reindex(rate.index.union(s.index)).ffill().bfill().reindex(s.index)
    return s * aligned


# ── Signalmodell ──────────────────────────────────────────────────────────────

def nf(v, spec: str) -> str:
    """Norsk tallformat i forklaringstekster (desimalkomma)."""
    return format(v, spec).replace(".", ",").replace("-", "−")


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def val_score(val: dict) -> tuple[float, list]:
    """0–100, høyt = billig. Kombinerer trendjustert verdsettelse og prisprosentiler."""
    parts, notes = [], []
    if val.get("detrended_pct") is not None:
        parts.append((0.6, val["detrended_pct"]))
        notes.append(f"Trendjustert prosentil {nf(val['detrended_pct'], '.0f')}")
    for win, wgt in (("1Y", 0.2), ("3Y", 0.2)):
        e = val["windows"].get(win)
        if e:
            parts.append((wgt, e["pct"]))
            notes.append(f"Prisprosentil {win} {nf(e['pct'], '.0f')}")
    if not parts:
        return 50.0, ["Ikke nok historikk – nøytral"]
    tot = sum(w for w, _ in parts)
    pct = sum(w * p for w, p in parts) / tot
    return round(100 - pct, 1), notes


def trend_score(t: dict, rel_3m) -> tuple[float, list]:
    s, notes = 50.0, []

    def add(points, text):
        nonlocal s
        s += points
        notes.append(f"{text} ({nf(points, '+.0f')})")

    if t["above_ma50"] is not None:
        add(8 if t["above_ma50"] else -8, "Over 50-dagers snitt" if t["above_ma50"] else "Under 50-dagers snitt")
    if t["above_ma200"] is not None:
        add(10 if t["above_ma200"] else -10, "Over 200-dagers snitt" if t["above_ma200"] else "Under 200-dagers snitt")
    if t["golden_cross"] is not None:
        add(6 if t["golden_cross"] else -6, "MA50 over MA200" if t["golden_cross"] else "MA50 under MA200")
    if t["slope_month"] is not None:
        add(clamp(t["slope_month"] * 4, -12, 12), f"3M trendhelning {nf(t['slope_month'], '+.1f')} %/mnd")
    m = t["mom_12_1"]
    if m is not None:
        pts = 10 if m > 20 else 5 if m > 8 else -10 if m < -15 else -5 if m < -5 else 0
        if pts:
            add(pts, f"12–1 mnd momentum {nf(m, '+.0f')} %")
    rv = t["rsi"]
    if rv is not None:
        if rv > 75:
            add(-8, f"RSI {nf(rv, '.0f')} – overkjøpt")
        elif rv < 30:
            add(5, f"RSI {nf(rv, '.0f')} – oversolgt")
        elif 45 <= rv <= 65:
            add(4, f"RSI {nf(rv, '.0f')} – sunt momentum")
    if rel_3m is not None:
        pts = round(clamp(rel_3m * 0.5, -8, 8))
        if pts:
            add(pts, f"Relativ styrke vs. ACWI 3M {nf(rel_3m, '+.1f')} pp")
    return round(clamp(s, 0, 100), 1), notes


def fund_adj(pe) -> tuple[float, str | None]:
    if pe is None or not (0 < pe < 200):
        return 0.0, None
    if pe < 14:
        return 6.0, f"Lav P/E {nf(pe, '.1f')}"
    if pe < 20:
        return 2.0, f"Moderat P/E {nf(pe, '.1f')}"
    if pe < 30:
        return -2.0, f"Høy P/E {nf(pe, '.1f')}"
    return -6.0, f"Svært høy P/E {nf(pe, '.1f')}"


def signal_of(score: float) -> str:
    return "BUY" if score >= BUY_AT else "SELL" if score < SELL_BELOW else "HOLD"


# ── Nyheter ───────────────────────────────────────────────────────────────────

def google_news(query: str, norwegian: bool = False, days: int = 4, limit: int = 12) -> list[dict]:
    q = urllib.parse.quote(f"{query} when:{days}d")
    if norwegian:
        url = f"https://news.google.com/rss/search?q={q}&hl=no&gl=NO&ceid=NO:no"
    else:
        url = f"https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"
    try:
        resp = requests.get(url, timeout=12, headers={"User-Agent": "Mozilla/5.0 (ETF-dashboard)"})
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
    except Exception as exc:
        FAILURES.append(f"Nyheter ({query[:30]}…): {exc}")
        return []
    items = []
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        src_el = it.find("source")
        source = src_el.text.strip() if src_el is not None and src_el.text else ""
        if source and title.endswith(f" - {source}"):
            title = title[: -len(source) - 3]
        pub = it.findtext("pubDate") or ""
        try:
            ts = email.utils.parsedate_to_datetime(pub).astimezone(dt.timezone.utc).isoformat()
        except Exception:
            ts = None
        items.append({"title": title, "url": it.findtext("link"), "source": source, "published": ts})
    items.sort(key=lambda a: a["published"] or "", reverse=True)
    seen, out = set(), []
    for a in items:
        sig = a["title"][:60].lower()
        if sig in seen:
            continue
        seen.add(sig)
        out.append(a)
        if len(out) >= limit:
            break
    return out


# ── Hovedløp ──────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument("--out", default=os.path.join(root, "public", "data"))
    ap.add_argument("--skip-news", action="store_true")
    args = ap.parse_args()
    out = args.out
    t0 = time.time()

    tickers = [e["ticker"] for e in ETFS]
    log(f"Henter kurshistorikk for {len(tickers)} ETF-er …")
    closes = download_closes(tickers)
    log(f"  fikk data for {len(closes)}/{len(tickers)}")

    log("Henter valutakurser …")
    fx_raw = download_closes(list(FX_TICKERS.values()))
    fx = {cur: fx_raw[t] for cur, t in FX_TICKERS.items() if t in fx_raw}

    log("Henter fondsinformasjon (TER, størrelse, valuta) …")
    with ThreadPoolExecutor(max_workers=6) as ex:
        infos = dict(zip(tickers, ex.map(fetch_info, tickers)))

    # Valuta og pence-korrigering
    currencies = {}
    for t in closes:
        cur = infos.get(t, {}).get("currency")
        if not cur:
            cur = "EUR" if t.endswith(".DE") else "USD" if "." not in t else "GBP"
        if cur == "GBp":
            closes[t] = closes[t] / 100
            cur = "GBP"
        currencies[t] = cur

    nok_series = {t: to_nok(s, currencies[t], fx) for t, s in closes.items()}
    bench_nok = nok_series.get(BENCHMARK)
    bench_w = weekly_returns(bench_nok).tail(104) if bench_nok is not None else None
    bench_ret_3m = ret_since(bench_nok, 91) if bench_nok is not None else None

    log("Beregner nøkkeltall og signaler …")
    rows = []
    for e in ETFS:
        t = e["ticker"]
        if t not in closes:
            continue
        s, nok = closes[t], nok_series[t]
        info = infos.get(t, {})
        last_date = s.index[-1]

        tr = trend_block(s)
        val = valuation_block(s)
        risk = risk_block(nok, bench_w if t != BENCHMARK else None)
        ret_local, ret_nok = returns_block(s), returns_block(nok)
        rel_3m = None
        if ret_nok["3M"] is not None and bench_ret_3m is not None:
            rel_3m = ret_nok["3M"] - bench_ret_3m

        pe = info.get("trailingPE")
        ter = info.get("netExpenseRatio") or info.get("annualReportExpenseRatio")
        vs, v_notes = val_score(val)
        ts, t_notes = trend_score(tr, rel_3m)
        fa, fa_note = fund_adj(pe)
        profiles = {}
        for pid, (vw, tw) in PROFILES.items():
            sc = round(clamp(vs * vw + ts * tw + fa, 0, 100), 1)
            profiles[pid] = {"score": sc, "signal": signal_of(sc)}

        inception = info.get("fundInceptionDate")
        rows.append({
            **{k: v for k, v in e.items() if k != "keywords"},
            "currency": currencies[t],
            "price": r(s.iloc[-1], 4),
            "price_nok": r(nok.iloc[-1], 2),
            "date": last_date.strftime("%Y-%m-%d"),
            "history_start": s.index[0].strftime("%Y-%m-%d"),
            "ret": ret_local,
            "ret_nok": ret_nok,
            "rel_3m": r(rel_3m),
            "spark": [r(v, 4) for v in s.tail(63).values],
            "trend": tr,
            "valuation": val,
            "risk": risk,
            "fund": {
                "ter": r(ter, 3),
                "aum": info.get("totalAssets"),
                "yield": r((info.get("yield") or 0) * 100, 2) if info.get("yield") is not None else None,
                "pe": r(pe, 1),
                "pb": r(info.get("priceToBook"), 2),
                "family": info.get("fundFamily"),
                "category": info.get("category"),
                "inception": dt.datetime.fromtimestamp(inception, dt.timezone.utc).strftime("%Y-%m-%d") if inception else None,
                "long_name": info.get("longName"),
            },
            "scores": {
                "val": vs, "trend": ts, "fund_adj": fa,
                "val_notes": v_notes, "trend_notes": t_notes,
                "fund_note": fa_note,
                "profiles": profiles,
            },
        })

        write_json(os.path.join(out, "history", f"{safe_name(t)}.json"), {
            "t": t, "cur": currencies[t],
            "d": [d.strftime("%Y-%m-%d") for d in s.index],
            "c": [r(v, 4) for v in s.values],
        })

    write_json(os.path.join(out, "snapshot.json"), {"etfs": rows, "benchmark": BENCHMARK,
                                                    "thresholds": {"buy": BUY_AT, "sell": SELL_BELOW}})
    write_json(os.path.join(out, "fx.json"), {
        cur: {"d": [d.strftime("%Y-%m-%d") for d in s.index], "c": [r(v, 5) for v in s.values]}
        for cur, s in fx.items()
    })

    log("Beregner korrelasjoner …")
    weekly = pd.DataFrame({t: weekly_returns(s) for t, s in nok_series.items()}).tail(104)
    corr = weekly.corr(min_periods=40)
    order = [e["ticker"] for e in ETFS if e["ticker"] in corr.columns]
    corr = corr.loc[order, order]
    write_json(os.path.join(out, "correlation.json"), {
        "tickers": order,
        "window": "104 uker, ukentlige avkastninger i NOK",
        "m": [[r(v, 2) for v in row] for row in corr.values],
    })

    log("Henter markedsstripe …")
    mk = download_closes([t for t, _ in MARKET_TICKERS], period="2y")
    market = []
    for t, name in MARKET_TICKERS:
        if t not in mk:
            continue
        s = mk[t]
        market.append({
            "ticker": t, "name": name, "price": r(s.iloc[-1], 2), "date": s.index[-1].strftime("%Y-%m-%d"),
            "ret": {k: v for k, v in returns_block(s).items() if k in ("1D", "1W", "1M", "YTD", "1Y")},
            "spark": [r(v, 3) for v in s.tail(63).values],
        })
    for cur, s in fx.items():
        market.append({
            "ticker": FX_TICKERS[cur], "name": f"{cur}/NOK", "price": r(s.iloc[-1], 3),
            "date": s.index[-1].strftime("%Y-%m-%d"),
            "ret": {k: v for k, v in returns_block(s).items() if k in ("1D", "1W", "1M", "YTD", "1Y")},
            "spark": [r(v, 4) for v in s.tail(63).values],
        })
    write_json(os.path.join(out, "market.json"), market)

    if not args.skip_news:
        log("Henter nyheter fra Google News …")
        with ThreadPoolExecutor(max_workers=5) as ex:
            res = ex.map(lambda kv: (kv[0], google_news(kv[1], norwegian=kv[0] == "Norge")), NEWS_QUERIES.items())
            news = dict(res)
        write_json(os.path.join(out, "news.json"), news)

    write_json(os.path.join(out, "meta.json"), {
        "generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "n_etfs": len(rows),
        "n_ucits": sum(1 for x in rows if x["region"] == "UCITS"),
        "n_us": sum(1 for x in rows if x["region"] == "US"),
        "failures": FAILURES,
        "seconds": round(time.time() - t0),
    })
    log(f"Ferdig på {time.time() - t0:.0f} s. {len(rows)} ETF-er, {len(FAILURES)} advarsler.")
    for f in FAILURES:
        log(f"  ! {f}")


if __name__ == "__main__":
    main()

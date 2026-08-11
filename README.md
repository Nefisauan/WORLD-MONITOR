# WORLD INTEL

An AI-powered global market intelligence terminal. Not a news dashboard — a
reasoning pipeline: **SIGNAL → EVENT → INTERPRETATION → MARKET IMPACT →
SCENARIOS → PROBABILITIES → HISTORICAL ANALOGUES**.

![stack](https://img.shields.io/badge/stack-TypeScript%20%C2%B7%20React%20%C2%B7%20Fastify-blue)

## Quick start

```bash
npm install
npm run dev        # server on :8787, web on :5173
```

Open http://localhost:5173. Works immediately with zero API keys.

## What it does

- **Global markets board** — 55 instruments (indices, rates, FX, crypto,
  commodities, credit, sectors) with 1D/5D/1M/YTD returns, realized vol, and
  **z-score anomaly detection** against each instrument's trailing 1-year
  daily-return distribution (e.g. `Bovespa −2.5% · 2.4σ`).
- **What Matters Now** — news from 12 curated feeds is deduplicated into
  event clusters, classified against a 16-category taxonomy, and ranked by a
  decomposed 0–100 market impact score (category prior + corroboration +
  magnitude keywords + source tier + scope − recency decay).
- **Event dossiers** — every event opens into: impact decomposition, asset
  exposure map, causal **transmission chain** (event → commodity → industry →
  macro → policy → markets), and **historical analogues** with documented
  "what happened next" outcomes (1973 oil embargo → 2023 SVB).
- **Probability engine** — tracked questions (recession, oil disruption,
  Hormuz closure, VIX>30, corrections, bank stress…) each start from a
  documented historical base rate and apply transparent log-odds adjustments
  from live signals. Shown side-by-side with **Polymarket** pricing; the
  divergence is the **mispricing radar**.
- **Regime classifier** — Risk-On / Risk-Off / Inflationary / Stagflationary /
  Stress / Crisis from VIX, curve slope, gold-vs-equities, commodity impulse,
  HY-vs-IG credit, USD trend, breadth. Every input shown.
- **Global intelligence map** — GDELT conflict/protest/energy/sanctions
  signals, USGS earthquakes, 7 maritime chokepoints, country-risk rings.
  Click a country for its dossier (risk decomposition + what markets care
  about + live events).
- **Why is it moving?** — click any asset for ranked move attribution
  (event flow / group move / market beta / idiosyncratic) plus correlated
  movers. Explicitly labeled a model estimate.
- **Morning brief** — "what changed": movers, regime, top events, probability
  shifts, mispricings, today's catalysts, and *what could surprise the market*.
- **Event radar calendar** — FOMC / CPI / payrolls / ECB / PCE / OPEC dates
  with importance scores and typical historical reactions.
- **Watchlist** — persisted locally; the terminal surfaces which live events
  affect *your* instruments.
- **⌘K command palette** — `why btc`, `country china`, `brief`, or search any
  live event.

## Design principles

- **FACT / INFERENCE / FORECAST are visually separated** throughout the UI.
- **No fabricated data.** Key-gated sources (FRED macro) report themselves as
  unavailable rather than simulating values. Data health is tracked per source.
- **Deterministic first.** All scoring/probability/attribution engines are
  explainable rules + statistics. An LLM narration layer activates only when
  a key is configured, and it may only restate assembled live data.
- **Probabilities, not certainties.** Every forecast shows its base rate,
  drivers, and methodology.

## Data sources (live, keyless)

| Source | Data |
|---|---|
| Yahoo Finance | equities, rates, FX, commodities, credit ETFs |
| Binance | crypto |
| GDELT | geolocated global event signals |
| USGS | earthquakes |
| Polymarket | prediction-market probabilities |
| RSS (BBC, CNBC, WSJ, MarketWatch, Guardian, Al Jazeera, Fed, ECB, EIA) | news/event stream |

Optional keys (`server/.env`, see `server/.env.example`):

- `FRED_API_KEY` — unlocks the US macro layer (CPI, PCE, payrolls, Fed balance
  sheet, HY/IG OAS, TGA, RRP, NFCI…)
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` — LLM-narrated briefs
- `FINNHUB_API_KEY` — reserved for company-level expansion

## Architecture

```
server/  Fastify + TypeScript
  src/sources/     yahoo · binance · rss · gdelt · usgs · polymarket · fred
  src/knowledge/   instruments · event taxonomy · historical episodes ·
                   econ calendar · countries/chokepoints
  src/engines/     quotes+anomaly · events(cluster/classify/score) · regime ·
                   probability · risk/alerts · why(attribution) · brief · llm
  src/state.ts     poll loops + in-memory state + SSE notify
web/     Vite + React 19 + TypeScript
  src/components/  TopBar · MarketGrid · WhatMattersNow · EventDrawer ·
                   WorldMap (d3-geo canvas) · ProbabilityBoard · Watchlist ·
                   CalendarPanel · NewsWire · Alerts · WhyDrawer ·
                   CountryDrawer · BriefDrawer · CommandPalette
```

Updates stream over SSE (`/api/stream`); quotes refresh every 60s, news every
3m, map every 10m, probabilities every 5m.

## Disclaimers

All scores, probabilities, attributions, and analogues are model estimates for
research purposes — not investment advice. Historical outcome figures are
approximate documented moves (see `server/src/knowledge/history.ts`).

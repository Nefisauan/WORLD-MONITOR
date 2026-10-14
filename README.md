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
- **Probability research** — seven tracked questions expose reproducible legacy heuristic traces and source timestamps. Numeric forecasts are withheld because priors and adjustments lack supporting estimation and validation evidence. Related Polymarket quotes are unmatched context, not mispricing signals.
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
- **Morning brief** — movers, regime, top events, research availability, upcoming catalysts and unusual moves. Unsupported probability and mispricing analysis is explicitly unavailable.
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
- **Evidence before precision.** Unsupported numerical forecasts are withheld. Research heuristics show their methodology and limitations; no calibration or predictive accuracy is claimed.
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

## Development status and verification

Start with [the audit](WORLD_MONITOR_AUDIT.md), [roadmap](WORLD_MONITOR_ROADMAP.md), [architecture](WORLD_MONITOR_ARCHITECTURE.md) and [progress](WORLD_MONITOR_PROGRESS.md). Existing rule-based risk scores, attribution and historical analogues have substantial limitations; this is not a validated trading system.

Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint --workspace=web`. GitHub Actions runs these checks on pushes and pull requests. The read-only `/api/v1/probability-research` contract exposes research traces; `research.diagnosticValue` is an unvalidated formula output, not a supported forecast. No permanent forecast registry is implemented yet.

## Event history and runtime storage

Requires **Node 22.13+**. Event dossiers now include recorded evidence timelines backed by SQLite. Set `EVENT_DB_PATH` to an absolute path on a persistent hosting volume; the default is `server/.data/events.sqlite` when launched through npm workspaces. Runtime data is not stored in GitHub. The current Render free-service blueprint does not provide a persistent disk, so its default archive can be lost on redeployment. No paid storage has been provisioned.

This archive supports one application writer. Committed history survives process restarts when the database files are retained; backup/restore operations and hosted retention still need verification. See [architecture](WORLD_MONITOR_ARCHITECTURE.md) for storage limits and the versioned timeline API.

# World Monitor audit

Audited 2026-10-14 at baseline commit 8b81a49. This is a code and build audit, not certification of live feeds, forecasting performance, or deployed infrastructure.

## Current architecture

NPM workspaces: Fastify 5/TypeScript server and React 19/Vite 8/TypeScript client. One Node process polls external providers, derives analytics in memory, and broadcasts SSE update notifications; clients refetch the full snapshot. Production server serves web/dist. No database, queue, authentication, migrations, historical observation store, or agent framework. Only probability snapshots persist, in a mutable .cache JSON file capped at 500 records. Watchlists persist in browser localStorage. Render free-service blueprint and Node 22 Dockerfile exist; no verified deployment URL, deployment status, infrastructure credentials, or CI exists in the baseline. Quant Research Engine is not present in this repository; its interface is unknown.

## Completed functionality (implementation present; external operation unverified)

- Market grid, grouped tabs, 1D/5D/1M/YTD returns, sparklines, volatility, anomaly badges and asset drawers.
- RSS news wire, title-based classification, deduplication/clustering, impact decomposition, exposure chips, static causal chains and analogue drawers.
- Canvas world map with GDELT mentions, USGS quakes, seven fixed chokepoints and 22 country risk anchors/dossiers.
- Weighted cross-asset regime inference, global/country risk scores and alerts.
- Seven heuristic probability questions, optional Polymarket search and short-lived change snapshots.
- Static 2026 economic calendar, local watchlist/event relevance, keyboard command search and morning brief.
- Optional OpenAI/Anthropic narration; FRED macro API; config/health endpoints; SSE and client polling fallback.

## Partially completed functionality

The UI is connected to server state, but analytical validity is much weaker than its labels suggest. Probabilities use hand-set priors and log-odds coefficients without datasets, fitted likelihood ratios, uncertainty intervals or validation. Some prior definitions do not match the forecast target (recession occupancy versus onset). Polymarket keyword search takes the first binary result without matching horizon or resolution criteria. Absolute differences are therefore not evidence of mispricing. The initial snapshot is used as a 24h reference even before 24 hours elapsed.

Event IDs hash the selected headline and change when a better representative arrives; previous-cluster lookup has identical branches. Clustering is greedy token Jaccard >=0.45, not semantic entity resolution. Source counts may include related publications and are not independent verification. Credibility percentages are curated tier scores, and nullish-coalescing precedence prevents intended modifiers for known tiers. Exposure/transmission relationships are category templates without event-specific evidence. Analogue similarity uses tags and subjective magnitude, not conditional return research.

FRED has an API and frontend fetch helper but no macro panel. Finnhub is only a reserved environment/config flag. Attribution uses hand-weighted market, peer and event components, not regression; “correlated movers” share tags, not measured correlation. Missing moves become zero internally. Country priors are manually curated. Calendar dates and reaction figures are static and need source verification. Historical outcomes mix percentage returns, yield changes and levels in one movePct field, without underlying price observations or precise citations.

## Existing models and mathematics

- Returns: 100*(price/reference-1), implemented with absolute reference denominator. 5D/1M use indexed closes; YTD prior-year boundary. Volatility: sample standard deviation of last 30 daily returns times sqrt(252)*100, including crypto despite its different calendar. Z-score: (1D return - trailing mean)/sample standard deviation; current incomplete bars can contaminate reference samples.
- Event impact: 0.6*category prior + capped source count + strong keywords + tier + geography - age decay - uncategorized penalty, clipped to [0,100]. Credibility is not an estimated probability of truth.
- Analogue similarity: 0.8*tag Jaccard plus 0.2*magnitude affinity, capped to top four matches. Curated outcomes are approximate narrative examples, not a backtest.
- Probabilities: sigmoid(logit(baseRate)+sum(hand-set adjustments)), clipped to [0.01,0.97]. No calibrated Bayesian likelihood ratios or out-of-sample tests.
- Regime: manually weighted votes; confidence is winner vote share, not calibrated classification accuracy. Empty inputs select Risk-On by tie order.
- Country risk: 0.8*mean(curated priors)+25*relative news velocity. Global risk: baseline 30 plus clipped VIX/event/escalation/anomaly/regime adjustments.
- Attribution: normalized absolute index/group moves, tag-matched event weights and a residual floor. This is a hypothesis ranking, not measured causal attribution.

## Data reliability assessment

| Source | Use and refresh | Reliability limitations |
|---|---|---|
| Yahoo chart | Prices each 60s; daily history cached 1h | Unauthenticated endpoints, host fallback, delays and rate limits; no SLA/schema validation; failed live fetch may relabel historical close as current and not stale |
| Binance ticker/klines | Crypto each 60s; history 1h | Mirror fallback; 24h rolling return differs from exchange-session return; open candles and finite/timestamp validation gaps |
| 12 RSS feeds | Every 3m; pool 1,500; clusters 36h | Title-only interpretation, no source-independence check; missing publication date becomes now; invalid date can fail an entire feed |
| GDELT geo | Four themes every 10m, 24h mention window | Mentions are not confirmed incidents; all theme failures can still return successful empty data |
| USGS | Every 10m | Actual endpoint is M4.5+ past day despite source comment claiming seven days; robust external schema checks absent |
| Polymarket Gamma | Probability loop 5m; cache 10m | No exact contract matching; failure can reuse arbitrarily stale cache; no spread/liquidity/expiry validation |
| FRED | On request, cached 30m | Key required; revisions/vintages not tracked; not point-in-time-safe for backtests |
| Calendar/history/countries | Bundled static tables; calendar filtered every 6h | No automated updates, precise record-level citations or observation-backed research |

Shared fetch uses 12s timeout (provider overrides), one retry and 500ms delay; no Retry-After handling, rate budget or circuit breaker. Many errors are swallowed. Market health reports success for any nonempty quote set. Poll loops can overlap; startup waits on external fetches before listening. Client connection dot measures transport, not freshness.

## Missing functionality

Permanent immutable forecasts and resolutions; measured calibration/Brier/log loss; durable signal/event chronology; exact probability contracts; data lineage and publication/detection/observation timestamp separation; evidence-backed impact graph; historical point-in-time datasets and research queries; scenario distributions/sensitivity; transaction costs/liquidity/opportunity validation; structured verified AI extraction; Quant Research Engine integration; auth, operational telemetry, recovery and deployment verification.

## Technical debt, security and operational risks

Duplicated client/server types, no API versioning/schema validation, no automated baseline tests or CI. Root typecheck invokes a nonexistent frontend script. No retention/backups; filesystem cache is ephemeral on configured Render service. Open CORS and public expensive brief/macro endpoints can permit abuse; no auth/rate limits or LLM concurrency caps. Raw source headlines enter narration with only prompt instructions; no output evidence verifier and no LLM timeout. HTTP error messages include complete URLs, potentially exposing FRED API keys in returned errors. External links lack protocol allowlisting. No execution tools are granted to the narration model. Build has no observed secret inclusion; secret values were not inspected.

Frontend hides right column under 1280px, including probabilities/watchlist/calendar; some request failures remain indefinite loading. Five existing lint warnings. npm ci reports four high-severity dependency findings; the advisory report identified Fastify, fast-uri, brace-expansion and source-map-js. Compatible lockfile updates in this iteration remediate the reported findings (zero advisories after update); this is not a security certification. No claim that production is secure or feeds are healthy.

## Baseline validation

- npm ci --ignore-scripts: passed, four high-severity audit findings.
- npm run build: passed, server and frontend.
- npm run typecheck: failed; missing web typecheck script.
- npm test: failed; no test script/test suite.
- npm run lint --workspace=web: exit 0, five warnings (Panel fast-refresh exports and Sparkline unused expression).
- Live providers, browser interactions and deployed infrastructure: not verified by these commands.

## Recommended implementation sequence

1. Probability evidence contract and deterministic calculation trace; remove unsupported precision and invalid comparisons; establish regression tests/CI.
2. Ingestion provenance and freshness fixes, URL secret redaction, provider schema validation, exact resolution contracts.
3. Durable event IDs/chronology and immutable forecast registry with observation snapshots and authenticated resolution workflow.
4. Calibration/score dashboards backed by resolved, horizon-matched forecasts; no simulated performance.
5. Point-in-time historical research and exposure graph, then scenarios and opportunity evaluation.
6. Inspect the actual Quant Research Engine before integration; add AI extraction only with measurable benefit and verification.

Reuse existing UI, source adapters and deterministic engines. Do not rebuild the application.

## Remediation update — iteration 2

Fixed the historical-close-as-current fallback, missing/future quote timestamp substitution, stale history statistics, loss of a valid ticker when its sparkline fails, crypto annualization calendar, empty-input Risk-On classification, optimistic market completeness health, stale-quote consumption by current analytics, missing/invalid RSS publication dates, unsafe RSS links, and shared fetch URL/error-text credential exposure. RSS item rejection is now observable; publication and detection times are distinct. Other baseline findings remain open unless explicitly listed here. These changes are covered by deterministic ingestion failure tests; they do not certify provider availability or statistical model validity.

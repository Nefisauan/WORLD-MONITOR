# World Monitor architecture

## Current implementation

External Yahoo/Binance/RSS/GDELT/USGS/Polymarket adapters feed polling loops in server/src/state.ts. FRED is fetched on request. In-memory state supplies Fastify HTTP endpoints and SSE update notifications. React refetches /api/state and renders existing terminal panels. The optional LLM narrates a deterministic brief and has no trading or executable tool access. Node serves built React assets in production; Render and Docker definitions are configuration, not proof of a running deployment.

## Probability research contract (v1)

GET /api/v1/probability-research returns schemaVersion=1, purpose=unvalidated_research and estimates. The same estimates remain in /api/state for compatibility. The route is read-only. No write or resolution route is exposed.

Each estimate contains:

- question identity/category and estimation timestamp;
- evidence.status=insufficient_evidence, validation=not_evaluated, reason, null uncertainty interval, and unmatched-contract comparison status;
- null model, baseRate, predictionMarket, divergence and change24h fields so legacy consumers cannot treat unsupported numbers as forecasts;
- research.version=legacy-log-odds-v1, unverified prior claim and coefficient trace, diagnostic calculation output, detached input snapshot and optional related-market price.

The research diagnostic is not a statistical probability. It exists to reproduce and scrutinize the original formula. No promotion path is implemented: all seven legacy specifications lack the datasets and validation needed to publish forecasts. A future supported model must carry target definition, horizon, estimation dataset/version, observation cutoff, method version, estimation uncertainty and evaluation evidence. Prediction-market comparisons also need identical resolution contracts and current executable pricing/liquidity context.

Eligibility checks exclude quotes explicitly stale, non-finite, future-dated, or older than 72h; events must have finite scores in [0,100] and timestamps within the last 36h and no later than estimation. These are defensive ceilings, not exchange-calendar-aware freshness guarantees. Existing adapters can misstate timestamps; this remains a documented ingestion issue. Snapshots include every eligible quote/event considered, not a claim that every input contributed. Inputs and coefficients are copied before returning, preventing later live state mutations from changing the trace. History is not durably archived in this iteration.

The formula is sigmoid(logit(prior)+sum(adjustments)), clipped to [0.01,0.97]. Computation is deterministic given recorded inputs/coefficients. Eligibility and estimation accept an injected clock; market lookup can be injected for isolated tests. Related-market cache expires after ten minutes and failures return unavailable instead of expired observations. Related market values are indicative retrieved prices, not settlement-aligned probabilities.

## Interface and downstream behavior

ProbabilityBoard retains the terminal panel and accessible expandable question buttons. It displays abstention, missing validation/uncertainty, timestamps, unverified prior claims, log-odds contributions, quote provenance and unmatched-market context. Unsupported percentages and gap badges are removed. Morning briefs explicitly state that forecast and mispricing analysis are unavailable instead of reporting no opportunities.

## Validation and deployment

npm test runs Node test-runner unit, Fastify injection and React server-render tests through tsx (frontend JSX configuration). npm run typecheck checks both workspaces; npm run build produces server/dist and web/dist. CI runs these plus frontend lint on pushes and pull requests using Node 22. Local validation used Node 25.3.0; CI is the target-runtime check. Interactive browser behavior and provider availability require separate verification.

## Planned persistence boundary

No new database or storage service is introduced. Future managed persistence must capture raw observations, detection times, stable events, immutable forecast creation records and separate resolution/evaluation records. Forecasts must not be rewritten on resolution. Require migrations, uniqueness constraints, idempotent ingestion, backups, retention, authenticated writes and measured recovery before calling the registry production-ready. Do not store API secrets in provenance. Do not design the Quant Research Engine contract until its real implementation is inspected.

## Ingestion integrity (iteration 2)

Quotes now distinguish provider observation time (`asOf`) from application retrieval time (`retrievedAt`) and label `priceKind` as provider_quote or historical_fallback. Historical fallback keeps the timestamp of the provider's last usable bar and is always stale for current analytics; a daily bar timestamp describes the bar, not an exact trade time. Invalid/future/missing timestamps cannot be replaced with the current time. Invalid/unordered history observations are excluded; expired history cannot produce fresh-looking horizon statistics. `historyAsOf` and `historyStale` explain missing derived values. Crypto volatility uses 365 annual periods; other series retain 252. Incomplete-bar treatment and exchange-session-aware calendars remain future work.

A valid crypto ticker survives a failed sparkline request. Crypto observations older than 15 minutes are stale; other providers retain a conservative 72-hour ceiling to accommodate weekends. This ceiling is not proof of real-time exchange data. Regime/risk/alerts and briefs exclude flagged stale quotes; attribution is unavailable for those quotes. No-data regime classification returns null. Market health reports usable, stale/fallback and unavailable counts rather than accepting one successful instrument as a fully healthy board. The UI displays observation age, fallback/history labels and a data-health summary.

RSS publication and detection times are separate. Missing/invalid/future publication dates and unsafe/non-HTTP links are rejected per item; rejection totals feed health reporting. Publication time is never invented. First detection persists across repeated polls in the process; persistence across restarts still requires durable events. News expires even when a feed returns no new items. Malformed feed documents fail explicitly.

Shared JSON/text fetch errors expose only provider hostname and HTTP status (where available); raw URL paths, credentials, query strings, response bodies and transport exception text are not returned. No new secrets are stored. Provider-wide runtime schema validation, retries with Retry-After, circuit breakers and durable ingestion records remain unfinished.

# World Monitor roadmap

Updated 2026-10-14. Preserve the current application and visual identity. Sequence follows dependencies, not UI novelty.

| Priority | Capability | Value / complexity | Data and dependencies | Validation / completion criteria |
|---|---|---|---|---|
| 0 (this iteration) | Evidence-gated probability research | High integrity value; small | Existing heuristics and snapshots | Unsupported forecasts abstain; unmatched markets cannot create gaps; reproducible trace, API/UI regression tests |
| 1 | Ingestion provenance and operational safety | High; medium | Existing adapters; provider specifications | Separate event/publication/observation/detection times, validate schemas, expose partial failures, correct stale historical fallback, redact secret URLs, bound LLM/API usage; fake-clock/failure tests |
| 2 | Durable event and forecast records | Very high; medium-high | Managed DB + migrations/backups; stable event identity; explicit target/horizon/resolution contracts | Append-only creation and outcome records; as-of input snapshots; deduplication; restarts/concurrency tests; access-controlled resolution, no retrospective edits |
| 3 | Outcome evaluation and calibration | Very high; medium | Resolved records, independent outcome sources | Brier/log-loss/calibration bins, grouped sample counts and drift; no unresolved cases scored; holdout protocol and leakage tests |
| 4 | Point-in-time historical research | Very high; high | Licensed timestamped prices, macro vintages, event surprises and delisted instruments | Reproducible study IDs, sampling and cohort definitions, returns/MAE/intervals with sample counts; no look-ahead/survivorship shortcuts |
| 5 | Evidence-backed impact graph | High; medium-high | Durable events and exposure data | Nodes/edges have evidence, timestamps, direct/inferred labels; explorable UI; missing exposure stays unknown |
| 6 | Scenarios and regime research | High; high | Historical cohorts and validation | Explicit assumptions/catalysts/invalidation, competing scenarios, sensitivity, timestamped regime inputs; compare alternatives out of sample |
| 7 | Opportunity research | High; high | Validated distributions, liquidity, costs and exact market contracts | Net expected value/risk with data quality, sensitivity and limitations; no event-to-trade shortcut |
| 8 | Quant Research Engine integration | High; unknown until inspected | Actual engine repository/API/access | Versioned validated requests/responses, reproducible hypotheses/results; inspect before designing |
| 9 | Specialized AI extraction/verification | Conditional; high | Source evidence schemas, evaluation corpus, bounded tools | Measurable improvement over deterministic services; injection/adversarial tests and citation checking; no unsupported numerical claims |

Operational track: verify hosting, durable storage and recovery; remediate dependency advisories, auth/CORS/rate limits, ingestion observability and CI. Do not automatically choose paid infrastructure or enable trading. Product track: keep dense terminal layout, improve narrow-screen navigation and visible feed latency before new decorative panels.

Next concrete iteration: fix ingestion freshness/secret redaction and establish exact forecast target contracts, then implement persistent event/forecast storage against confirmed hosting requirements. Existing priors remain research-only until real estimation evidence exists. A permanent registry alone does not validate a model.

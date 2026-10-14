# Development progress

## Iteration 1 — 2026-10-14

Baseline: 8b81a49. Destination: Nefisauan/WORLD-MONITOR. A temporary checkout is used only for implementation/verification; deliverables are committed and pushed to GitHub.

### Implemented

- Repository audit covering architecture, connected features, models, provider schedules, limitations, security and operational gaps.
- Dependency-aware roadmap and architecture documentation.
- Probability evidence contract and versioned read-only API. Seven existing unvalidated models explicitly abstain; their original coefficients remain inspectable research diagnostics.
- Deterministic trace with timestamped eligible source inputs and excluded input IDs; rejection of stale, non-finite and future inputs.
- No model-market divergence for unmatched contracts; no expired price fallback; no misleading 24h changes from a short snapshot window.
- Integrated research-status panel with keyboard-accessible disclosure, source timestamps, method limitations and signal contributions; morning brief propagates unavailable analysis.
- Test runner, frontend typecheck script and GitHub Actions workflow.

### Validation

Nine tests pass: empty-input abstention; mathematical reproducibility and domain checks; stale/future/non-finite input rejection; detached lineage; unmatched market handling; provider failure/invalid price handling; Fastify HTTP read contract; brief integration; React rendering/empty state. Test fixtures are confined to tests and never shown as live market data.

Production build and both workspace typechecks pass. Frontend lint passes with five pre-existing warnings. No predictive accuracy is claimed. Provider uptime, deployed infrastructure, browser click behavior and production Node 22 execution have not been verified locally. CI is configured but its execution must be checked on GitHub.

Baseline had no test script and a broken frontend typecheck command. Baseline npm installation reported four high-severity dependency advisories; compatible fixes updated five locked packages (Fastify, two fast-uri copies, brace-expansion and source-map-js); npm audit fix now reports zero vulnerabilities. No major-version override was used.

### Files changed

WORLD_MONITOR_AUDIT.md, WORLD_MONITOR_ROADMAP.md, WORLD_MONITOR_ARCHITECTURE.md, WORLD_MONITOR_PROGRESS.md, README.md; probability engine, server/client probability types, brief engine, server index and new probability-api module; ProbabilityBoard and theme CSS; root/server/web package scripts and package-lock.json; server/test probability and UI tests; .github/workflows/ci.yml.

### Incomplete / next

This is an analytical integrity foundation, not a completed institutional platform. No permanent forecast registry, durable events, calibrated statistical model, historical study engine, evidence graph, scenario simulator, opportunity detector or Quant Research Engine integration is implemented. Legacy risk/attribution/history/calendar limitations remain in the audit. Next: ingestion freshness and security corrections, explicit forecast resolution contracts, then durable provenance and immutable forecasts with independent outcome validation.

## Iteration 2 — 2026-10-14

Implemented ingestion integrity without changing hosting or adding simulated production data:

- Correct timestamped historical fallback; provider/retrieval/history provenance and visible observation age.
- Reject invalid, future and unordered observation data; suppress statistics from expired history; retain valid crypto ticker when sparkline fails; 365-day crypto volatility annualization.
- Exclude flagged stale quotes from current regime/risk/alert/brief/attribution calculations; return unknown regime on empty inputs.
- Report partial market health and rejected news items; show health summary in the terminal.
- Preserve RSS publication and detection times, reject bad dates/unsafe URLs per item, retain first process-local detection and expire news during empty feed refreshes.
- Redact URL secrets, bodies and raw exception text from shared provider request failures.

Files: quote/regime/risk-consumer/brief/event engines, shared fetch utility, RSS/Yahoo adapters, polling state, client/server types, MarketGrid and TopBar, ingestion tests and probability fixtures; architecture/audit/roadmap/progress documents.

Validation: 19 tests pass, including ten new ingestion/UI/error-redaction/refresh regression tests. Full build and typecheck pass; lint passes with existing warnings. Existing lint warnings remain. Live deployed behavior remains unverified; no forecast accuracy is claimed.

Remaining: persistent events and forecast records, target-resolution contracts, point-in-time historical datasets, full provider schemas and rate-limit handling, exchange-calendar-aware freshness, confirmed deployment and permanent storage. Next implementation priority is durable event identity/provenance followed by immutable forecasts with independent outcome evaluation.

## Iteration 3 — 2026-10-14

Implemented stable event identity and recorded event timelines. New articles use source+URL SHA-256 identity; events use UUIDs and preserve existing article membership before lexical clustering. SQLite schema v1 stores identities, original detection and append-only evidence revisions atomically. Restarts recover retained active news; expired events remain in the archive. Repeated evidence is idempotent; clock-only score decay is not a new revision. Full source membership is retained. Failed writes do not publish an unrecorded batch. Unknown schema versions/corrupt files fail without replacement.

The event drawer now includes archived revision snapshots, saved scores, publication/detection timestamps, retry/loading states and bounded older-revision pagination. Added a versioned read-only timeline API; archived IDs work through the existing event endpoint. Node minimum raised to 22.13 for built-in SQLite. EVENT_DB_PATH and Git exclusions document the server runtime storage boundary.

Validation: 29 tests pass (10 new event/storage/API/UI-render tests), production build and typechecks pass; lint retains five existing warnings. Tests cover representative changes, non-merging existing events, >12 sources, stable article IDs, close/reopen recovery, idempotence, immutable revision triggers, transaction rollback, chronology, archive expiry/reappearance, pagination/errors, corrupt/newer schemas and initial timeline rendering. Fixtures remain test-only. UI clicks are not browser-automated in this iteration; production hosting is unverified.

Changed files: event engine, RSS adapter, polling state and server index; new storage/events.ts and event-api.ts; EventDrawer and new EventTimeline; new events.test.ts; package engine/lock metadata; server/.env.example, .gitignore and project documentation.

Limitations: one application writer, synchronous SQLite, no semantic clustering or adjudicated merge/split, no pre-existing history backfill, no managed hosting volume or automated backup/restore. Current free Render configuration can lose files on redeployment. No forecast registry, outcome scoring or calibrated model is implemented yet. Next: explicit forecast resolution contracts and immutable forecast records linked to archived evidence.

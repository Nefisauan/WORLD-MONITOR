import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { calculateHeuristic, computeProbabilities } from "../src/engines/probability.js";
import { registerProbabilityResearch } from "../src/probability-api.js";
import { generateBrief } from "../src/engines/brief.js";
import type { EventCluster, GlobalState, Quote } from "../src/types.js";

const now = new Date("2026-10-14T12:00:00Z");
const deps = { now, marketLookup: async () => ({ prob: null }) };
const quote = (overrides: Partial<Quote> = {}): Quote => ({
  id: "VIX", name: "VIX", cls: "equity_index", group: "Volatility",
  source: "test fixture", asOf: now.toISOString(), price: 31,
  changePct1D: 1, changePct5D: 2, changePct1M: 3, changePctYTD: 4,
  spark: [], dailySpark: [], zScore1D: null, vol30D: null, unusual: false, stale: false,
  ...overrides,
});
const event = (overrides: Partial<EventCluster> = {}): EventCluster => ({
  id: "test-event", headline: "Test oil supply event", categories: ["oil_supply"],
  items: [{ id: "item", title: "Fixture", url: "https://example.com/report", source: "fixture", sourceTier: 1, publishedAt: now.toISOString(), categories: [] }],
  sourceCount: 1, firstSeen: now.toISOString(), lastUpdate: now.toISOString(),
  impactScore: 90, impactBreakdown: {}, credibility: 50, countries: [], exposures: [], transmission: null, analogues: [], ...overrides,
});

test("missing data produces seven explicit abstentions, not precise priors", async () => {
  const rows = await computeProbabilities({ quotes: {}, clusters: [] }, deps);
  assert.equal(rows.length, 7);
  for (const row of rows) {
    assert.equal(row.model, null);
    assert.equal(row.baseRate, null);
    assert.equal(row.change24h, null);
    assert.equal(row.divergence, null);
    assert.equal(row.evidence.status, "insufficient_evidence");
    assert.equal(row.evidence.validation, "not_evaluated");
    assert.equal(row.evidence.uncertaintyInterval, null);
    assert.equal(row.asOf, now.toISOString());
  }
});

test("legacy mathematical trace is reproducible without claiming calibration", async () => {
  assert.equal(calculateHeuristic(0.2, []), 0.2);
  const adjusted = calculateHeuristic(0.2, [{ logOdds: Math.log(2), driver: "test" }]);
  assert.ok(Math.abs(adjusted - 1 / 3) < 1e-12);
  assert.equal(calculateHeuristic(0.5, [{ logOdds: 100, driver: "test" }]), 0.97);
  for (const invalid of [0, 1, NaN, Infinity]) assert.throws(() => calculateHeuristic(invalid, []));
  assert.throws(() => calculateHeuristic(0.5, [{ logOdds: NaN, driver: "test" }]));
  const rows = await computeProbabilities({ quotes: { VIX: quote() }, clusters: [event()] }, deps);
  for (const { research, model } of rows) {
    assert.equal(model, null);
    const odds = research.prior / (1 - research.prior) * Math.exp(research.adjustments.reduce((s, a) => s + a.logOdds, 0));
    assert.ok(Math.abs(research.diagnosticValue - Math.max(0.01, Math.min(0.97, odds / (1 + odds)))) < 1e-12);
  }
  assert.ok(rows.find((r) => r.id === "vix_30_3m")!.research.adjustments.length > 0);
});

test("invalid, future, stale and expired inputs cannot affect adjustments", async () => {
  for (const bad of [
    { stale: true }, { asOf: "invalid" }, { asOf: "2026-10-15T00:00:00Z" },
    { asOf: "2026-10-10T00:00:00Z" }, { price: NaN }, { changePct1M: Infinity },
  ]) {
    const rows = await computeProbabilities({ quotes: { VIX: quote(bad) }, clusters: [] }, deps);
    assert.deepEqual(rows[0].research.inputs.excludedQuotes, ["VIX"]);
    assert.equal(rows.find((r) => r.id === "vix_30_3m")!.research.adjustments.length, 0);
  }
  const clusters = [event({ lastUpdate: "bad" }), event({ id: "future", lastUpdate: "2026-10-15T00:00:00Z" }), event({ id: "expired", lastUpdate: "2026-10-01T00:00:00Z" }), event({ id: "bad-score", impactScore: NaN })];
  const rows = await computeProbabilities({ quotes: {}, clusters }, deps);
  assert.equal(rows[0].research.inputs.events.length, 0);
  assert.equal(rows[0].research.inputs.excludedEvents.length, 4);
});

test("lineage is detached from mutable live state and includes source evidence", async () => {
  const q = quote(); const e = event();
  const rows = await computeProbabilities({ quotes: { VIX: q }, clusters: [e] }, deps);
  q.price = 100; e.items[0].url = "changed"; e.categories.push("changed");
  assert.equal(rows[0].research.inputs.quotes[0].price, 31);
  assert.equal(rows[0].research.inputs.events[0].sources[0].url, "https://example.com/report");
  assert.deepEqual(rows[0].research.inputs.events[0].categories, ["oil_supply"]);
});

test("unmatched market prices never generate a forecast or divergence", async () => {
  const rows = await computeProbabilities({ quotes: {}, clusters: [] }, {
    now, marketLookup: async () => ({ prob: 0.99, label: "A different deadline and outcome" }),
  });
  for (const row of rows) {
    assert.equal(row.predictionMarket, null);
    assert.equal(row.divergence, null);
    assert.equal(row.research.relatedMarket?.price, 0.99);
    assert.equal(row.evidence.comparisonStatus, "unmatched_contract");
  }
});

test("provider failure and invalid market prices remain unavailable", async () => {
  for (const lookup of [async () => { throw new Error("offline"); }, ...[NaN, Infinity, -1, 2].map((prob) => async () => ({ prob }))]) {
    const rows = await computeProbabilities({ quotes: {}, clusters: [] }, { now, marketLookup: lookup });
    assert.ok(rows.every((r) => r.research.relatedMarket === null));
  }
});

test("versioned HTTP endpoint serializes abstentions and calculation trace", async () => {
  const rows = await computeProbabilities({ quotes: {}, clusters: [] }, deps);
  const app = Fastify(); registerProbabilityResearch(app, () => rows);
  try {
    const res = await app.inject({ method: "GET", url: "/api/v1/probability-research" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.schemaVersion, 1);
    assert.equal(body.purpose, "unvalidated_research");
    assert.deepEqual(body.estimates, rows);
    assert.equal((await app.inject({ method: "POST", url: "/api/v1/probability-research" })).statusCode, 404);
  } finally { await app.close(); }
});

test("brief carries abstentions instead of asserting absence of market opportunities", async () => {
  const original = [process.env.OPENAI_API_KEY, process.env.ANTHROPIC_API_KEY];
  delete process.env.OPENAI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
  try {
    const probabilities = await computeProbabilities({ quotes: {}, clusters: [] }, deps);
    const state: GlobalState = { quotes: {}, clusters: [], probabilities, regime: null, mapPoints: [], calendar: [], alerts: [], countryRisk: [], globalRiskScore: null, riskDrivers: [], dataHealth: {} };
    const brief = await generateBrief(state);
    assert.match(brief.sections.find((s) => s.title === "Probability research status")!.lines[0], /unavailable/);
    assert.match(brief.sections.find((s) => s.title === "Market comparison status")!.lines[0], /not been matched/);
  } finally {
    for (const [i, key] of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"].entries()) {
      if (original[i] === undefined) delete process.env[key]; else process.env[key] = original[i];
    }
  }
});

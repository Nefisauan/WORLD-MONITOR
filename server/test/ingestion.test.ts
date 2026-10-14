import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildQuote, type HistoryCacheEntry } from "../src/engines/quotes.js";
import { classifyRegime } from "../src/engines/regime.js";
import { normalizeItems } from "../src/sources/rss.js";
import { fetchJson, fetchText } from "../src/util.js";
import { MarketGrid } from "../../web/src/components/MarketGrid.js";
import type { Instrument } from "../src/types.js";

const now = Date.parse("2026-10-14T12:00:00Z");
const inst: Instrument = { id: "TEST", symbol: "TEST", provider: "yahoo", name: "Fixture", cls: "equity_index", group: "US Equities", tags: [] };
const history = (): HistoryCacheEntry => ({ closes: Array.from({ length: 40 }, (_, i) => 100 + i), timestamps: Array.from({ length: 40 }, (_, i) => now / 1000 - (40 - i) * 86400), fetchedAt: now });
const chart = async () => ({ price: 142, previousClose: 140, closes: [140, 142], timestamps: [now / 1000 - 60, now / 1000], asOf: now / 1000 });
const offline = async (): Promise<never> => { throw new Error("fixture offline"); };

test("failed live quote retains historical timestamp and is never current", async () => {
  const q = await buildQuote(inst, { now: () => now, history: async () => history(), chart: offline });
  assert.ok(q);
  assert.equal(q.price, 139);
  assert.equal(q.asOf, new Date(now - 86400_000).toISOString());
  assert.equal(q.retrievedAt, new Date(now).toISOString());
  assert.equal(q.priceKind, "historical_fallback");
  assert.equal(q.stale, true);
  assert.equal(q.changePct1D, null);
  assert.equal(q.unusual, false);
  const html = renderToStaticMarkup(React.createElement(MarketGrid, { quotes: { TEST: q }, onAssetClick: () => {} }));
  assert.match(html, /historical close/);
  assert.match(html, /retrieved/);
});

test("missing or invalid observation time cannot become current time", async () => {
  for (const asOf of [null, NaN, 0, now / 1000 + 60]) {
    const q = await buildQuote(inst, { now: () => now, history: async () => null, chart: async () => ({ ...await chart(), asOf }) });
    assert.equal(q, null);
  }
});

test("stale history cannot produce current horizon statistics", async () => {
  const q = await buildQuote(inst, { now: () => now, history: async () => ({ ...history(), fetchedAt: now - 7200_000 }), chart });
  assert.ok(q);
  assert.equal(q.priceKind, "provider_quote");
  assert.equal(q.stale, false);
  assert.equal(q.historyStale, true);
  assert.equal(q.changePct1M, null);
  assert.equal(q.vol30D, null);
  assert.equal(q.zScore1D, null);
});

test("non-finite prices and unusable history return unavailable", async () => {
  const q = await buildQuote(inst, { now: () => now, history: async () => ({ closes: [NaN, 100], timestamps: [now / 1000, now / 1000 + 1], fetchedAt: now }), chart: async () => ({ ...await chart(), price: NaN }) });
  assert.equal(q, null);
});

test("crypto ticker survives sparkline failure and uses a shorter freshness ceiling", async () => {
  const crypto = { ...inst, provider: "binance" as const, cls: "crypto" as const };
  const q = await buildQuote(crypto, { now: () => now, history: async () => null, ticker: async () => ({ price: 100, changePct1D: 1, asOf: now }), klines: offline });
  assert.ok(q);
  assert.equal(q.price, 100); assert.equal(q.stale, false); assert.deepEqual(q.spark, []);
  const old = await buildQuote(crypto, { now: () => now, history: async () => null, ticker: async () => ({ price: 100, changePct1D: 1, asOf: now - 16 * 60_000 }), klines: offline });
  assert.equal(old?.stale, true);
});

test("empty markets cannot fabricate a Risk-On regime", () => {
  assert.equal(classifyRegime({}, null), null);
});

test("RSS keeps publication/detection distinct and rejects bad items individually", () => {
  const spec = { url: "https://example.com/feed", source: "fixture", tier: 1 };
  const item = (date: string, url = "https://example.com/article") => `<item><title>Fixture</title><link>${url}</link>${date ? `<pubDate>${date}</pubDate>` : ""}</item>`;
  const result = normalizeItems(`<rss><channel>${item("Wed, 14 Oct 2026 10:00:00 GMT")}${item("")}${item("invalid")}${item("Thu, 15 Oct 2026 10:00:00 GMT")}${item("Wed, 14 Oct 2026 10:00:00 GMT", "javascript:alert(1)")}</channel></rss>`, spec, new Date(now));
  assert.equal(result.items.length, 1);
  assert.equal(result.rejected, 4);
  assert.equal(result.items[0].publishedAt, "2026-10-14T10:00:00.000Z");
  assert.equal(result.items[0].detectedAt, new Date(now).toISOString());
  assert.throws(() => normalizeItems("<html>failure</html>", spec));
});

test("HTTP, transport and parser errors never expose URL credentials or response bodies", async (t) => {
  const url = "https://user:password@example.com/secret-path?api_key=PRIVATE_KEY#secret";
  for (const implementation of [
    async () => new Response("private response", { status: 403 }),
    async () => { throw new Error(`HTTP 403 from ${url}`); },
    async () => new Response("PRIVATE_KEY invalid JSON", { status: 200 }),
  ]) {
    const mock = t.mock.method(globalThis, "fetch", implementation);
    try {
      await assert.rejects(fetchJson(url, { retries: 0 }), (err: Error) => {
        assert.match(err.message, /example.com/);
        assert.doesNotMatch(err.message, /PRIVATE_KEY|password|user:|secret-path|private response/);
        return true;
      });
    } finally { mock.mock.restore(); }
  }
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error(url); });
  try { await assert.rejects(fetchText(url), /Request failed from example.com/); }
  finally { mock.mock.restore(); }
});

test("crypto realized volatility uses its 365-day observation calendar", async () => {
  const equity = await buildQuote(inst, { now: () => now, history: async () => history(), chart });
  const crypto = await buildQuote({ ...inst, provider: "binance", cls: "crypto" }, {
    now: () => now, history: async () => history(),
    ticker: async () => ({ price: 142, changePct1D: 1, asOf: now }),
    klines: async () => ({ closes: [], timestamps: [] }),
  });
  assert.ok(equity?.vol30D && crypto?.vol30D);
  assert.ok(Math.abs(crypto.vol30D / equity.vol30D - Math.sqrt(365 / 252)) < 1e-12);
});

test("partial refresh cannot report healthy coverage or infer a regime from fallback", async () => {
  const { state, applyQuoteRefresh } = await import("../src/state.js");
  const original = structuredClone(state);
  try {
    const q = await buildQuote(inst, { now: () => now, history: async () => history(), chart: offline });
    assert.ok(q);
    applyQuoteRefresh({ VIX: { ...q, id: "VIX" } });
    assert.equal(state.dataHealth.markets.ok, false);
    assert.match(state.dataHealth.markets.note!, /0\/\d+ usable/);
    assert.equal(state.regime, null);
    assert.equal(state.globalRiskScore, null);
    applyQuoteRefresh({});
    assert.deepEqual(state.quotes, {});
    assert.equal(state.dataHealth.markets.ok, false);
  } finally { Object.assign(state, original); }
});

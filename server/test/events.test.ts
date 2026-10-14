import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import Fastify from "fastify";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildClusters } from "../src/engines/events.js";
import { EventStore } from "../src/storage/events.js";
import { registerEventArchive } from "../src/event-api.js";
import { normalizeItems } from "../src/sources/rss.js";
import { EventTimeline } from "../../web/src/components/EventTimeline.js";
import type { NewsItem } from "../src/types.js";

const now = Date.parse("2026-10-14T12:00:00.000Z");
const iso = (offset = 0) => new Date(now + offset).toISOString();
const item = (id: string, overrides: Partial<NewsItem> = {}): NewsItem => ({
  id, title: "Iran oil tanker supply disruption", url: `https://example.com/${id}`,
  source: id, sourceTier: 3, publishedAt: iso(-3600_000), detectedAt: iso(), categories: [], ...overrides,
});
const initial = () => buildClusters([item("a")], [], now)[0];
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "world-monitor-events-"));
  const file = join(dir, "events.sqlite");
  return { dir, file, store: new EventStore(file) };
}

test("event identity survives a better representative headline and input reordering", () => {
  const first = initial();
  const update = item("b", { title: "Iran oil tanker supply disruption escalates", sourceTier: 1 });
  const next = buildClusters([update, item("a")], [first], now + 1000);
  assert.equal(next.length, 1);
  assert.equal(next[0].id, first.id);
  assert.equal(next[0].headline, update.title);
  assert.equal(next[0].firstSeen, first.firstSeen);
  assert.equal(next[0].items.length, 2);
  assert.equal(buildClusters([item("a"), update], next, now + 2000)[0].id, first.id);
});

test("existing distinct events never merge merely because their headlines become similar", () => {
  const first = buildClusters([item("a"), item("b", { title: "Federal Reserve announces interest rate decision" })], [], now);
  assert.equal(first.length, 2);
  const next = buildClusters([item("a"), item("b")], first, now + 1000);
  assert.equal(next.length, 2);
  assert.deepEqual(new Set(next.map((event) => event.id)), new Set(first.map((event) => event.id)));
});

test("all source members survive the old twelve-article display cutoff", () => {
  const events = buildClusters(Array.from({ length: 20 }, (_, i) => item(String(i))), [], now);
  assert.equal(events.length, 1);
  assert.equal(events[0].items.length, 20);
  assert.equal(events[0].sourceCount, 20);
});

test("RSS article IDs use source and URL, not mutable headline or URL fragment", () => {
  const parse = (title: string, url: string) => normalizeItems(`<rss><channel><item><title>${title}</title><link>${url}</link><pubDate>${iso(-1000)}</pubDate></item></channel></rss>`, { source: "fixture", tier: 1, url: "https://example.com/feed" }, new Date(now)).items[0];
  assert.equal(parse("First", "https://example.com/a#top").id, parse("Edited", "https://example.com/a").id);
  assert.notEqual(parse("First", "https://example.com/a").id, parse("First", "https://example.com/b").id);
});

test("committed events and detections recover across close/reopen; evidence changes append immutable revisions", () => {
  const f = fixture();
  try {
    const first = initial(); f.store.record([first], iso()); f.store.record([first], iso(1000));
    assert.equal(f.store.timeline(first.id).entries.length, 1);
    f.store.close(); f.store = new EventStore(f.file);
    const news = f.store.recoverNews(now + 2000);
    assert.equal(news[0].detectedAt, iso());
    const next = buildClusters([...news, item("b", { sourceTier: 1, title: "Iran oil tanker supply disruption escalates", detectedAt: iso(2000) })], f.store.previous(news, now + 2000), now + 2000);
    f.store.record(next, iso(2000));
    assert.equal(next[0].id, first.id);
    const timeline = f.store.timeline(first.id);
    assert.equal(timeline.entries.length, 2);
    assert.deepEqual(timeline.entries[1].snapshot, first);
    assert.equal(timeline.entries[0].method, "lexical-events-v2");
    next[0].headline = "mutated in memory";
    assert.notEqual(f.store.get(first.id)!.headline, "mutated in memory");
    const raw = new DatabaseSync(f.file);
    try {
      assert.throws(() => raw.exec("UPDATE event_revisions SET snapshot='{}'"), /append-only/);
      assert.throws(() => raw.exec("DELETE FROM event_revisions"), /append-only/);
    } finally { raw.close(); }
  } finally { f.store.close(); rmSync(f.dir, { recursive: true, force: true }); }
});

test("failed batch rolls back all new rows and membership; backward chronology is rejected", () => {
  const f = fixture();
  try {
    const first = initial(); f.store.record([first], iso(1000));
    const other = buildClusters([item("other", { title: "Federal Reserve announces interest rate decision" })], [], now)[0];
    assert.throws(() => f.store.record([other, { ...first, id: "conflict" }], iso(1000)), /another event/);
    assert.equal(f.store.get(other.id), null);
    assert.equal(f.store.get("conflict"), null);
    assert.equal(f.store.timeline(first.id).entries.length, 1);
    assert.throws(() => f.store.record([first], iso(500)), /backwards/);
    assert.throws(() => f.store.record([{ ...first, firstSeen: iso(-1000) }], iso(1000)), /cannot change/);
  } finally { f.store.close(); rmSync(f.dir, { recursive: true, force: true }); }
});

test("expired events remain queryable, and a revised known article preserves identity and original detection", () => {
  const f = fixture();
  try {
    const first = initial(); f.store.record([first], iso());
    const later = now + 48 * 3600_000;
    assert.deepEqual(f.store.recoverNews(later), []);
    assert.equal(f.store.get(first.id)!.id, first.id);
    const incoming = item("a", { publishedAt: new Date(later).toISOString(), detectedAt: new Date(later).toISOString() });
    const prev = f.store.previous([incoming], later);
    assert.equal(prev[0].items[0].detectedAt, iso());
    const next = buildClusters([incoming], prev, later);
    assert.equal(next[0].id, first.id);
    assert.equal(next[0].firstSeen, first.firstSeen);
  } finally { f.store.close(); rmSync(f.dir, { recursive: true, force: true }); }
});

test("timeline API supports bounded pagination, missing records, invalid input and storage outage", async () => {
  const f = fixture(); const app = Fastify();
  let available = true;
  registerEventArchive(app, () => available ? f.store : null);
  try {
    const first = initial(); f.store.record([first], iso());
    f.store.record([{ ...first, headline: "Updated reporting" }], iso(1000));
    const response = await app.inject(`/api/v1/events/${first.id}/timeline?limit=1`);
    assert.equal(response.statusCode, 200);
    const page = response.json();
    assert.equal(page.schemaVersion, 1); assert.equal(page.entries[0].revision, 2); assert.equal(page.nextBefore, 2);
    const older = (await app.inject(`/api/v1/events/${first.id}/timeline?before=2&limit=1`)).json();
    assert.equal(older.entries[0].revision, 1); assert.equal(older.nextBefore, null);
    assert.equal((await app.inject(`/api/v1/events/${first.id}/timeline?limit=500`)).statusCode, 400);
    assert.equal((await app.inject(`/api/v1/events/${first.id}/timeline?before=-1`)).statusCode, 400);
    assert.equal((await app.inject("/api/v1/events/unknown/timeline")).statusCode, 404);
    available = false;
    assert.equal((await app.inject(`/api/v1/events/${first.id}/timeline`)).statusCode, 503);
    assert.equal((await app.inject({ method: "POST", url: `/api/v1/events/${first.id}/timeline` })).statusCode, 404);
  } finally { await app.close(); f.store.close(); rmSync(f.dir, { recursive: true, force: true }); }
});

test("corrupt or newer database is not silently replaced", () => {
  const f = fixture(); f.store.close();
  try {
    const raw = new DatabaseSync(f.file); raw.exec("PRAGMA user_version=999"); raw.close();
    assert.throws(() => new EventStore(f.file), /Unsupported/);
    const rawAgain = new DatabaseSync(f.file);
    assert.equal(rawAgain.prepare("PRAGMA user_version").get()!.user_version, 999); rawAgain.close();
    const broken = join(f.dir, "broken.sqlite"); writeFileSync(broken, "not a database");
    assert.throws(() => new EventStore(broken));
    assert.equal(readFileSync(broken, "utf8"), "not a database");
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test("event timeline renders explicit loading state and stable identity", () => {
  const html = renderToStaticMarkup(React.createElement(EventTimeline, { eventId: "stable-id" }));
  assert.match(html, /Recorded event timeline/); assert.match(html, /stable-id/);
  assert.match(html, /Loading recorded history/); assert.match(html, /not independently verified/);
});

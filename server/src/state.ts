import path from "node:path";
import { EventStore } from "./storage/events.js";
import type { EventCluster, GlobalState, MapPoint, NewsItem, Quote } from "./types.js";
import { refreshQuotes } from "./engines/quotes.js";
import { buildClusters } from "./engines/events.js";
import { classifyRegime } from "./engines/regime.js";
import { computeProbabilities } from "./engines/probability.js";
import { computeCountryRisk, computeGlobalRisk, generateAlerts } from "./engines/risk.js";
import { fetchAllFeeds } from "./sources/rss.js";
import { fetchGdeltMapPoints } from "./sources/gdelt.js";
import { fetchQuakes } from "./sources/usgs.js";
import { buildCalendar } from "./knowledge/calendar.js";
import { INSTRUMENTS } from "./knowledge/instruments.js";
import { CHOKEPOINTS } from "./knowledge/countries.js";

// Central in-memory state + polling orchestration. Each loop updates a slice
// of state, records data health honestly, and notifies SSE listeners.

export const state: GlobalState = {
  quotes: {},
  clusters: [],
  probabilities: [],
  regime: null,
  mapPoints: [],
  calendar: [],
  alerts: [],
  countryRisk: [],
  globalRiskScore: null,
  riskDrivers: [],
  dataHealth: {},
};

let newsPool: NewsItem[] = [];
let eventStore: EventStore | null = null;
let newsInFlight = false;
export function getEventStore() { return eventStore; }

function initializeEventStore() {
  try {
    eventStore = new EventStore(process.env.EVENT_DB_PATH || path.resolve(process.cwd(), ".data/events.sqlite"));
    newsPool = eventStore.recoverNews(Date.now());
    state.clusters = buildClusters(newsPool, eventStore.previous(newsPool, Date.now()));
    health("event_archive", true, "File-backed archive; retention across hosting redeploys requires a persistent volume and backups.");
  } catch {
    eventStore?.close();
    eventStore = null;
    health("event_archive", false, "Archive unavailable. Check database access/schema; existing files have not been replaced.");
  }
}
let gdeltPoints: MapPoint[] = [];
let quakePoints: MapPoint[] = [];

type Listener = (topic: string) => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(topic: string) {
  for (const fn of listeners) fn(topic);
}

function health(source: string, ok: boolean, note?: string) {
  state.dataHealth[source] = {
    ok,
    lastSuccess: ok ? new Date().toISOString() : state.dataHealth[source]?.lastSuccess ?? null,
    note,
  };
}

function rebuildDerived() {
  const eligibleQuotes = Object.fromEntries(Object.entries(state.quotes).filter(([, q]) => !q.stale));
  state.regime = classifyRegime(eligibleQuotes, state.regime);
  const { score, drivers } = computeGlobalRisk(eligibleQuotes, state.clusters, state.regime);
  state.globalRiskScore = Object.keys(eligibleQuotes).length || state.clusters.length ? score : null;
  state.riskDrivers = drivers;
  state.countryRisk = computeCountryRisk(state.clusters);
  state.alerts = generateAlerts(eligibleQuotes, state.clusters, state.regime, state.alerts);
}

export function applyQuoteRefresh(quotes: Record<string, Quote>) {
    state.quotes = quotes;
    const usable = Object.values(quotes).filter((q) => !q.stale).length;
    if (Object.keys(quotes).length > 0) {
      health("markets", usable === INSTRUMENTS.length,
        `${usable}/${INSTRUMENTS.length} usable provider quotes; ${Object.keys(quotes).length - usable} stale/fallback; ${INSTRUMENTS.length - Object.keys(quotes).length} unavailable`);
    } else {
      health("markets", false, "no quotes returned");
    }
    rebuildDerived();
    notify("quotes");
}

async function quotesLoop() {
  try {
    const quotes = await refreshQuotes();
    applyQuoteRefresh(quotes);
  } catch (err) {
    health("markets", false, String(err));
  }
}

async function newsLoop() {
  if (newsInFlight) return;
  newsInFlight = true;
  try {
    const { items, failures, rejected } = await fetchAllFeeds();
    const byId = new Map(newsPool.map((n) => [n.id, n]));
    for (const it of items) byId.set(it.id, { ...it, detectedAt: byId.get(it.id)?.detectedAt ?? it.detectedAt });
    newsPool = [...byId.values()]
      .filter((n) => Date.parse(n.publishedAt) > Date.now() - 36 * 3600_000)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 1500);
    if (!eventStore) throw new Error("Event archive unavailable; news publication paused to avoid unrecorded history");
    const now = Date.now();
    const previous = eventStore.previous(newsPool, now);
    // Restore first detection for articles recovered after a restart or archived hiatus.
    const detections = new Map(previous.flatMap((event) => event.items).map((item) => [item.id, item.detectedAt]));
    newsPool = newsPool.map((item) => ({ ...item, detectedAt: detections.get(item.id) ?? item.detectedAt }));
    const clusters = buildClusters(newsPool, previous, now);
    eventStore.record(clusters, new Date(now).toISOString());
    state.clusters = clusters;
    health("event_archive", true, "File-backed archive; hosting volume retention and backups must be verified separately.");
    health("news", failures.length === 0 && rejected === 0,
      `accepted items: ${items.length}; failed feeds: ${failures.join(", ") || "none"}; rejected items: ${rejected}`);
    rebuildDerived();
    notify("events");
  } catch (err) {
    health("news", false, "News refresh or archive write failed; last committed state retained.");
    health("event_archive", false, "News batch not committed. Check provider and storage availability.");
  } finally { newsInFlight = false; }
}

async function probabilityLoop() {
  try {
    state.probabilities = await computeProbabilities({ quotes: state.quotes, clusters: state.clusters });
    health("probabilities", true);
    notify("probabilities");
  } catch (err) {
    health("probabilities", false, String(err));
  }
}

async function mapLoop() {
  try {
    const [gd, qk] = await Promise.allSettled([fetchGdeltMapPoints(), fetchQuakes()]);
    if (gd.status === "fulfilled") {
      gdeltPoints = gd.value;
      health("gdelt", true);
    } else health("gdelt", false, String(gd.reason));
    if (qk.status === "fulfilled") {
      quakePoints = qk.value;
      health("usgs", true);
    } else health("usgs", false, String(qk.reason));

    const chokepointPoints: MapPoint[] = CHOKEPOINTS.map((cp) => ({
      id: `cp-${cp.id}`,
      kind: "chokepoint",
      lat: cp.lat,
      lon: cp.lon,
      label: cp.name,
      detail: `${cp.share} — ${cp.note}`,
      intensity: 0.6,
    }));
    state.mapPoints = [...chokepointPoints, ...quakePoints, ...gdeltPoints];
    notify("map");
  } catch (err) {
    health("map", false, String(err));
  }
}

function calendarLoop() {
  state.calendar = buildCalendar(new Date());
  notify("calendar");
}

export function getNewsPool(): NewsItem[] {
  return newsPool;
}

export async function startLoops() {
  initializeEventStore();
  calendarLoop();
  // Initial fetches in parallel; probability engine waits for the first two.
  await Promise.allSettled([quotesLoop(), newsLoop(), mapLoop()]);
  await probabilityLoop();

  setInterval(quotesLoop, 60_000);
  setInterval(newsLoop, 180_000);
  setInterval(mapLoop, 10 * 60_000);
  setInterval(probabilityLoop, 5 * 60_000);
  setInterval(calendarLoop, 6 * 3600_000);
}

import type { EventCluster, GlobalState, MapPoint, NewsItem } from "./types.js";
import { refreshQuotes } from "./engines/quotes.js";
import { buildClusters } from "./engines/events.js";
import { classifyRegime } from "./engines/regime.js";
import { computeProbabilities } from "./engines/probability.js";
import { computeCountryRisk, computeGlobalRisk, generateAlerts } from "./engines/risk.js";
import { fetchAllFeeds } from "./sources/rss.js";
import { fetchGdeltMapPoints } from "./sources/gdelt.js";
import { fetchQuakes } from "./sources/usgs.js";
import { buildCalendar } from "./knowledge/calendar.js";
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
  state.regime = classifyRegime(state.quotes, state.regime);
  const { score, drivers } = computeGlobalRisk(state.quotes, state.clusters, state.regime);
  state.globalRiskScore = score;
  state.riskDrivers = drivers;
  state.countryRisk = computeCountryRisk(state.clusters);
  state.alerts = generateAlerts(state.quotes, state.clusters, state.regime, state.alerts);
}

async function quotesLoop() {
  try {
    const quotes = await refreshQuotes();
    if (Object.keys(quotes).length > 0) {
      state.quotes = quotes;
      health("markets", true);
    } else {
      health("markets", false, "no quotes returned");
    }
    rebuildDerived();
    notify("quotes");
  } catch (err) {
    health("markets", false, String(err));
  }
}

async function newsLoop() {
  try {
    const { items, failures } = await fetchAllFeeds();
    if (items.length) {
      const byId = new Map(newsPool.map((n) => [n.id, n]));
      for (const it of items) byId.set(it.id, it);
      newsPool = [...byId.values()]
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .slice(0, 1500);
      state.clusters = buildClusters(newsPool, state.clusters);
      health("news", failures.length < 6, failures.length ? `failed: ${failures.join(", ")}` : undefined);
    } else {
      health("news", false, "all feeds failed");
    }
    rebuildDerived();
    notify("events");
  } catch (err) {
    health("news", false, String(err));
  }
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

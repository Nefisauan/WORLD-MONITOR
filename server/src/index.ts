import fs from "node:fs";
import { registerProbabilityResearch } from "./probability-api.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { state, startLoops, subscribe } from "./state.js";
import { explainMove } from "./engines/why.js";
import { generateBrief } from "./engines/brief.js";
import { llmProvider } from "./engines/llm.js";
import { FRED_SERIES, fetchFredSeries, fredKey } from "./sources/fred.js";
import { EPISODES } from "./knowledge/history.js";
import { CHOKEPOINTS, COUNTRY_BASES } from "./knowledge/countries.js";
import { INSTRUMENTS } from "./knowledge/instruments.js";

const app = Fastify({ logger: { level: "warn" } });
await app.register(cors, { origin: true });

// In production, serve the built frontend from web/dist (single web service).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, "../../web/dist");
if (fs.existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api/")) return reply.code(404).send({ error: "not found" });
    return reply.sendFile("index.html");
  });
}

app.get("/api/health", async () => ({ ok: true, uptime: process.uptime() }));

// ---- Snapshot & slices ----

app.get("/api/state", async () => state);
registerProbabilityResearch(app, () => state.probabilities);

app.get("/api/instruments", async () => INSTRUMENTS);

app.get("/api/episodes", async () => EPISODES);

app.get("/api/chokepoints", async () => CHOKEPOINTS);

app.get("/api/config", async () => ({
  fred: !!fredKey(),
  finnhub: !!process.env.FINNHUB_API_KEY?.trim(),
  llm: llmProvider(),
}));

// ---- Why is it moving ----

app.get<{ Params: { assetId: string } }>("/api/why/:assetId", async (req, reply) => {
  const result = explainMove(req.params.assetId, state.quotes, state.clusters);
  if (!result) return reply.code(404).send({ error: "unknown asset or no quote available" });
  return result;
});

// ---- Event detail ----

app.get<{ Params: { id: string } }>("/api/event/:id", async (req, reply) => {
  const cluster = state.clusters.find((c) => c.id === req.params.id);
  if (!cluster) return reply.code(404).send({ error: "event not found" });
  return cluster;
});

// ---- Country dossier ----

app.get<{ Params: { iso2 : string } }>("/api/country/:iso2", async (req, reply) => {
  const iso = req.params.iso2.toUpperCase();
  const risk = state.countryRisk.find((c) => c.iso2 === iso);
  const base = COUNTRY_BASES.find((c) => c.iso2 === iso);
  if (!risk || !base) return reply.code(404).send({ error: "country not tracked" });
  const events = state.clusters.filter((c) => c.countries.includes(iso)).slice(0, 10);
  return { ...risk, lat: base.lat, lon: base.lon, events };
});

// ---- Macro (FRED, key-gated; never simulated) ----

let macroCache: { data: unknown; fetchedAt: number } | null = null;

app.get("/api/macro", async () => {
  if (!fredKey()) {
    return {
      available: false,
      reason: "FRED_API_KEY not configured — get a free key at fred.stlouisfed.org/docs/api/api_key.html and add it to server/.env",
      series: FRED_SERIES.map((s) => ({ ...s, latest: null })),
    };
  }
  if (macroCache && Date.now() - macroCache.fetchedAt < 30 * 60 * 1000) return macroCache.data;
  const results = await Promise.allSettled(
    FRED_SERIES.map((s) => fetchFredSeries(s.id, s.name, s.unit)),
  );
  const series = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { ...FRED_SERIES[i], latest: null, error: String(r.reason) },
  );
  const data = { available: true, series, asOf: new Date().toISOString() };
  macroCache = { data, fetchedAt: Date.now() };
  return data;
});

// ---- Morning brief ----

let briefCache: { data: unknown; fetchedAt: number } | null = null;

app.get("/api/brief", async () => {
  if (briefCache && Date.now() - briefCache.fetchedAt < 10 * 60 * 1000) return briefCache.data;
  const brief = await generateBrief(state);
  briefCache = { data: brief, fetchedAt: Date.now() };
  return brief;
});

// ---- SSE stream ----

app.get("/api/stream", (req, reply) => {
  reply.raw.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "access-control-allow-origin": "*",
  });
  reply.raw.write(`event: hello\ndata: {}\n\n`);

  const send = (topic: string) => {
    reply.raw.write(`event: update\ndata: ${JSON.stringify({ topic })}\n\n`);
  };
  const unsubscribe = subscribe(send);
  const keepalive = setInterval(() => reply.raw.write(`: ping\n\n`), 25_000);

  req.raw.on("close", () => {
    clearInterval(keepalive);
    unsubscribe();
  });
});

const PORT = Number(process.env.PORT || 8787);
await startLoops();
await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(`world-intel server on :${PORT} (fred=${!!fredKey()}, llm=${llmProvider() ?? "off"})`);

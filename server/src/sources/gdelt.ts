import { fetchJson } from "../util.js";
import type { MapPoint } from "../types.js";

// GDELT v2 GEO API (keyless): geolocated news mentions for the world map.

interface GdeltGeoResponse {
  features?: {
    geometry: { coordinates: [number, number] };
    properties: { name: string; count: number; html?: string; shareimage?: string };
  }[];
}

const THEMES: { query: string; kind: MapPoint["kind"]; label: string; categories: string[] }[] = [
  { query: '(military OR missile OR airstrike OR troops OR "armed conflict")', kind: "conflict", label: "Conflict activity", categories: ["war_escalation"] },
  { query: '(protest OR riot OR unrest OR demonstration)', kind: "event", label: "Protest / unrest", categories: ["elections_politics"] },
  { query: '("oil production" OR pipeline OR refinery OR OPEC OR tanker)', kind: "event", label: "Energy signal", categories: ["oil_supply"] },
  { query: '(sanctions OR "export controls" OR tariffs)', kind: "event", label: "Trade / sanctions", categories: ["sanctions_export_controls"] },
];

export async function fetchGdeltMapPoints(): Promise<MapPoint[]> {
  const points: MapPoint[] = [];
  const results = await Promise.allSettled(
    THEMES.map(async (theme) => {
      const url =
        "https://api.gdeltproject.org/api/v2/geo/geo?query=" +
        encodeURIComponent(theme.query) +
        "&format=geojson&timespan=24h&maxpoints=60";
      const data = await fetchJson<GdeltGeoResponse>(url, { timeoutMs: 15_000 });
      const feats = data.features ?? [];
      const maxCount = Math.max(1, ...feats.map((f) => f.properties.count));
      return feats
        .filter((f) => f.properties.count >= 2)
        .map((f, i): MapPoint => ({
          id: `${theme.label}-${i}-${f.properties.name}`,
          kind: theme.kind,
          lon: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          label: f.properties.name,
          detail: `${theme.label} — ${f.properties.count} geolocated mentions in 24h (GDELT)`,
          intensity: Math.min(1, f.properties.count / maxCount),
          categories: theme.categories,
        }));
    }),
  );
  for (const r of results) if (r.status === "fulfilled") points.push(...r.value);
  return points;
}

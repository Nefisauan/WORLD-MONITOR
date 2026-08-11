import { fetchJson } from "../util.js";
import type { MapPoint } from "../types.js";

// USGS significant earthquakes, past 7 days (keyless GeoJSON feed).

interface UsgsResponse {
  features: {
    id: string;
    properties: { mag: number; place: string; time: number; url: string };
    geometry: { coordinates: [number, number, number] };
  }[];
}

export async function fetchQuakes(): Promise<MapPoint[]> {
  const data = await fetchJson<UsgsResponse>(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
  );
  return data.features.map((f) => ({
    id: f.id,
    kind: "quake" as const,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    label: `M${f.properties.mag.toFixed(1)} earthquake`,
    detail: `${f.properties.place} — ${new Date(f.properties.time).toISOString()} (USGS)`,
    intensity: Math.min(1, Math.max(0, (f.properties.mag - 4) / 4)),
    url: f.properties.url,
    categories: ["natural_disaster"],
  }));
}

import { useEffect, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { CountryRisk, MapPoint } from "../types";

interface Props {
  points: MapPoint[];
  countryRisk: CountryRisk[];
  onCountryClick: (risk: CountryRisk) => void;
}

const KIND_COLOR: Record<MapPoint["kind"], string> = {
  conflict: "#ff4d5e",
  event: "#ffb02e",
  quake: "#b28dff",
  chokepoint: "#4da6ff",
};

interface Land {
  features: FeatureCollection<Geometry>;
}

let landCache: Land | null = null;

async function loadLand(): Promise<Land> {
  if (landCache) return landCache;
  const topo = (await import("world-atlas/countries-110m.json")) as unknown as {
    default: { objects: { countries: never } };
  };
  const fc = feature(
    topo.default as never,
    topo.default.objects.countries,
  ) as unknown as FeatureCollection<Geometry>;
  landCache = { features: fc };
  return landCache;
}

// Approximate anchor coordinates for risk-tracked countries (drawn as rings).
const RISK_ANCHORS: Record<string, [number, number]> = {
  US: [-98, 39], CN: [104, 35], TW: [121, 23.7], RU: [100, 60], UA: [32, 49],
  IR: [53, 32], IL: [34.9, 31.5], SA: [45, 24], JP: [138, 36], DE: [10, 51],
  GB: [-2, 54], FR: [2, 46], IN: [78, 21], BR: [-55, -10], KR: [128, 36],
  TR: [35, 39], MX: [-102, 23], EG: [30, 27], NG: [8, 9], AR: [-64, -34],
  VE: [-66, 8], PK: [70, 30],
};

export function WorldMap({ points, countryRisk, onCountryClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const projRef = useRef<GeoProjection | null>(null);

  useEffect(() => {
    let disposed = false;
    let raf = 0;

    async function draw() {
      const land = await loadLand();
      if (disposed) return;
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;

      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === 0 || h === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;

      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const projection = geoNaturalEarth1().fitExtent(
        [[4, 4], [w - 4, h - 4]],
        { type: "Sphere" },
      );
      projRef.current = projection;
      const path = geoPath(projection, ctx);

      // graticule-free dark ocean
      ctx.beginPath();
      path({ type: "Sphere" });
      ctx.fillStyle = "#0a0e14";
      ctx.fill();

      // land
      ctx.beginPath();
      path(land.features);
      ctx.fillStyle = "#151c26";
      ctx.fill();
      ctx.strokeStyle = "#232e3c";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // country risk rings
      for (const cr of countryRisk) {
        const anchor = RISK_ANCHORS[cr.iso2];
        if (!anchor) continue;
        const p = projection(anchor);
        if (!p) continue;
        const r = 4 + (cr.overall / 100) * 9;
        const color = cr.overall >= 65 ? "#ff4d5e" : cr.overall >= 45 ? "#ffb02e" : "#3d4a5a";
        ctx.beginPath();
        ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
        ctx.strokeStyle = color + "aa";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p[0], p[1], 1.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      // live points
      for (const pt of points) {
        const p = projection([pt.lon, pt.lat]);
        if (!p) continue;
        const base = pt.kind === "chokepoint" ? 3 : 2 + pt.intensity * 4;
        ctx.beginPath();
        if (pt.kind === "chokepoint") {
          // diamond
          ctx.moveTo(p[0], p[1] - base);
          ctx.lineTo(p[0] + base, p[1]);
          ctx.lineTo(p[0], p[1] + base);
          ctx.lineTo(p[0] - base, p[1]);
          ctx.closePath();
          ctx.strokeStyle = KIND_COLOR[pt.kind];
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.arc(p[0], p[1], base, 0, Math.PI * 2);
          ctx.fillStyle = KIND_COLOR[pt.kind] + "cc";
          ctx.fill();
          if (pt.intensity > 0.6) {
            ctx.beginPath();
            ctx.arc(p[0], p[1], base + 3, 0, Math.PI * 2);
            ctx.strokeStyle = KIND_COLOR[pt.kind] + "44";
            ctx.stroke();
          }
        }
      }
    }

    draw();
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [points, countryRisk]);

  function nearest(mx: number, my: number): { text: string; country?: CountryRisk } | null {
    const proj = projRef.current;
    if (!proj) return null;
    let best: { d: number; text: string; country?: CountryRisk } | null = null;
    for (const pt of points) {
      const p = proj([pt.lon, pt.lat]);
      if (!p) continue;
      const d = Math.hypot(p[0] - mx, p[1] - my);
      if (d < 12 && (!best || d < best.d)) best = { d, text: `${pt.label}\n${pt.detail}` };
    }
    for (const cr of countryRisk) {
      const anchor = RISK_ANCHORS[cr.iso2];
      if (!anchor) continue;
      const p = proj(anchor);
      if (!p) continue;
      const d = Math.hypot(p[0] - mx, p[1] - my);
      if (d < 14 && (!best || d < best.d)) {
        best = { d, text: `${cr.name} — risk ${cr.overall}/100 (click for dossier)`, country: cr };
      }
    }
    return best;
  }

  return (
    <div className="map-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const hit = nearest(e.clientX - rect.left, e.clientY - rect.top);
          setTooltip(hit ? { x: e.clientX - rect.left + 12, y: e.clientY - rect.top + 12, text: hit.text } : null);
        }}
        onMouseLeave={() => setTooltip(null)}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const hit = nearest(e.clientX - rect.left, e.clientY - rect.top);
          if (hit?.country) onCountryClick(hit.country);
        }}
      />
      {tooltip && (
        <div className="map-tooltip" style={{ left: tooltip.x, top: tooltip.y, whiteSpace: "pre-line" }}>
          {tooltip.text}
        </div>
      )}
      <div className="map-legend">
        <span><span className="legend-dot" style={{ background: KIND_COLOR.conflict }} />conflict</span>
        <span><span className="legend-dot" style={{ background: KIND_COLOR.event }} />signal</span>
        <span><span className="legend-dot" style={{ background: KIND_COLOR.quake }} />quake</span>
        <span><span className="legend-dot" style={{ background: KIND_COLOR.chokepoint }} />chokepoint</span>
        <span><span className="legend-dot" style={{ border: "1px solid #ffb02e", background: "transparent" }} />country risk</span>
      </div>
    </div>
  );
}

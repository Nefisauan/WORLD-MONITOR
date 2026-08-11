import type { AlertItem, CountryRisk, EventCluster, Quote, RegimeState } from "../types.js";
import { COUNTRY_BASES } from "../knowledge/countries.js";
import { clamp, hashId, mean } from "../util.js";

// Global risk score + country risk (base priors adjusted by live news
// velocity) + alert generation from unusual moves and high-impact events.

export function computeCountryRisk(clusters: EventCluster[]): CountryRisk[] {
  const velocity = new Map<string, number>();
  for (const c of clusters) {
    for (const iso of c.countries) {
      velocity.set(iso, (velocity.get(iso) ?? 0) + c.impactScore / 100);
    }
  }
  const maxVel = Math.max(1, ...velocity.values());

  return COUNTRY_BASES.map((cb) => {
    const vel = velocity.get(cb.iso2) ?? 0;
    const velNorm = vel / maxVel; // 0..1
    const baseAvg = mean(Object.values(cb.base));
    const overall = Math.round(clamp(baseAvg * 0.8 + velNorm * 25, 0, 100));
    return {
      iso2: cb.iso2,
      name: cb.name,
      overall,
      components: cb.base,
      marketsCare: cb.marketsCare,
      newsVelocity: Math.round(velNorm * 100),
    };
  }).sort((a, b) => b.overall - a.overall);
}

export function computeGlobalRisk(
  quotes: Record<string, Quote>,
  clusters: EventCluster[],
  regime: RegimeState | null,
): { score: number; drivers: { name: string; delta: number }[] } {
  const drivers: { name: string; delta: number }[] = [];
  let score = 30; // neutral baseline

  const vix = quotes["VIX"]?.price;
  if (vix != null) {
    const d = clamp((vix - 16) * 1.2, -8, 25);
    drivers.push({ name: `VIX ${vix.toFixed(1)}`, delta: Math.round(d) });
    score += d;
  }

  const topEvents = clusters.slice(0, 5);
  if (topEvents.length) {
    const avgImpact = mean(topEvents.map((c) => c.impactScore));
    const d = clamp((avgImpact - 40) * 0.4, -5, 15);
    drivers.push({ name: `Top-5 event impact avg ${avgImpact.toFixed(0)}`, delta: Math.round(d) });
    score += d;
  }

  const warFlow = clusters.filter((c) => c.categories.includes("war_escalation")).length;
  if (warFlow > 0) {
    const d = clamp(warFlow * 1.5, 0, 10);
    drivers.push({ name: `${warFlow} escalation event(s)`, delta: Math.round(d) });
    score += d;
  }

  const unusual = Object.values(quotes).filter((q) => q.unusual).length;
  if (unusual > 0) {
    const d = clamp(unusual * 2, 0, 12);
    drivers.push({ name: `${unusual} unusual market move(s)`, delta: Math.round(d) });
    score += d;
  }

  if (regime) {
    const regimeAdj: Record<string, number> = { Crisis: 20, Stress: 12, "Risk-Off": 6, Stagflationary: 8, Inflationary: 4, Neutral: 0, "Risk-On": -6 };
    const d = regimeAdj[regime.regime] ?? 0;
    if (d !== 0) drivers.push({ name: `Regime: ${regime.regime}`, delta: d });
    score += d;
  }

  return { score: Math.round(clamp(score, 0, 100)), drivers };
}

export function generateAlerts(
  quotes: Record<string, Quote>,
  clusters: EventCluster[],
  regime: RegimeState | null,
  previousAlerts: AlertItem[],
): AlertItem[] {
  const seen = new Set(previousAlerts.map((a) => a.id));
  const fresh: AlertItem[] = [];
  const now = new Date().toISOString();

  for (const q of Object.values(quotes)) {
    if (q.unusual && q.zScore1D != null && q.changePct1D != null) {
      const id = `um-${q.id}-${new Date().toISOString().slice(0, 10)}-${q.zScore1D > 0 ? "up" : "dn"}`;
      if (seen.has(id)) continue;
      const sev = Math.abs(q.zScore1D) >= 3.5 ? "critical" : Math.abs(q.zScore1D) >= 2.5 ? "warning" : "info";
      fresh.push({
        id,
        ts: now,
        severity: sev,
        title: `UNUSUAL MOVE: ${q.name} ${q.changePct1D >= 0 ? "+" : ""}${q.changePct1D.toFixed(1)}%`,
        body: `${Math.abs(q.zScore1D).toFixed(1)}σ move vs trailing 1-year daily distribution. 30D realized vol ${q.vol30D?.toFixed(0) ?? "n/a"}%. Source: ${q.source}.`,
        kind: "unusual_move",
      });
    }
  }

  for (const c of clusters.slice(0, 10)) {
    if (c.impactScore >= 70 && c.sourceCount >= 2) {
      const id = `ev-${c.id}`;
      if (seen.has(id)) continue;
      fresh.push({
        id,
        ts: now,
        severity: c.impactScore >= 85 ? "critical" : "warning",
        title: `HIGH-IMPACT EVENT (${c.impactScore}/100)`,
        body: `${c.headline} — corroborated by ${c.sourceCount} sources.`,
        kind: "event",
      });
    }
  }

  if (regime?.previous && regime.previous !== regime.regime) {
    const id = `rg-${hashId(regime.previous + regime.regime + now.slice(0, 10))}`;
    if (!seen.has(id)) {
      fresh.push({
        id,
        ts: now,
        severity: "warning",
        title: `REGIME SHIFT: ${regime.previous} → ${regime.regime}`,
        body: `Classifier confidence ${regime.confidence}%. This is a model inference from cross-asset signals.`,
        kind: "regime_change",
      });
    }
  }

  return [...fresh, ...previousAlerts].slice(0, 60);
}

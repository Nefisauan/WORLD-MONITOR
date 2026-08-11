import type { EventCluster, Quote } from "../types.js";
import { INSTRUMENT_BY_ID } from "../knowledge/instruments.js";
import { mean } from "../util.js";

// "Why is it moving?" — deterministic move attribution. Decomposes an asset's
// 1D move into market factor, group factor, and event-flow factor, and ranks
// candidate explanations. Output is explicitly a model estimate.

// Which instrument tags each event category plausibly moves.
const CATEGORY_TO_TAGS: Record<string, string[]> = {
  oil_supply: ["oil", "energy", "middle_east", "inflation"],
  war_escalation: ["defense", "safe_haven", "gold", "volatility", "oil"],
  ceasefire_deescalation: ["oil", "gold", "defense", "risk_asset"],
  sanctions_export_controls: ["semiconductors", "china", "trade_war", "metals", "taiwan"],
  cb_policy: ["rates", "fed", "usd", "growth_stocks", "gold", "rates_sensitive", "crypto"],
  inflation_data: ["rates", "usd", "gold", "growth_stocks", "inflation_hedge"],
  growth_data: ["us_equities", "rates", "small_caps", "global_growth"],
  banking_credit_stress: ["banks", "credit", "credit_stress", "safe_haven", "gold"],
  shipping_disruption: ["shipping", "oil", "energy", "inflation"],
  taiwan_semis: ["semiconductors", "taiwan", "tech", "china", "asia"],
  cyber: ["tech"],
  natural_disaster: ["grains", "energy", "weather"],
  elections_politics: ["em", "instability"],
  fiscal_sovereign: ["rates", "long_end", "term_premium", "fiscal", "gold"],
  ai_infra: ["semiconductors", "ai", "ai_power", "electrification", "copper", "natgas", "tech"],
  crypto_events: ["crypto"],
};

export interface WhyExplanation {
  assetId: string;
  assetName: string;
  move1D: number | null;
  zScore: number | null;
  factors: { label: string; sharePct: number; detail: string }[];
  relatedEvents: { id: string; headline: string; impactScore: number }[];
  correlatedMovers: { id: string; name: string; changePct1D: number }[];
  disclaimer: string;
}

export function explainMove(
  assetId: string,
  quotes: Record<string, Quote>,
  clusters: EventCluster[],
): WhyExplanation | null {
  const inst = INSTRUMENT_BY_ID.get(assetId);
  const q = quotes[assetId];
  if (!inst || !q) return null;

  const move = q.changePct1D ?? 0;
  const tags = new Set(inst.tags);

  // Market factor: broad index move (sign-aligned share)
  const spx = quotes["SPX"]?.changePct1D ?? 0;
  const isRiskAsset = tags.has("risk_asset") || inst.cls === "sector" || inst.cls === "equity_index";
  const marketComponent = isRiskAsset ? Math.abs(spx) : Math.abs(spx) * 0.3;

  // Group factor: average move of same-group instruments (excluding self)
  const groupPeers = Object.values(quotes).filter((x) => x.group === q.group && x.id !== q.id && x.changePct1D != null);
  const groupAvg = groupPeers.length ? mean(groupPeers.map((x) => x.changePct1D!)) : 0;
  const groupComponent = Math.abs(groupAvg);

  // Event factor: sum of impact of clusters whose category tags intersect asset tags
  const related = clusters
    .filter((c) => c.impactScore >= 35)
    .map((c) => {
      const catTags = c.categories.flatMap((id) => CATEGORY_TO_TAGS[id] ?? []);
      const overlap = catTags.filter((t) => tags.has(t)).length;
      return { c, overlap };
    })
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.c.impactScore * b.overlap - a.c.impactScore * a.overlap)
    .slice(0, 5);

  const eventComponent = related.length
    ? Math.min(3, related.reduce((a, x) => a + (x.c.impactScore / 100) * x.overlap * 0.4, 0))
    : 0;

  const idio = Math.max(0.15, Math.abs(move) - marketComponent * 0.5 - groupComponent * 0.3);

  const rawFactors = [
    {
      label: "Event flow",
      weight: eventComponent,
      detail: related.length
        ? `${related.length} live event cluster(s) with exposure overlap; top: "${related[0].c.headline.slice(0, 90)}"`
        : "No matching high-impact events in the current stream",
    },
    {
      label: `${q.group} group move`,
      weight: groupComponent,
      detail: `Peer average ${groupAvg >= 0 ? "+" : ""}${groupAvg.toFixed(2)}% today across ${groupPeers.length} instruments`,
    },
    {
      label: "Broad market factor",
      weight: marketComponent,
      detail: `S&P 500 ${spx >= 0 ? "+" : ""}${spx.toFixed(2)}% today${isRiskAsset ? " (asset is beta-exposed)" : " (limited beta linkage)"}`,
    },
    {
      label: "Idiosyncratic / unexplained",
      weight: idio,
      detail: "Residual not attributable to observed factors — could be flows, positioning, or information not yet in the news stream",
    },
  ];

  const total = rawFactors.reduce((a, f) => a + f.weight, 0) || 1;
  const factors = rawFactors
    .map((f) => ({ label: f.label, sharePct: Math.round((f.weight / total) * 100), detail: f.detail }))
    .sort((a, b) => b.sharePct - a.sharePct);

  const correlated = Object.values(quotes)
    .filter((x) => x.id !== q.id && x.changePct1D != null)
    .map((x) => {
      const shared = INSTRUMENT_BY_ID.get(x.id)?.tags.filter((t) => tags.has(t)).length ?? 0;
      return { x, shared };
    })
    .filter((v) => v.shared >= 1)
    .sort((a, b) => Math.abs(b.x.changePct1D!) - Math.abs(a.x.changePct1D!))
    .slice(0, 6)
    .map((v) => ({ id: v.x.id, name: v.x.name, changePct1D: v.x.changePct1D! }));

  return {
    assetId,
    assetName: q.name,
    move1D: q.changePct1D,
    zScore: q.zScore1D,
    factors,
    relatedEvents: related.map((x) => ({ id: x.c.id, headline: x.c.headline, impactScore: x.c.impactScore })),
    correlatedMovers: correlated,
    disclaimer: "Model estimate from observable factors — not a verified causal attribution.",
  };
}

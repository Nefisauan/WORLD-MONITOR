import type { EventCluster, ProbabilityEstimate, Quote } from "../types.js";
import { searchPolymarket } from "../sources/polymarket.js";
import { clamp } from "../util.js";

// Research-only heuristic engine. Legacy coefficients are preserved for inspection,
// but no numeric forecast is published without supporting estimation evidence.

export interface Inputs {
  quotes: Record<string, Quote>;
  clusters: EventCluster[];
}

export interface Adjustment {
  logOdds: number;
  driver: string;
}

interface QuestionSpec {
  id: string;
  question: string;
  category: string;
  baseRate: number; // documented approximate historical frequency
  baseRateNote: string;
  polymarketQuery: string | null;
  adjust: (inp: Inputs) => Adjustment[];
}

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function categorySignal(clusters: EventCluster[], catId: string): number {
  // 0..1 intensity of a category in the current event stream
  const relevant = clusters.filter((c) => c.categories.includes(catId));
  if (!relevant.length) return 0;
  const top = Math.max(...relevant.map((c) => c.impactScore));
  const breadth = Math.min(relevant.length / 5, 1);
  return clamp((top / 100) * 0.7 + breadth * 0.3, 0, 1);
}

const QUESTIONS: QuestionSpec[] = [
  {
    id: "us_recession_12m",
    question: "US recession begins within 12 months",
    category: "macro",
    baseRate: 0.15,
    baseRateNote: "US has been in recession ~15% of months since 1950 (NBER)",
    polymarketQuery: "recession",
    adjust: ({ quotes }) => {
      const adj: Adjustment[] = [];
      const us10 = quotes["US10Y"]?.price;
      const us3m = quotes["US3M"]?.price;
      if (us10 != null && us3m != null) {
        const slope = us10 - us3m;
        if (slope < -0.25) adj.push({ logOdds: 0.9, driver: `10Y-3M inverted (${slope.toFixed(2)}pp) — historically precedes recessions by 6-18M` });
        else if (slope < 0.25) adj.push({ logOdds: 0.3, driver: `Curve flat (${slope.toFixed(2)}pp)` });
        else adj.push({ logOdds: -0.3, driver: `Curve positively sloped (${slope.toFixed(2)}pp)` });
      }
      const hy = quotes["HYG"]?.changePct1M;
      const ig = quotes["LQD"]?.changePct1M;
      if (hy != null && ig != null && hy - ig < -2) {
        adj.push({ logOdds: 0.4, driver: `HY underperforming IG by ${(hy - ig).toFixed(1)}pp over 1M — credit sniffing weakness` });
      }
      const vix = quotes["VIX"]?.price;
      if (vix != null && vix > 28) adj.push({ logOdds: 0.3, driver: `VIX ${vix.toFixed(0)} — stress regime raises recession odds` });
      return adj;
    },
  },
  {
    id: "oil_disruption_3m",
    question: "Meaningful oil supply disruption (>2mb/d) within 3 months",
    category: "energy",
    baseRate: 0.08,
    baseRateNote: "Post-1970 frequency of >2mb/d disruptions (EIA history): roughly 1 per 4 years",
    polymarketQuery: "oil",
    adjust: ({ quotes, clusters }) => {
      const adj: Adjustment[] = [];
      const sig = categorySignal(clusters, "oil_supply");
      if (sig > 0.2) adj.push({ logOdds: sig * 1.6, driver: `Live energy-supply event intensity ${(sig * 100).toFixed(0)}/100 in news stream` });
      const war = categorySignal(clusters, "war_escalation");
      if (war > 0.3) adj.push({ logOdds: war * 0.8, driver: `Military escalation signals ${(war * 100).toFixed(0)}/100` });
      const brent = quotes["BRENT"]?.changePct5D;
      if (brent != null && brent > 5) adj.push({ logOdds: 0.5, driver: `Brent +${brent.toFixed(1)}% over 5D — market pricing rising supply risk` });
      const dees = categorySignal(clusters, "ceasefire_deescalation");
      if (dees > 0.3) adj.push({ logOdds: -dees * 0.8, driver: `De-escalation signals present` });
      return adj;
    },
  },
  {
    id: "vix_30_3m",
    question: "VIX closes above 30 within 3 months",
    category: "volatility",
    baseRate: 0.18,
    baseRateNote: "VIX has closed >30 in ~18% of rolling 3M windows since 1990 (CBOE)",
    polymarketQuery: null,
    adjust: ({ quotes, clusters }) => {
      const adj: Adjustment[] = [];
      const vix = quotes["VIX"]?.price;
      if (vix != null) {
        if (vix > 25) adj.push({ logOdds: 1.4, driver: `VIX already ${vix.toFixed(1)} — proximity dominates` });
        else if (vix > 20) adj.push({ logOdds: 0.8, driver: `VIX ${vix.toFixed(1)} elevated` });
        else if (vix < 14) adj.push({ logOdds: -0.5, driver: `VIX ${vix.toFixed(1)} — calm regime, though complacency cuts both ways` });
      }
      const war = categorySignal(clusters, "war_escalation");
      const bank = categorySignal(clusters, "banking_credit_stress");
      if (war > 0.4) adj.push({ logOdds: 0.4, driver: "Elevated geopolitical escalation flow" });
      if (bank > 0.3) adj.push({ logOdds: 0.6, driver: "Banking/credit stress signals in event stream" });
      return adj;
    },
  },
  {
    id: "spx_correction_6m",
    question: "S&P 500 10% correction within 6 months",
    category: "equities",
    baseRate: 0.33,
    baseRateNote: "10% corrections occur roughly every 1.5-2 years historically (~33% per 6M window)",
    polymarketQuery: null,
    adjust: ({ quotes, clusters }) => {
      const adj: Adjustment[] = [];
      const vix = quotes["VIX"]?.price;
      if (vix != null && vix > 22) adj.push({ logOdds: 0.5, driver: `VIX ${vix.toFixed(1)} — vol regime consistent with drawdown risk` });
      const spx = quotes["SPX"];
      if (spx?.changePct1M != null && spx.changePct1M < -5) adj.push({ logOdds: 0.6, driver: `S&P already -${Math.abs(spx.changePct1M).toFixed(1)}% over 1M — momentum negative` });
      const stress = Math.max(categorySignal(clusters, "banking_credit_stress"), categorySignal(clusters, "war_escalation"));
      if (stress > 0.4) adj.push({ logOdds: 0.4, driver: "High-impact stress events in live stream" });
      return adj;
    },
  },
  {
    id: "hormuz_disruption_6m",
    question: "Strait of Hormuz transit materially disrupted within 6 months",
    category: "geopolitics",
    baseRate: 0.03,
    baseRateNote: "Hormuz has never fully closed; tanker-war style partial disruption is the historical precedent (1984-88)",
    polymarketQuery: "hormuz",
    adjust: ({ clusters }) => {
      const adj: Adjustment[] = [];
      const hormuzMentioned = clusters.some(
        (c) => c.impactScore > 50 && /hormuz/i.test(c.headline),
      );
      if (hormuzMentioned) adj.push({ logOdds: 1.2, driver: "Direct Hormuz threat in high-impact event stream" });
      const war = categorySignal(clusters, "war_escalation");
      const oil = categorySignal(clusters, "oil_supply");
      if (war > 0.4 && oil > 0.3) adj.push({ logOdds: 0.7, driver: "Concurrent military escalation + energy supply signals" });
      return adj;
    },
  },
  {
    id: "banking_stress_6m",
    question: "A significant bank failure or credit event within 6 months",
    category: "credit",
    baseRate: 0.1,
    baseRateNote: "Significant institution failures cluster around tightening cycles; unconditional ~10% per 6M window",
    polymarketQuery: null,
    adjust: ({ quotes, clusters }) => {
      const adj: Adjustment[] = [];
      const sig = categorySignal(clusters, "banking_credit_stress");
      if (sig > 0.2) adj.push({ logOdds: sig * 1.8, driver: `Live banking-stress event intensity ${(sig * 100).toFixed(0)}/100` });
      const kre = quotes["KRE"]?.changePct1M;
      if (kre != null && kre < -8) adj.push({ logOdds: 0.7, driver: `Regional banks ${kre.toFixed(1)}% over 1M — equity market pricing stress` });
      const hy = quotes["HYG"]?.changePct1M;
      const ig = quotes["LQD"]?.changePct1M;
      if (hy != null && ig != null && hy - ig < -3) adj.push({ logOdds: 0.5, driver: "HY-IG relative performance deteriorating sharply" });
      return adj;
    },
  },
  {
    id: "gold_ath_3m",
    question: "Gold makes a new all-time high within 3 months",
    category: "commodities",
    baseRate: 0.25,
    baseRateNote: "Conditional on being within 10% of ATH, gold has historically printed new highs in ~25% of 3M windows",
    polymarketQuery: "gold",
    adjust: ({ quotes, clusters }) => {
      const adj: Adjustment[] = [];
      const gold = quotes["GOLD"];
      if (gold?.changePct1M != null && gold.changePct1M > 3) adj.push({ logOdds: 0.6, driver: `Gold +${gold.changePct1M.toFixed(1)}% over 1M — momentum positive` });
      if (gold?.changePct1M != null && gold.changePct1M < -3) adj.push({ logOdds: -0.6, driver: `Gold ${gold.changePct1M.toFixed(1)}% over 1M — momentum negative` });
      const war = categorySignal(clusters, "war_escalation");
      if (war > 0.4) adj.push({ logOdds: 0.3, driver: "Geopolitical haven demand signals" });
      return adj;
    },
  },
];

// No mutable probability snapshot cache: unsupported estimates must not generate
// forecast-change or mispricing signals.
const pmCache = new Map<string, { prob: number | null; label?: string; fetchedAt: number }>();
const PM_TTL = 10 * 60 * 1000;

async function getPredictionMarket(query: string | null): Promise<{ prob: number | null; label?: string }> {
  if (!query) return { prob: null };
  const cached = pmCache.get(query);
  if (cached && Date.now() - cached.fetchedAt < PM_TTL) return cached;
  try {
    const res = await searchPolymarket(query);
    const prob = res?.yesProb;
    const entry = {
      prob: prob != null && Number.isFinite(prob) && prob >= 0 && prob <= 1 ? prob : null,
      label: res?.question,
      fetchedAt: Date.now(),
    };
    pmCache.set(query, entry);
    return entry;
  } catch {
    return { prob: null }; // Never relabel an expired market observation as current.
  }
}

export interface ProbabilityDependencies {
  now?: Date;
  marketLookup?: (query: string | null) => Promise<{ prob: number | null; label?: string }>;
}

/** Deterministic, reproducible legacy calculation; NOT a fitted probability model. */
export function calculateHeuristic(baseRate: number, adjustments: Adjustment[]): number {
  if (!Number.isFinite(baseRate) || baseRate <= 0 || baseRate >= 1 ||
      adjustments.some((a) => !Number.isFinite(a.logOdds))) {
    throw new Error("Invalid heuristic inputs");
  }
  return clamp(sigmoid(logit(baseRate) + adjustments.reduce((sum, a) => sum + a.logOdds, 0)), 0.01, 0.97);
}

export async function computeProbabilities(
  inputs: Inputs,
  dependencies: ProbabilityDependencies = {},
): Promise<ProbabilityEstimate[]> {
  const now = dependencies.now ?? new Date();
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error("Invalid estimation time");
  const marketLookup = dependencies.marketLookup ?? getPredictionMarket;
  // Conservative common freshness ceiling. Exchange-calendar-specific freshness
  // and separate history timestamps remain prerequisites for validated models.
  const quotes = Object.fromEntries(Object.entries(inputs.quotes).filter(([, q]) => {
    const age = nowMs - Date.parse(q.asOf);
    return !q.stale && Number.isFinite(age) && age >= 0 && age <= 72 * 3600_000 &&
      [q.price, q.changePct1D, q.changePct5D, q.changePct1M, q.changePctYTD].every(
        (v) => v === null || Number.isFinite(v),
      );
  }));
  const clusters = inputs.clusters.filter((c) => {
    const age = nowMs - Date.parse(c.lastUpdate);
    return Number.isFinite(age) && age >= 0 && age <= 36 * 3600_000 &&
      Number.isFinite(c.impactScore) && c.impactScore >= 0 && c.impactScore <= 100;
  });
  // Copy exact information consumed so later state mutation cannot alter lineage.
  const inputSnapshot = {
    quotes: Object.values(quotes).map((q) => ({
      id: q.id, source: q.source, asOf: q.asOf, price: q.price,
      changePct1M: q.changePct1M, changePct5D: q.changePct5D,
    })),
    events: clusters.map((c) => ({
      id: c.id, headline: c.headline, lastUpdate: c.lastUpdate,
      categories: [...c.categories], impactScore: c.impactScore,
      sources: c.items.map((item) => ({ url: item.url, source: item.source, publishedAt: item.publishedAt })),
    })),
    excludedQuotes: Object.keys(inputs.quotes).filter((id) => !quotes[id]),
    excludedEvents: inputs.clusters.filter((c) => !clusters.includes(c)).map((c) => c.id),
  };

  return Promise.all(QUESTIONS.map(async (spec): Promise<ProbabilityEstimate> => {
    const adjustments = spec.adjust({ quotes, clusters });
    // Related markets are retained as research context, never compared as identical contracts.
    let pm: { prob: number | null; label?: string } = { prob: null };
    try { pm = await marketLookup(spec.polymarketQuery); } catch { /* Provider unavailable. */ }
    const relatedPrice = pm.prob != null && Number.isFinite(pm.prob) && pm.prob >= 0 && pm.prob <= 1
      ? pm.prob : null;
    return {
      id: spec.id, question: spec.question, category: spec.category,
      model: null, baseRate: null, predictionMarket: null,
      change24h: null, divergence: null,
      drivers: adjustments.map((a) => a.driver),
      asOf: now.toISOString(),
      methodology: "Research heuristic v1: sigmoid(logit(prior) + sum(log-odds adjustments)), clipped to [0.01, 0.97]. Prior and coefficients are hand-set, not statistically estimated.",
      evidence: {
        status: "insufficient_evidence", validation: "not_evaluated",
        reason: "No reproducible target-matched base-rate dataset, fitted adjustments, or out-of-sample evaluation is available. Numeric forecast withheld.",
        uncertaintyInterval: null,
        comparisonStatus: "unmatched_contract",
        comparisonReason: "Keyword search does not verify the outcome definition, resolution rules, or horizon. No mispricing inference is supported.",
      },
      research: {
        version: "legacy-log-odds-v1", prior: spec.baseRate,
        priorClaim: spec.baseRateNote,
        adjustments: adjustments.map((a) => ({ ...a })),
        diagnosticValue: calculateHeuristic(spec.baseRate, adjustments),
        inputs: structuredClone(inputSnapshot),
        relatedMarket: relatedPrice == null ? null : { question: pm.label ?? "Unknown contract", price: relatedPrice },
      },
    };
  }));
}

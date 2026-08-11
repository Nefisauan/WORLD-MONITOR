import fs from "node:fs";
import path from "node:path";
import type { EventCluster, ProbabilityEstimate, Quote } from "../types.js";
import { searchPolymarket } from "../sources/polymarket.js";
import { clamp } from "../util.js";

// Probability engine. Every estimate starts from a documented historical base
// rate and applies transparent log-odds adjustments from live market/event
// signals. Prediction-market quotes are shown side-by-side; the divergence is
// itself a signal ("mispricing radar"). Estimates are forecasts, not facts.

interface Inputs {
  quotes: Record<string, Quote>;
  clusters: EventCluster[];
}

interface Adjustment {
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

// ---- 24h snapshot persistence for change tracking + prediction ledger ----

const CACHE_DIR = path.resolve(process.cwd(), ".cache");
const SNAP_FILE = path.join(CACHE_DIR, "probability-snapshots.json");

interface Snapshot {
  ts: number;
  values: Record<string, number>;
}

function loadSnapshots(): Snapshot[] {
  try {
    return JSON.parse(fs.readFileSync(SNAP_FILE, "utf8")) as Snapshot[];
  } catch {
    return [];
  }
}

function saveSnapshots(snaps: Snapshot[]) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(SNAP_FILE, JSON.stringify(snaps.slice(-500)));
  } catch {
    // non-fatal
  }
}

const pmCache = new Map<string, { prob: number | null; label?: string; fetchedAt: number }>();
const PM_TTL = 10 * 60 * 1000;

async function getPredictionMarket(query: string | null): Promise<{ prob: number | null; label?: string }> {
  if (!query) return { prob: null };
  const cached = pmCache.get(query);
  if (cached && Date.now() - cached.fetchedAt < PM_TTL) return cached;
  try {
    const res = await searchPolymarket(query);
    const entry = { prob: res?.yesProb ?? null, label: res?.question, fetchedAt: Date.now() };
    pmCache.set(query, entry);
    return entry;
  } catch {
    return cached ?? { prob: null };
  }
}

export async function computeProbabilities(inputs: Inputs): Promise<ProbabilityEstimate[]> {
  const snaps = loadSnapshots();
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const reference = [...snaps].reverse().find((s) => s.ts <= dayAgo) ?? snaps[0];

  const out: ProbabilityEstimate[] = [];
  const currentValues: Record<string, number> = {};

  for (const spec of QUESTIONS) {
    const adjustments = spec.adjust(inputs);
    const totalLogOdds = logit(spec.baseRate) + adjustments.reduce((a, b) => a + b.logOdds, 0);
    const model = clamp(sigmoid(totalLogOdds), 0.01, 0.97);
    currentValues[spec.id] = model;

    const pm = await getPredictionMarket(spec.polymarketQuery);
    const refVal = reference?.values[spec.id];

    out.push({
      id: spec.id,
      question: spec.question,
      category: spec.category,
      model,
      predictionMarket: pm.prob,
      predictionMarketLabel: pm.label,
      baseRate: spec.baseRate,
      change24h: refVal != null ? Math.round((model - refVal) * 1000) / 10 : null,
      drivers: adjustments.length
        ? adjustments.map((a) => `${a.logOdds >= 0 ? "+" : "−"} ${a.driver}`)
        : ["No live signals deviating from base rate"],
      divergence: pm.prob != null ? Math.abs(model - pm.prob) : null,
      asOf: new Date().toISOString(),
      methodology: `Base rate ${(spec.baseRate * 100).toFixed(0)}% (${spec.baseRateNote}); log-odds adjustments from live signals listed under drivers.`,
    });
  }

  snaps.push({ ts: Date.now(), values: currentValues });
  saveSnapshots(snaps);

  return out.sort((a, b) => (b.divergence ?? 0) - (a.divergence ?? 0));
}

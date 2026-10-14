import type { Quote, RegimeState } from "../types.js";

// Market regime classifier. Deterministic scoring over live cross-asset
// signals; every input is shown to the user. This is an inference, not a fact.

interface Signal {
  name: string;
  value: string;
  reading: string;
  weight: number;
  votes: Partial<Record<Regime, number>>;
}

type Regime = "Risk-On" | "Risk-Off" | "Inflationary" | "Stagflationary" | "Stress" | "Crisis" | "Neutral";

const REGIMES: Regime[] = ["Risk-On", "Risk-Off", "Inflationary", "Stagflationary", "Stress", "Crisis", "Neutral"];

export function classifyRegime(quotes: Record<string, Quote>, previous: RegimeState | null): RegimeState | null {
  const q = (id: string) => quotes[id];
  const signals: Signal[] = [];

  const vix = q("VIX");
  if (vix?.price != null) {
    const lvl = vix.price;
    signals.push({
      name: "VIX level",
      value: lvl.toFixed(1),
      reading: lvl < 15 ? "complacent/calm" : lvl < 20 ? "normal" : lvl < 28 ? "elevated" : lvl < 40 ? "stress" : "crisis",
      weight: 3,
      votes:
        lvl < 15 ? { "Risk-On": 3 }
        : lvl < 20 ? { Neutral: 2, "Risk-On": 1 }
        : lvl < 28 ? { "Risk-Off": 2, Stress: 1 }
        : lvl < 40 ? { Stress: 3, "Risk-Off": 1 }
        : { Crisis: 4 },
    });
  }

  const us10 = q("US10Y");
  const us3m = q("US3M");
  if (us10?.price != null && us3m?.price != null) {
    const slope = us10.price - us3m.price;
    signals.push({
      name: "Curve (10Y-3M)",
      value: `${slope >= 0 ? "+" : ""}${slope.toFixed(2)}pp`,
      reading: slope < -0.25 ? "inverted (recession signal)" : slope < 0.25 ? "flat" : "positively sloped",
      weight: 2,
      votes: slope < -0.25 ? { "Risk-Off": 1, Stress: 1 } : slope > 0.75 ? { "Risk-On": 1 } : { Neutral: 1 },
    });
  }

  const gold = q("GOLD");
  const spx = q("SPX");
  if (gold?.changePct1M != null && spx?.changePct1M != null) {
    const diff = gold.changePct1M - spx.changePct1M;
    signals.push({
      name: "Gold vs equities (1M)",
      value: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}pp`,
      reading: diff > 4 ? "haven leadership" : diff < -4 ? "risk leadership" : "balanced",
      weight: 2,
      votes: diff > 4 ? { "Risk-Off": 2, Stagflationary: 1 } : diff < -4 ? { "Risk-On": 2 } : { Neutral: 1 },
    });
  }

  const oil = q("WTI");
  const copper = q("COPPER");
  if (oil?.changePct1M != null && copper?.changePct1M != null) {
    const cmdty = (oil.changePct1M + copper.changePct1M) / 2;
    const growthDrag = spx?.changePct1M != null && spx.changePct1M < 0;
    signals.push({
      name: "Commodity impulse (1M)",
      value: `${cmdty >= 0 ? "+" : ""}${cmdty.toFixed(1)}%`,
      reading: cmdty > 5 ? (growthDrag ? "supply-shock pattern" : "reflation") : cmdty < -5 ? "demand weakness" : "quiet",
      weight: 2,
      votes:
        cmdty > 5 ? (growthDrag ? { Stagflationary: 3 } : { Inflationary: 2, "Risk-On": 1 })
        : cmdty < -5 ? { "Risk-Off": 1 }
        : { Neutral: 1 },
    });
  }

  const hyg = q("HYG");
  const lqd = q("LQD");
  if (hyg?.changePct1M != null && lqd?.changePct1M != null) {
    const ratio = hyg.changePct1M - lqd.changePct1M;
    signals.push({
      name: "HY vs IG credit (1M)",
      value: `${ratio >= 0 ? "+" : ""}${ratio.toFixed(1)}pp`,
      reading: ratio < -2 ? "credit stress building" : ratio > 1 ? "credit risk appetite" : "stable",
      weight: 2,
      votes: ratio < -2 ? { Stress: 2, "Risk-Off": 1 } : ratio > 1 ? { "Risk-On": 2 } : { Neutral: 1 },
    });
  }

  const dxy = q("DXY");
  if (dxy?.changePct1M != null) {
    signals.push({
      name: "USD trend (1M)",
      value: `${dxy.changePct1M >= 0 ? "+" : ""}${dxy.changePct1M.toFixed(1)}%`,
      reading: dxy.changePct1M > 2 ? "dollar tightening impulse" : dxy.changePct1M < -2 ? "dollar easing tailwind" : "range",
      weight: 1,
      votes: dxy.changePct1M > 2 ? { "Risk-Off": 1 } : dxy.changePct1M < -2 ? { "Risk-On": 1 } : { Neutral: 1 },
    });
  }

  const btc = q("BTC");
  if (btc?.changePct1M != null && spx?.changePct1M != null) {
    signals.push({
      name: "Liquidity proxies (BTC 1M)",
      value: `${btc.changePct1M >= 0 ? "+" : ""}${btc.changePct1M.toFixed(1)}%`,
      reading: btc.changePct1M > 10 ? "liquidity expanding" : btc.changePct1M < -15 ? "liquidity contracting" : "neutral",
      weight: 1,
      votes: btc.changePct1M > 10 ? { "Risk-On": 1 } : btc.changePct1M < -15 ? { "Risk-Off": 1 } : { Neutral: 1 },
    });
  }

  // Breadth across sector ETFs (1D)
  const sectors = Object.values(quotes).filter((x) => x.cls === "sector" && x.changePct1D != null);
  if (sectors.length >= 6) {
    const up = sectors.filter((s) => (s.changePct1D ?? 0) > 0).length;
    const pct = (up / sectors.length) * 100;
    signals.push({
      name: "Sector breadth (1D)",
      value: `${up}/${sectors.length} up`,
      reading: pct > 70 ? "broad advance" : pct < 30 ? "broad decline" : "mixed",
      weight: 1,
      votes: pct > 70 ? { "Risk-On": 1 } : pct < 30 ? { "Risk-Off": 1 } : { Neutral: 1 },
    });
  }

  if (!signals.length) return null;

  const scores: Record<string, number> = Object.fromEntries(REGIMES.map((r) => [r, 0]));
  let totalWeight = 0;
  for (const s of signals) {
    totalWeight += s.weight;
    for (const [regime, v] of Object.entries(s.votes)) {
      scores[regime] += (v ?? 0) * s.weight;
    }
  }

  let best: Regime = "Neutral";
  let bestScore = -1;
  for (const r of REGIMES) {
    if (scores[r] > bestScore) {
      best = r;
      bestScore = scores[r];
    }
  }
  const totalVotes = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const confidence = Math.round((bestScore / totalVotes) * 100);

  return {
    regime: best,
    confidence,
    scores,
    signals: signals.map(({ name, value, reading, weight }) => ({ name, value, reading, weight })),
    previous: previous && previous.regime !== best ? previous.regime : previous?.previous ?? null,
    asOf: new Date().toISOString(),
  };
}

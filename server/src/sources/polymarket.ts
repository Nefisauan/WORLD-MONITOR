import { fetchJson } from "../util.js";

// Polymarket Gamma API (keyless, read-only) for prediction-market probabilities.

interface GammaMarket {
  question: string;
  outcomes: string; // JSON array string
  outcomePrices: string; // JSON array string
  volume?: string;
  slug: string;
  endDate?: string;
  closed?: boolean;
}

export interface PredictionQuote {
  question: string;
  yesProb: number; // 0-1
  slug: string;
  volume: number;
}

/** Search active markets matching a text query; returns best (highest-volume) match. */
export async function searchPolymarket(query: string): Promise<PredictionQuote | null> {
  const url =
    "https://gamma-api.polymarket.com/markets?closed=false&limit=20&order=volume&ascending=false&title_contains=" +
    encodeURIComponent(query);
  const markets = await fetchJson<GammaMarket[]>(url, { timeoutMs: 10_000 });
  for (const m of markets) {
    try {
      const outcomes: string[] = JSON.parse(m.outcomes);
      const prices: string[] = JSON.parse(m.outcomePrices);
      const yesIdx = outcomes.findIndex((o) => o.toLowerCase() === "yes");
      if (yesIdx === -1) continue;
      const p = parseFloat(prices[yesIdx]);
      if (!isFinite(p)) continue;
      return {
        question: m.question,
        yesProb: p,
        slug: m.slug,
        volume: parseFloat(m.volume ?? "0") || 0,
      };
    } catch {
      continue;
    }
  }
  return null;
}

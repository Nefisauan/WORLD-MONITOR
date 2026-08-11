import { fetchJson } from "../util.js";

// Yahoo Finance v8 chart API (keyless). One request per symbol; we batch with
// a small concurrency pool at the call site.

interface YahooChartResponse {
  chart: {
    result?: {
      meta: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketTime?: number;
      };
      timestamp?: number[];
      indicators: { quote: { close?: (number | null)[] }[] };
    }[];
    error?: { code: string; description: string } | null;
  };
}

export interface YahooSeries {
  price: number | null;
  previousClose: number | null;
  closes: number[]; // valid closes only
  timestamps: number[]; // matching timestamps (s)
  asOf: number | null; // epoch seconds
}

const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

export async function yahooChart(
  symbol: string,
  range: string,
  interval: string,
): Promise<YahooSeries> {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  let lastErr: unknown;
  for (const host of HOSTS) {
    try {
      const data = await fetchJson<YahooChartResponse>(host + path, {
        headers: { accept: "application/json" },
      });
      const result = data.chart.result?.[0];
      if (!result) throw new Error(data.chart.error?.description ?? "empty chart result");
      const rawCloses = result.indicators.quote[0]?.close ?? [];
      const rawTs = result.timestamp ?? [];
      const closes: number[] = [];
      const timestamps: number[] = [];
      for (let i = 0; i < rawCloses.length; i++) {
        const c = rawCloses[i];
        if (c != null && isFinite(c)) {
          closes.push(c);
          timestamps.push(rawTs[i] ?? 0);
        }
      }
      return {
        price: result.meta.regularMarketPrice ?? closes[closes.length - 1] ?? null,
        previousClose: result.meta.chartPreviousClose ?? result.meta.previousClose ?? null,
        closes,
        timestamps,
        asOf: result.meta.regularMarketTime ?? null,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

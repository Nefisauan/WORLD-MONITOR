import { fetchJson } from "../util.js";

// Binance public market data (keyless). Falls back through mirror hosts.

const HOSTS = ["https://api.binance.com", "https://data-api.binance.vision"];

export interface BinanceQuote {
  price: number;
  changePct1D: number;
  asOf: number; // ms
}

export async function binanceTicker(symbol: string): Promise<BinanceQuote> {
  let lastErr: unknown;
  for (const host of HOSTS) {
    try {
      const t = await fetchJson<{ lastPrice: string; priceChangePercent: string; closeTime: number }>(
        `${host}/api/v3/ticker/24hr?symbol=${symbol}`,
      );
      return {
        price: parseFloat(t.lastPrice),
        changePct1D: parseFloat(t.priceChangePercent),
        asOf: t.closeTime,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/** Daily closes (1d klines) for history; and 15m klines for intraday spark. */
export async function binanceKlines(
  symbol: string,
  interval: string,
  limit: number,
): Promise<{ closes: number[]; timestamps: number[] }> {
  let lastErr: unknown;
  for (const host of HOSTS) {
    try {
      const rows = await fetchJson<unknown[][]>(
        `${host}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      );
      const closes: number[] = [];
      const timestamps: number[] = [];
      for (const r of rows) {
        const c = parseFloat(r[4] as string);
        if (isFinite(c)) {
          closes.push(c);
          timestamps.push((r[0] as number) / 1000);
        }
      }
      return { closes, timestamps };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

import type { Instrument, Quote } from "../types.js";
import { INSTRUMENTS } from "../knowledge/instruments.js";
import { yahooChart } from "../sources/yahoo.js";
import { binanceKlines, binanceTicker } from "../sources/binance.js";
import { downsample, mean, pctChange, pool, stdev } from "../util.js";

// Quote engine: fetches prices, computes horizon returns, realized vol, and
// z-scores of today's move against the trailing 1y daily-return distribution.

interface HistoryCacheEntry {
  closes: number[];
  timestamps: number[];
  fetchedAt: number;
}

const historyCache = new Map<string, HistoryCacheEntry>();
const HISTORY_TTL_MS = 60 * 60 * 1000; // refresh daily history hourly

async function getDailyHistory(inst: Instrument): Promise<HistoryCacheEntry | null> {
  const cached = historyCache.get(inst.id);
  if (cached && Date.now() - cached.fetchedAt < HISTORY_TTL_MS) return cached;
  try {
    let closes: number[] = [];
    let timestamps: number[] = [];
    if (inst.provider === "binance") {
      const k = await binanceKlines(inst.symbol, "1d", 365);
      closes = k.closes;
      timestamps = k.timestamps;
    } else {
      const s = await yahooChart(inst.symbol, "1y", "1d");
      closes = s.closes;
      timestamps = s.timestamps;
    }
    if (closes.length < 30) return cached ?? null;
    const entry = { closes, timestamps, fetchedAt: Date.now() };
    historyCache.set(inst.id, entry);
    return entry;
  } catch {
    return cached ?? null;
  }
}

function dailyReturns(closes: number[]): number[] {
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] !== 0) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return rets;
}

function ytdStartIndex(timestamps: number[]): number {
  const year = new Date().getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1) / 1000;
  for (let i = 0; i < timestamps.length; i++) {
    if (timestamps[i] >= jan1) return Math.max(0, i - 1);
  }
  return 0;
}

async function buildQuote(inst: Instrument): Promise<Quote | null> {
  const hist = await getDailyHistory(inst);

  let price: number | null = null;
  let changePct1D: number | null = null;
  let spark: number[] = [];
  let asOfSec: number | null = null;

  try {
    if (inst.provider === "binance") {
      const [ticker, intraday] = await Promise.all([
        binanceTicker(inst.symbol),
        binanceKlines(inst.symbol, "15m", 96),
      ]);
      price = ticker.price;
      changePct1D = ticker.changePct1D;
      spark = downsample(intraday.closes, 60);
      asOfSec = ticker.asOf / 1000;
    } else {
      const s = await yahooChart(inst.symbol, "1d", "5m");
      price = s.price;
      asOfSec = s.asOf;
      spark = downsample(s.closes, 60);
      if (price != null && s.previousClose != null) {
        changePct1D = pctChange(s.previousClose, price);
      }
    }
  } catch {
    // fall through: may still serve horizon stats from history
  }

  if (price == null && hist) price = hist.closes[hist.closes.length - 1] ?? null;
  if (price == null) return null;

  let changePct5D: number | null = null;
  let changePct1M: number | null = null;
  let changePctYTD: number | null = null;
  let zScore1D: number | null = null;
  let vol30D: number | null = null;
  let dailySpark: number[] = [];

  if (hist) {
    const { closes, timestamps } = hist;
    const n = closes.length;
    if (n > 5) changePct5D = pctChange(closes[n - 6], price);
    if (n > 21) changePct1M = pctChange(closes[n - 22], price);
    changePctYTD = pctChange(closes[ytdStartIndex(timestamps)], price);
    dailySpark = downsample(closes, 120);

    const rets = dailyReturns(closes);
    const sd = stdev(rets);
    const mu = mean(rets);
    if (sd > 0 && changePct1D != null) {
      zScore1D = (changePct1D / 100 - mu) / sd;
    }
    const recent = rets.slice(-30);
    if (recent.length >= 10) {
      vol30D = stdev(recent) * Math.sqrt(252) * 100;
    }
  }

  const stale = asOfSec != null ? Date.now() / 1000 - asOfSec > 3 * 86_400 : false;

  return {
    id: inst.id,
    name: inst.name,
    cls: inst.cls,
    group: inst.group,
    price,
    changePct1D,
    changePct5D,
    changePct1M,
    changePctYTD,
    spark,
    dailySpark,
    zScore1D,
    vol30D,
    unusual: zScore1D != null && Math.abs(zScore1D) >= 2,
    stale,
    asOf: new Date((asOfSec ?? Date.now() / 1000) * 1000).toISOString(),
    source: inst.provider === "binance" ? "Binance" : "Yahoo Finance",
  };
}

export async function refreshQuotes(): Promise<Record<string, Quote>> {
  const results = await pool(
    INSTRUMENTS.map((inst) => () => buildQuote(inst)),
    8,
  );
  const out: Record<string, Quote> = {};
  results.forEach((q) => {
    if (q) out[q.id] = q;
  });
  return out;
}

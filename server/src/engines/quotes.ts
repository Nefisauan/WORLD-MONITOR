import type { Instrument, Quote } from "../types.js";
import { INSTRUMENTS } from "../knowledge/instruments.js";
import { yahooChart } from "../sources/yahoo.js";
import { binanceKlines, binanceTicker } from "../sources/binance.js";
import { downsample, mean, pctChange, pool, stdev } from "../util.js";

// Quote engine: fetches prices, computes horizon returns, realized vol, and
// z-scores of today's move against the trailing 1y daily-return distribution.

export interface HistoryCacheEntry {
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

function ytdStartIndex(timestamps: number[], now: number): number {
  const year = new Date(now).getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1) / 1000;
  for (let i = 0; i < timestamps.length; i++) {
    if (timestamps[i] >= jan1) return Math.max(0, i - 1);
  }
  return 0;
}

export interface QuoteDependencies {
  now?: () => number;
  history?: (inst: Instrument) => Promise<HistoryCacheEntry | null>;
  chart?: typeof yahooChart;
  ticker?: typeof binanceTicker;
  klines?: typeof binanceKlines;
}

export async function buildQuote(inst: Instrument, deps: QuoteDependencies = {}): Promise<Quote | null> {
  const clock = deps.now ?? Date.now;
  const rawHistory = await (deps.history ?? getDailyHistory)(inst);
  const historyCutoff = clock() / 1000;
  // Preserve matched observations, reject invalid/future or unordered bars.
  const hist = rawHistory ? { ...rawHistory, closes: [] as number[], timestamps: [] as number[] } : null;
  rawHistory?.closes.forEach((value, i) => {
    const ts = rawHistory.timestamps[i];
    if (hist && Number.isFinite(value) && Number.isFinite(ts) && ts > 0 && ts <= historyCutoff &&
        (!hist.timestamps.length || ts > hist.timestamps[hist.timestamps.length - 1])) {
      hist.closes.push(value); hist.timestamps.push(ts);
    }
  });

  let price: number | null = null;
  let changePct1D: number | null = null;
  let spark: number[] = [];
  let asOfSec: number | null = null;

  try {
    if (inst.provider === "binance") {
      const [ticker, intraday] = await Promise.all([
        (deps.ticker ?? binanceTicker)(inst.symbol),
        (deps.klines ?? binanceKlines)(inst.symbol, "15m", 96).catch(() => ({ closes: [], timestamps: [] })),
      ]);
      price = ticker.price;
      changePct1D = ticker.changePct1D;
      spark = downsample(intraday.closes, 60);
      asOfSec = ticker.asOf / 1000;
    } else {
      const s = await (deps.chart ?? yahooChart)(inst.symbol, "1d", "5m");
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

  const now = clock();
  let priceKind: Quote["priceKind"] = "provider_quote";
  if (price == null || !Number.isFinite(price) || asOfSec == null || !Number.isFinite(asOfSec) || asOfSec <= 0 || asOfSec > now / 1000) {
    price = hist?.closes.at(-1) ?? null;
    asOfSec = hist?.timestamps.at(-1) ?? null;
    priceKind = "historical_fallback";
    changePct1D = null;
    spark = [];
  }
  if (price == null || asOfSec == null) return null;
  if (changePct1D != null && !Number.isFinite(changePct1D)) changePct1D = null;
  spark = spark.filter(Number.isFinite);
  const historyAsOf = hist?.timestamps.at(-1);
  const historyStale = !hist || !Number.isFinite(hist.fetchedAt) || hist.fetchedAt > now || now - hist.fetchedAt > HISTORY_TTL_MS ||
    historyAsOf == null || now / 1000 - historyAsOf > 3 * 86_400;

  let changePct5D: number | null = null;
  let changePct1M: number | null = null;
  let changePctYTD: number | null = null;
  let zScore1D: number | null = null;
  let vol30D: number | null = null;
  let dailySpark: number[] = [];

  if (hist && hist.closes.length && !historyStale) {
    const { closes, timestamps } = hist;
    const n = closes.length;
    if (n > 5) changePct5D = pctChange(closes[n - 6], price);
    if (n > 21) changePct1M = pctChange(closes[n - 22], price);
    changePctYTD = pctChange(closes[ytdStartIndex(timestamps, now)], price);
    dailySpark = downsample(closes, 120);

    const rets = dailyReturns(closes);
    const sd = stdev(rets);
    const mu = mean(rets);
    if (sd > 0 && changePct1D != null) {
      zScore1D = (changePct1D / 100 - mu) / sd;
    }
    const recent = rets.slice(-30);
    if (recent.length >= 10) {
      vol30D = stdev(recent) * Math.sqrt(inst.provider === "binance" ? 365 : 252) * 100;
    }
  }

  const stale = priceKind === "historical_fallback" || now / 1000 - asOfSec >
    (inst.provider === "binance" ? 15 * 60 : 3 * 86_400);

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
    unusual: !stale && zScore1D != null && Math.abs(zScore1D) >= 2,
    stale,
    asOf: new Date(asOfSec * 1000).toISOString(),
    retrievedAt: new Date(now).toISOString(),
    priceKind,
    historyAsOf: historyAsOf != null ? new Date(historyAsOf * 1000).toISOString() : null,
    historyStale,
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

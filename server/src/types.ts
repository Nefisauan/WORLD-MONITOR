// Shared domain types for the World Intel server.

export type AssetClass =
  | "equity_index"
  | "rate"
  | "fx"
  | "crypto"
  | "commodity"
  | "credit"
  | "sector";

export interface Instrument {
  id: string; // internal id, e.g. "SPX"
  symbol: string; // provider symbol, e.g. "^GSPC"
  provider: "yahoo" | "binance";
  name: string;
  cls: AssetClass;
  group: string; // display grouping, e.g. "US Equities", "Energy"
  unit?: string; // "%", "$", "bp"
  // Exposure tags used to match events to assets, e.g. ["oil", "energy"]
  tags: string[];
}

export interface Quote {
  retrievedAt: string;
  priceKind: "provider_quote" | "historical_fallback";
  historyAsOf: string | null;
  historyStale: boolean;
  id: string;
  name: string;
  cls: AssetClass;
  group: string;
  price: number | null;
  changePct1D: number | null;
  changePct5D: number | null;
  changePct1M: number | null;
  changePctYTD: number | null;
  // Intraday sparkline (last session), sampled
  spark: number[];
  // Daily closes for ~1y, sampled for client-side charts
  dailySpark: number[];
  // Statistical context
  zScore1D: number | null; // today's move vs 1y daily return distribution
  vol30D: number | null; // annualized 30d realized vol, %
  unusual: boolean;
  stale: boolean;
  asOf: string; // ISO timestamp
  source: string;
}

export interface NewsItem {
  detectedAt: string; // Retrieval time, never substituted for publication time.
  id: string;
  title: string;
  url: string;
  source: string;
  sourceTier: number; // 1 = wire/official ... 4 = other
  publishedAt: string;
  categories: string[];
}

export interface EventCluster {
  id: string;
  headline: string; // representative title
  categories: string[];
  items: NewsItem[];
  sourceCount: number;
  firstSeen: string;
  lastUpdate: string;
  impactScore: number; // 0-100
  impactBreakdown: Record<string, number>;
  credibility: number; // 0-100
  countries: string[]; // ISO2 codes detected
  exposures: ExposureEntry[];
  transmission: TransmissionNode[] | null;
  analogues: AnalogueMatch[];
}

export interface ExposureEntry {
  target: string; // asset/sector/theme label
  direction: 1 | -1 | 0; // expected pressure direction
  strength: 1 | 2 | 3;
  note?: string;
}

export interface TransmissionNode {
  stage: string; // e.g. "FIRST-ORDER", "COMMODITY", "MACRO"
  label: string;
  detail: string;
  direction?: 1 | -1 | 0;
  children?: TransmissionNode[];
}

export interface AnalogueMatch {
  episodeId: string;
  name: string;
  year: number;
  similarity: number; // 0-1
  summary: string;
  outcomes: HistoricalOutcome[];
}

export interface HistoricalOutcome {
  asset: string;
  horizon: string; // "1M", "3M", "12M"
  movePct: number;
  note?: string;
}

export interface ProbabilityEstimate {
  evidence: {
    status: "insufficient_evidence";
    validation: "not_evaluated";
    reason: string;
    uncertaintyInterval: null;
    comparisonStatus: "unmatched_contract";
    comparisonReason: string;
  };
  research: {
    version: "legacy-log-odds-v1";
    prior: number;
    priorClaim: string;
    adjustments: { logOdds: number; driver: string }[];
    diagnosticValue: number; // Internal research output, not a supported forecast.
    inputs: {
      quotes: { id: string; source: string; asOf: string; price: number | null; changePct1M: number | null; changePct5D: number | null }[];
      events: { id: string; headline: string; lastUpdate: string; categories: string[]; impactScore: number; sources: { url: string; source: string; publishedAt: string }[] }[];
      excludedQuotes: string[];
      excludedEvents: string[];
    };
    relatedMarket: { question: string; price: number } | null;
  };

  id: string;
  question: string;
  category: string;
  model: number | null; // 0-1, deterministic model estimate
  predictionMarket: number | null; // 0-1, from Polymarket
  predictionMarketLabel?: string;
  baseRate: number | null; // 0-1 historical frequency
  change24h: number | null; // percentage-point delta of model estimate
  drivers: string[]; // human-readable driver notes
  divergence: number | null; // |model - predictionMarket|
  asOf: string;
  methodology: string;
}

export interface RegimeState {
  regime: string;
  confidence: number; // 0-100
  scores: Record<string, number>; // regime -> score
  signals: { name: string; value: string; reading: string; weight: number }[];
  previous: string | null;
  asOf: string;
}

export interface MapPoint {
  id: string;
  kind: "event" | "quake" | "chokepoint" | "conflict";
  lat: number;
  lon: number;
  label: string;
  detail: string;
  intensity: number; // 0-1
  url?: string;
  categories?: string[];
}

export interface CalendarEvent {
  id: string;
  date: string; // ISO date
  time?: string; // local release time note
  name: string;
  country: string;
  importance: number; // 0-100
  assets: string[];
  typicalReaction: string;
  source: string;
}

export interface AlertItem {
  id: string;
  ts: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  kind: string; // "unusual_move" | "event" | "regime_change" | "probability_shift"
}

export interface CountryRisk {
  iso2: string;
  name: string;
  overall: number; // 0-100
  components: Record<string, number>;
  marketsCare: string[];
  newsVelocity: number; // live article count factor
}

export interface GlobalState {
  quotes: Record<string, Quote>;
  clusters: EventCluster[];
  probabilities: ProbabilityEstimate[];
  regime: RegimeState | null;
  mapPoints: MapPoint[];
  calendar: CalendarEvent[];
  alerts: AlertItem[];
  countryRisk: CountryRisk[];
  globalRiskScore: number | null;
  riskDrivers: { name: string; delta: number }[];
  dataHealth: Record<string, { ok: boolean; lastSuccess: string | null; note?: string }>;
}

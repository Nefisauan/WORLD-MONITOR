// Mirrors server/src/types.ts (client view of the API).

export interface Quote {
  retrievedAt: string;
  priceKind: "provider_quote" | "historical_fallback";
  historyAsOf: string | null;
  historyStale: boolean;
  id: string;
  name: string;
  cls: string;
  group: string;
  price: number | null;
  changePct1D: number | null;
  changePct5D: number | null;
  changePct1M: number | null;
  changePctYTD: number | null;
  spark: number[];
  dailySpark: number[];
  zScore1D: number | null;
  vol30D: number | null;
  unusual: boolean;
  stale: boolean;
  asOf: string;
  source: string;
}

export interface NewsItem {
  detectedAt: string; // Retrieval time, never substituted for publication time.
  id: string;
  title: string;
  url: string;
  source: string;
  sourceTier: number;
  publishedAt: string;
  categories: string[];
}

export interface ExposureEntry {
  target: string;
  direction: 1 | -1 | 0;
  strength: 1 | 2 | 3;
  note?: string;
}

export interface TransmissionNode {
  stage: string;
  label: string;
  detail: string;
  direction?: 1 | -1 | 0;
  children?: TransmissionNode[];
}

export interface HistoricalOutcome {
  asset: string;
  horizon: string;
  movePct: number;
  note?: string;
}

export interface AnalogueMatch {
  episodeId: string;
  name: string;
  year: number;
  similarity: number;
  summary: string;
  outcomes: HistoricalOutcome[];
}

export interface EventCluster {
  id: string;
  headline: string;
  categories: string[];
  items: NewsItem[];
  sourceCount: number;
  firstSeen: string;
  lastUpdate: string;
  impactScore: number;
  impactBreakdown: Record<string, number>;
  credibility: number;
  countries: string[];
  exposures: ExposureEntry[];
  transmission: TransmissionNode[] | null;
  analogues: AnalogueMatch[];
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
  model: number | null;
  predictionMarket: number | null;
  predictionMarketLabel?: string;
  baseRate: number | null;
  change24h: number | null;
  drivers: string[];
  divergence: number | null;
  asOf: string;
  methodology: string;
}

export interface RegimeState {
  regime: string;
  confidence: number;
  scores: Record<string, number>;
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
  intensity: number;
  url?: string;
  categories?: string[];
}

export interface CalendarEvent {
  id: string;
  date: string;
  time?: string;
  name: string;
  country: string;
  importance: number;
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
  kind: string;
}

export interface CountryRisk {
  iso2: string;
  name: string;
  overall: number;
  components: Record<string, number>;
  marketsCare: string[];
  newsVelocity: number;
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

export interface Brief {
  generatedAt: string;
  mode: "deterministic" | "llm";
  sections: { title: string; lines: string[] }[];
  narrative: string | null;
}

export interface MacroResponse {
  available: boolean;
  reason?: string;
  asOf?: string;
  series: {
    id: string;
    name: string;
    unit: string;
    latest: { date: string; value: number } | null;
    previous?: { date: string; value: number } | null;
    history?: { date: string; value: number }[];
    source?: string;
    error?: string;
  }[];
}

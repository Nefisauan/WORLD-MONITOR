import { fetchJson } from "../util.js";

// FRED (St. Louis Fed) — requires a free API key via FRED_API_KEY.
// When absent, callers must mark macro series as unavailable (never simulate).

export interface FredObservation {
  date: string;
  value: number;
}

export interface MacroSeries {
  id: string;
  name: string;
  unit: string;
  latest: FredObservation | null;
  previous: FredObservation | null;
  history: FredObservation[];
  source: string;
}

export const FRED_SERIES: { id: string; name: string; unit: string }[] = [
  { id: "CPIAUCSL", name: "US CPI (index)", unit: "index" },
  { id: "CPILFESL", name: "US Core CPI (index)", unit: "index" },
  { id: "PCEPILFE", name: "US Core PCE (index)", unit: "index" },
  { id: "UNRATE", name: "US Unemployment Rate", unit: "%" },
  { id: "PAYEMS", name: "US Nonfarm Payrolls", unit: "thousands" },
  { id: "DGS2", name: "US 2Y Treasury Yield", unit: "%" },
  { id: "DGS10", name: "US 10Y Treasury Yield", unit: "%" },
  { id: "T10Y2Y", name: "2s10s Curve", unit: "pp" },
  { id: "T10YIE", name: "10Y Breakeven Inflation", unit: "%" },
  { id: "WALCL", name: "Fed Balance Sheet", unit: "$mn" },
  { id: "RRPONTSYD", name: "Reverse Repo (ON RRP)", unit: "$bn" },
  { id: "WTREGEN", name: "Treasury General Account", unit: "$bn" },
  { id: "BAMLH0A0HYM2", name: "US HY OAS Spread", unit: "%" },
  { id: "BAMLC0A0CM", name: "US IG OAS Spread", unit: "%" },
  { id: "NFCI", name: "Chicago Fed Financial Conditions", unit: "index" },
  { id: "RSAFS", name: "US Retail Sales", unit: "$mn" },
  { id: "INDPRO", name: "US Industrial Production", unit: "index" },
  { id: "HOUST", name: "US Housing Starts", unit: "thousands" },
  { id: "MORTGAGE30US", name: "30Y Mortgage Rate", unit: "%" },
  { id: "ICSA", name: "Initial Jobless Claims", unit: "count" },
];

export function fredKey(): string | null {
  return process.env.FRED_API_KEY?.trim() || null;
}

export async function fetchFredSeries(seriesId: string, name: string, unit: string): Promise<MacroSeries> {
  const key = fredKey();
  if (!key) throw new Error("FRED_API_KEY not configured");
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&sort_order=desc&limit=60`;
  const data = await fetchJson<{ observations: { date: string; value: string }[] }>(url, { timeoutMs: 15_000 });
  const obs: FredObservation[] = data.observations
    .filter((o) => o.value !== ".")
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
    .reverse();
  return {
    id: seriesId,
    name,
    unit,
    latest: obs[obs.length - 1] ?? null,
    previous: obs[obs.length - 2] ?? null,
    history: obs,
    source: "FRED (St. Louis Fed)",
  };
}

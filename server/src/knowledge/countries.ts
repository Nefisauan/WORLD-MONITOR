// Country risk baselines and maritime chokepoints.
// Base scores are curated qualitative priors (0-100, higher = more risk),
// adjusted live by news velocity. They are inferences, not measurements.

export interface CountryBase {
  iso2: string;
  name: string;
  lat: number;
  lon: number;
  base: Record<string, number>; // component -> 0-100
  marketsCare: string[];
}

export const COUNTRY_BASES: CountryBase[] = [
  { iso2: "US", name: "United States", lat: 39, lon: -98, base: { political: 35, economic: 25, currency: 10, debt: 45, geopolitical: 30, supply_chain: 20 }, marketsCare: ["Global rates anchor", "USD reserve system", "Tech & AI leadership", "Fiscal trajectory", "Consumer demand"] },
  { iso2: "CN", name: "China", lat: 35, lon: 104, base: { political: 45, economic: 55, currency: 45, debt: 60, geopolitical: 60, supply_chain: 55 }, marketsCare: ["Global growth engine", "Commodity demand (copper, iron, oil)", "Semiconductor supply chain", "CNY policy", "Trade-war escalation", "Property-sector debt"] },
  { iso2: "TW", name: "Taiwan", lat: 23.7, lon: 121, base: { political: 40, economic: 25, currency: 25, debt: 15, geopolitical: 85, supply_chain: 90 }, marketsCare: ["~90% of leading-edge chip fabrication", "TSMC single-point risk", "Strait transit for East Asia trade"] },
  { iso2: "RU", name: "Russia", lat: 60, lon: 100, base: { political: 70, economic: 65, currency: 70, debt: 50, geopolitical: 90, supply_chain: 70 }, marketsCare: ["Oil & gas supply", "Wheat & fertilizer exports", "Sanctions regime", "European energy security", "Metals (palladium, nickel, aluminum)"] },
  { iso2: "UA", name: "Ukraine", lat: 49, lon: 32, base: { political: 75, economic: 80, currency: 75, debt: 80, geopolitical: 95, supply_chain: 75 }, marketsCare: ["Black Sea grain corridor", "War escalation risk", "European security architecture"] },
  { iso2: "IR", name: "Iran", lat: 32, lon: 53, base: { political: 75, economic: 80, currency: 85, debt: 40, geopolitical: 90, supply_chain: 60 }, marketsCare: ["Strait of Hormuz leverage", "Oil supply & sanctions", "Regional proxy escalation", "Nuclear program"] },
  { iso2: "IL", name: "Israel", lat: 31.5, lon: 34.9, base: { political: 55, economic: 35, currency: 30, debt: 35, geopolitical: 85, supply_chain: 40 }, marketsCare: ["Regional escalation trigger", "Cyber & defense tech", "Energy infrastructure in Eastern Med"] },
  { iso2: "SA", name: "Saudi Arabia", lat: 24, lon: 45, base: { political: 45, economic: 35, currency: 20, debt: 25, geopolitical: 60, supply_chain: 45 }, marketsCare: ["OPEC+ swing producer", "Oil price policy", "Petrodollar recycling", "Sovereign wealth flows"] },
  { iso2: "JP", name: "Japan", lat: 36, lon: 138, base: { political: 20, economic: 40, currency: 45, debt: 70, geopolitical: 35, supply_chain: 35 }, marketsCare: ["BOJ policy & global carry trade", "JGB yields anchor global duration", "Largest foreign holder of Treasuries", "Semiconductor materials"] },
  { iso2: "DE", name: "Germany", lat: 51, lon: 10, base: { political: 30, economic: 45, currency: 15, debt: 25, geopolitical: 35, supply_chain: 45 }, marketsCare: ["European industrial engine", "Energy import dependence", "Autos & chemicals", "Fiscal stance shift"] },
  { iso2: "GB", name: "United Kingdom", lat: 54, lon: -2, base: { political: 30, economic: 40, currency: 30, debt: 45, geopolitical: 25, supply_chain: 25 }, marketsCare: ["Gilt market stress history", "Global financial center", "GBP volatility"] },
  { iso2: "FR", name: "France", lat: 46, lon: 2, base: { political: 40, economic: 40, currency: 15, debt: 55, geopolitical: 30, supply_chain: 25 }, marketsCare: ["OAT-Bund spread as euro stress gauge", "Nuclear power exports", "Political fragmentation"] },
  { iso2: "IN", name: "India", lat: 21, lon: 78, base: { political: 30, economic: 35, currency: 35, debt: 40, geopolitical: 40, supply_chain: 30 }, marketsCare: ["Fastest-growing major economy", "Oil import sensitivity", "EM flows benchmark weight", "China+1 manufacturing"] },
  { iso2: "BR", name: "Brazil", lat: -10, lon: -55, base: { political: 45, economic: 45, currency: 50, debt: 55, geopolitical: 25, supply_chain: 30 }, marketsCare: ["Soybeans, iron ore, oil exports", "EM rates & FX bellwether", "Food supply"] },
  { iso2: "KR", name: "South Korea", lat: 36, lon: 128, base: { political: 30, economic: 35, currency: 35, debt: 30, geopolitical: 55, supply_chain: 50 }, marketsCare: ["Memory semiconductors (Samsung, SK Hynix)", "North Korea tail risk", "Global trade bellwether"] },
  { iso2: "TR", name: "Turkey", lat: 39, lon: 35, base: { political: 55, economic: 65, currency: 75, debt: 55, geopolitical: 55, supply_chain: 40 }, marketsCare: ["Bosporus chokepoint", "EM currency-crisis history", "NATO's southern flank"] },
  { iso2: "MX", name: "Mexico", lat: 23, lon: -102, base: { political: 45, economic: 40, currency: 40, debt: 40, geopolitical: 30, supply_chain: 35 }, marketsCare: ["Nearshoring winner", "US trade dependence & tariff risk", "Carry-trade currency"] },
  { iso2: "EG", name: "Egypt", lat: 27, lon: 30, base: { political: 55, economic: 70, currency: 70, debt: 75, geopolitical: 55, supply_chain: 55 }, marketsCare: ["Suez Canal revenue & transit", "Wheat import fragility", "IMF program"] },
  { iso2: "NG", name: "Nigeria", lat: 9, lon: 8, base: { political: 60, economic: 65, currency: 70, debt: 55, geopolitical: 45, supply_chain: 45 }, marketsCare: ["Oil supply & outage history", "Frontier-market bellwether"] },
  { iso2: "AR", name: "Argentina", lat: -34, lon: -64, base: { political: 55, economic: 70, currency: 80, debt: 85, geopolitical: 15, supply_chain: 25 }, marketsCare: ["Serial-default history", "Grain exports", "Reform trade"] },
  { iso2: "VE", name: "Venezuela", lat: 8, lon: -66, base: { political: 85, economic: 90, currency: 95, debt: 95, geopolitical: 55, supply_chain: 50 }, marketsCare: ["Heavy crude reserves", "Sanctions policy swings"] },
  { iso2: "PK", name: "Pakistan", lat: 30, lon: 70, base: { political: 70, economic: 75, currency: 70, debt: 80, geopolitical: 70, supply_chain: 40 }, marketsCare: ["Nuclear-armed instability tail risk", "IMF dependence"] },
];

export interface Chokepoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  share: string; // share of global trade/oil transiting
  note: string;
}

// Transit shares: approximate figures from EIA / UNCTAD publications.
export const CHOKEPOINTS: Chokepoint[] = [
  { id: "hormuz", name: "Strait of Hormuz", lat: 26.6, lon: 56.5, share: "~20% of global oil", note: "No full bypass exists; closure is the single largest oil tail risk." },
  { id: "malacca", name: "Strait of Malacca", lat: 1.7, lon: 101.5, share: "~30% of seaborne trade", note: "Primary Asia-Europe/Mideast artery; feeds China, Japan, Korea." },
  { id: "suez", name: "Suez Canal", lat: 30.5, lon: 32.3, share: "~12-15% of global trade", note: "2021 Ever Given grounding blocked ~$9bn/day of trade." },
  { id: "bab_el_mandeb", name: "Bab el-Mandeb", lat: 12.6, lon: 43.3, share: "~9% of seaborne oil", note: "Houthi attacks since 2023 forced Cape of Good Hope rerouting." },
  { id: "panama", name: "Panama Canal", lat: 9.1, lon: -79.7, share: "~5% of maritime trade", note: "Drought-constrained; US East Coast supply-chain dependency." },
  { id: "bosporus", name: "Bosporus Strait", lat: 41.1, lon: 29.1, share: "~3% of oil + Black Sea grain", note: "Sole outlet for Black Sea grain and Russian/Kazakh crude." },
  { id: "gibraltar", name: "Strait of Gibraltar", lat: 35.95, lon: -5.6, share: "Mediterranean gateway", note: "Links Atlantic shipping to Suez route." },
];

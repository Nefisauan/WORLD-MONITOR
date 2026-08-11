import type { ExposureEntry, TransmissionNode } from "../types.js";

// Event taxonomy: keyword classifiers -> category -> asset exposures + causal
// transmission templates. Deterministic knowledge that powers impact scoring,
// the domino-effect view, and analogue matching. All templates are inferences
// (marked as such in the UI), not facts.

export interface EventCategory {
  id: string;
  label: string;
  baseImpact: number; // 0-100 prior for market relevance
  keywords: string[]; // all lowercase; matched against title tokens/phrases
  strongKeywords?: string[]; // presence boosts magnitude
  exposures: ExposureEntry[];
  analogueTags: string[]; // used to match historical episodes
  transmission?: TransmissionNode[];
}

const T = (
  stage: string,
  label: string,
  detail: string,
  direction?: 1 | -1 | 0,
  children?: TransmissionNode[],
): TransmissionNode => ({ stage, label, detail, direction, children });

export const CATEGORIES: EventCategory[] = [
  {
    id: "oil_supply",
    label: "Energy Supply Shock",
    baseImpact: 82,
    keywords: [
      "hormuz", "strait of hormuz", "opec", "oil supply", "oil production", "crude output",
      "oil facility", "refinery attack", "pipeline attack", "oil sanctions", "tanker attack",
      "oil embargo", "production cut", "oil field", "red sea shipping", "houthi",
    ],
    strongKeywords: ["closure", "blockade", "attack", "strike", "explosion", "embargo"],
    exposures: [
      { target: "Oil (WTI/Brent)", direction: 1, strength: 3 },
      { target: "Energy equities (XLE)", direction: 1, strength: 3 },
      { target: "Defense (ITA)", direction: 1, strength: 2 },
      { target: "Airlines / transports", direction: -1, strength: 3 },
      { target: "Inflation expectations", direction: 1, strength: 2 },
      { target: "Treasury yields", direction: 1, strength: 1, note: "inflation vs safe-haven tension" },
      { target: "Equities broad", direction: -1, strength: 2 },
      { target: "Gold", direction: 1, strength: 1 },
    ],
    analogueTags: ["oil", "middle_east", "supply_shock", "inflation"],
    transmission: [
      T("EVENT", "Supply threat", "Physical or political threat to oil supply/transit", 0, [
        T("FIRST-ORDER", "Crude prices reprice risk", "WTI/Brent risk premium widens; futures curve backwardation deepens", 1, [
          T("INDUSTRY", "Energy producers gain, fuel consumers lose", "E&P margins up; airlines, shipping, chemicals face cost pressure", 0, [
            T("MACRO", "Inflation pressure builds", "Gasoline and freight pass-through lifts CPI with 1-2 month lag", 1, [
              T("POLICY", "Central-bank easing repriced", "Cuts get pushed out; front-end yields rise", 1, [
                T("MARKETS", "Growth equities and duration under pressure", "Higher discount rates hit long-duration assets; USD tends to firm", -1),
              ]),
            ]),
          ]),
        ]),
        T("SECOND-ORDER", "Rerouting & substitution", "Tanker rates rise, alternative suppliers gain share, SPR releases become policy option", 0),
      ]),
    ],
  },
  {
    id: "war_escalation",
    label: "Military Escalation",
    baseImpact: 75,
    keywords: [
      "missile", "airstrike", "air strike", "invasion", "troops", "military operation", "drone attack",
      "shelling", "offensive", "mobilization", "warship", "naval", "airspace closed", "martial law",
      "nuclear", "ceasefire collapse", "front line", "artillery", "blockade",
    ],
    strongKeywords: ["nuclear", "invasion", "declares war", "mobilization"],
    exposures: [
      { target: "Defense (ITA)", direction: 1, strength: 3 },
      { target: "Gold", direction: 1, strength: 2 },
      { target: "Oil", direction: 1, strength: 2, note: "if energy region involved" },
      { target: "Equities broad", direction: -1, strength: 2 },
      { target: "VIX", direction: 1, strength: 2 },
      { target: "USD / safe havens", direction: 1, strength: 2 },
      { target: "Regional FX & equities", direction: -1, strength: 3 },
    ],
    analogueTags: ["war", "geopolitics", "risk_off"],
    transmission: [
      T("EVENT", "Escalation", "Kinetic escalation raises tail-risk perception", 0, [
        T("FIRST-ORDER", "Risk-off impulse", "VIX up, safe havens bid (gold, USD, Treasuries), regional assets sold", -1, [
          T("COMMODITY", "Supply-route risk", "Energy/grain transit risk if conflict touches producing regions or chokepoints", 1, [
            T("MACRO", "Stagflationary mix", "Commodity-led inflation with growth drag is historically the hardest regime for equities", -1),
          ]),
          T("SECOND-ORDER", "Defense & fiscal", "Defense budgets and industrial capex rise; fiscal deficits widen; term premium can rise", 1),
        ]),
      ]),
    ],
  },
  {
    id: "ceasefire_deescalation",
    label: "De-escalation / Ceasefire",
    baseImpact: 60,
    keywords: ["ceasefire", "peace deal", "peace talks", "truce", "de-escalation", "diplomatic breakthrough", "hostage deal", "agreement signed"],
    exposures: [
      { target: "Oil", direction: -1, strength: 2 },
      { target: "Equities broad", direction: 1, strength: 2 },
      { target: "Gold", direction: -1, strength: 2 },
      { target: "VIX", direction: -1, strength: 2 },
      { target: "Regional assets", direction: 1, strength: 3 },
      { target: "Defense (ITA)", direction: -1, strength: 1 },
    ],
    analogueTags: ["deescalation", "risk_on", "geopolitics"],
  },
  {
    id: "sanctions_export_controls",
    label: "Sanctions / Export Controls",
    baseImpact: 68,
    keywords: [
      "sanctions", "export controls", "export restrictions", "export ban", "entity list", "blacklist",
      "chip ban", "rare earth", "critical mineral", "gallium", "germanium", "graphite", "tariff", "tariffs", "trade war", "import ban",
    ],
    strongKeywords: ["sweeping", "unprecedented", "total ban", "all exports"],
    exposures: [
      { target: "Semiconductors (SMH)", direction: -1, strength: 3, note: "if tech controls" },
      { target: "Targeted commodity", direction: 1, strength: 3 },
      { target: "Alternative suppliers / miners", direction: 1, strength: 2 },
      { target: "USD/CNY", direction: 1, strength: 2 },
      { target: "Inflation expectations", direction: 1, strength: 1 },
      { target: "Global trade proxies", direction: -1, strength: 2 },
    ],
    analogueTags: ["trade_war", "china", "supply_chain", "export_controls"],
    transmission: [
      T("EVENT", "Restriction announced", "State restricts exports of a strategic good", 0, [
        T("FIRST-ORDER", "Supply tightens", "Available global supply of the good decreases; spot prices rise", 1, [
          T("INDUSTRY", "Downstream cost shock", "Manufacturers dependent on the input face margin pressure and inventory scramble", -1, [
            T("MACRO", "Inflation pressure", "Input costs pass through to goods prices over 1-3 quarters", 1, [
              T("POLICY", "Easing probability falls", "Central banks stay restrictive for longer", 1, [
                T("MARKETS", "Yields up, growth equities down, USD up", "Classic supply-shock repricing", -1),
              ]),
            ]),
          ]),
          T("SECOND-ORDER", "Substitution & capex", "Alternative suppliers rerate; mining/refining capex accelerates; friend-shoring flows", 1),
        ]),
      ]),
    ],
  },
  {
    id: "cb_policy",
    label: "Central Bank Policy",
    baseImpact: 78,
    keywords: [
      "fed", "federal reserve", "fomc", "rate cut", "rate hike", "interest rate decision", "powell",
      "ecb", "lagarde", "bank of japan", "boj", "pboc", "bank of england", "rate decision",
      "quantitative easing", "quantitative tightening", "balance sheet", "hawkish", "dovish", "basis points",
    ],
    strongKeywords: ["emergency", "intermeeting", "surprise", "unscheduled"],
    exposures: [
      { target: "Treasury yields", direction: 0, strength: 3, note: "direction depends on surprise" },
      { target: "USD", direction: 0, strength: 3 },
      { target: "Growth equities", direction: 0, strength: 3 },
      { target: "Gold", direction: 0, strength: 2 },
      { target: "Crypto", direction: 0, strength: 2, note: "liquidity-sensitive" },
    ],
    analogueTags: ["monetary_policy", "rates", "fed"],
    transmission: [
      T("EVENT", "Policy signal", "Rate decision, guidance shift, or balance-sheet change", 0, [
        T("FIRST-ORDER", "Front-end repricing", "2Y yields move first as the expected path adjusts", 0, [
          T("MARKETS", "Cross-asset pass-through", "USD follows rate differentials; equity multiples follow real yields; gold follows real rates inversely", 0, [
            T("SECOND-ORDER", "Credit & housing", "Financing costs shift corporate capex and mortgage demand over 2-4 quarters", 0),
          ]),
        ]),
      ]),
    ],
  },
  {
    id: "inflation_data",
    label: "Inflation Data",
    baseImpact: 72,
    keywords: ["cpi", "inflation rate", "consumer prices", "pce", "core inflation", "ppi", "producer prices", "inflation report", "price index"],
    strongKeywords: ["hotter", "cooler", "surges", "unexpected"],
    exposures: [
      { target: "Treasury yields", direction: 0, strength: 3 },
      { target: "USD", direction: 0, strength: 2 },
      { target: "Growth equities", direction: 0, strength: 2 },
      { target: "Gold", direction: 0, strength: 2 },
    ],
    analogueTags: ["inflation", "macro_data", "rates"],
  },
  {
    id: "growth_data",
    label: "Growth / Labor Data",
    baseImpact: 65,
    keywords: ["payrolls", "nonfarm", "unemployment rate", "jobless claims", "gdp", "recession", "pmi", "ism", "retail sales", "industrial production", "consumer confidence", "layoffs"],
    exposures: [
      { target: "Equities broad", direction: 0, strength: 2 },
      { target: "Treasury yields", direction: 0, strength: 3 },
      { target: "Cyclicals vs defensives", direction: 0, strength: 2 },
    ],
    analogueTags: ["growth", "macro_data", "recession"],
  },
  {
    id: "banking_credit_stress",
    label: "Banking / Credit Stress",
    baseImpact: 85,
    keywords: [
      "bank failure", "bank run", "deposit flight", "bailout", "credit crunch", "default", "bankruptcy",
      "liquidity crisis", "contagion", "emergency lending", "bank rescue", "credit downgrade", "debt crisis", "insolvency",
    ],
    strongKeywords: ["collapse", "failure", "run", "systemic"],
    exposures: [
      { target: "Banks (XLF/KRE)", direction: -1, strength: 3 },
      { target: "Treasury yields", direction: -1, strength: 3, note: "flight to quality + cut pricing" },
      { target: "Gold", direction: 1, strength: 2 },
      { target: "Credit spreads", direction: 1, strength: 3 },
      { target: "Equities broad", direction: -1, strength: 2 },
      { target: "Crypto", direction: 0, strength: 1, note: "2023: BTC rallied on bank stress" },
    ],
    analogueTags: ["banking", "credit_stress", "crisis", "risk_off"],
    transmission: [
      T("EVENT", "Institution stress", "A bank or major credit fails or wobbles", 0, [
        T("FIRST-ORDER", "Funding markets tighten", "Interbank/repo caution; deposit migration to money funds and majors", -1, [
          T("POLICY", "Central bank backstop", "Liquidity facilities, cut expectations pulled forward; front-end yields fall fast", -1, [
            T("MARKETS", "Quality bid", "Treasuries and gold rally; bank equity and credit spreads price contagion probability", 0, [
              T("SECOND-ORDER", "Lending contraction", "Credit standards tighten; small-business and CRE financing hit; growth drag over 2-3 quarters", -1),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  {
    id: "shipping_disruption",
    label: "Shipping / Chokepoint Disruption",
    baseImpact: 70,
    keywords: [
      "suez", "panama canal", "shipping lane", "container", "freight rates", "port strike", "port closure",
      "canal", "vessel seized", "shipping disruption", "bab el-mandeb", "malacca", "bosporus", "rerouting", "cape of good hope",
    ],
    exposures: [
      { target: "Shipping / tanker rates", direction: 1, strength: 3 },
      { target: "Oil / LNG", direction: 1, strength: 2 },
      { target: "Retail / goods importers", direction: -1, strength: 2 },
      { target: "Inflation expectations", direction: 1, strength: 2 },
      { target: "Insurers", direction: -1, strength: 1 },
    ],
    analogueTags: ["shipping", "supply_chain", "chokepoint", "inflation"],
    transmission: [
      T("EVENT", "Chokepoint disruption", "Transit capacity through a strait/canal falls", 0, [
        T("FIRST-ORDER", "Freight repricing", "Container and tanker rates spike on longer routes and risk premia", 1, [
          T("INDUSTRY", "Importer margin squeeze", "Retailers and manufacturers face cost and delay; inventories buffer 4-8 weeks", -1, [
            T("MACRO", "Goods inflation impulse", "Freight pass-through appears in goods CPI with a quarter lag", 1),
          ]),
          T("SECOND-ORDER", "Rerouting winners", "Alternative routes/ports and shipping owners with spot exposure benefit", 1),
        ]),
      ]),
    ],
  },
  {
    id: "taiwan_semis",
    label: "Taiwan / Semiconductor Risk",
    baseImpact: 80,
    keywords: ["taiwan", "tsmc", "taiwan strait", "pla drills", "semiconductor supply", "chip supply", "taiwan blockade"],
    strongKeywords: ["blockade", "invasion", "quarantine", "live fire"],
    exposures: [
      { target: "Semiconductors (SMH)", direction: -1, strength: 3 },
      { target: "Tech broad (XLK)", direction: -1, strength: 3 },
      { target: "Defense (ITA)", direction: 1, strength: 2 },
      { target: "Gold / USD", direction: 1, strength: 2 },
      { target: "Asia FX & equities", direction: -1, strength: 3 },
      { target: "Autos / electronics", direction: -1, strength: 2 },
    ],
    analogueTags: ["taiwan", "china", "semiconductors", "war", "supply_chain"],
    transmission: [
      T("EVENT", "Taiwan tension", "Military or political escalation around the Taiwan Strait", 0, [
        T("FIRST-ORDER", "Semiconductor risk premium", "Advanced-node fab concentration means any transit/production risk is a global tech supply event", -1, [
          T("INDUSTRY", "Electronics & autos", "Chip-dependent production (phones, servers, vehicles) faces shortage risk; AI capex timelines at risk", -1, [
            T("MACRO", "Goods inflation + growth drag", "Shortage-driven price pressure with industrial output drag", -1, [
              T("MARKETS", "Nasdaq/SMH de-rate; havens bid", "Long-duration tech most exposed; defense and non-Asia fabs rerate", -1),
            ]),
          ]),
          T("SECOND-ORDER", "Supply-chain rewiring", "US/EU/Japan fab capex accelerates; equipment makers and non-Taiwan foundries gain strategic value", 1),
        ]),
      ]),
    ],
  },
  {
    id: "cyber",
    label: "Major Cyberattack",
    baseImpact: 62,
    keywords: ["cyberattack", "ransomware", "hack", "data breach", "malware", "outage", "ddos", "cyber attack"],
    strongKeywords: ["grid", "pipeline", "exchange", "bank", "hospital"],
    exposures: [
      { target: "Cybersecurity equities", direction: 1, strength: 2 },
      { target: "Targeted sector", direction: -1, strength: 3 },
      { target: "Equities broad", direction: -1, strength: 1 },
    ],
    analogueTags: ["cyber", "infrastructure"],
  },
  {
    id: "natural_disaster",
    label: "Natural Disaster / Climate",
    baseImpact: 55,
    keywords: ["earthquake", "hurricane", "typhoon", "flood", "wildfire", "drought", "volcano", "tsunami", "heat wave", "cyclone"],
    strongKeywords: ["magnitude 7", "magnitude 8", "category 4", "category 5", "state of emergency"],
    exposures: [
      { target: "Insurers", direction: -1, strength: 2 },
      { target: "Regional assets", direction: -1, strength: 2 },
      { target: "Agriculture (if crop region)", direction: 1, strength: 2 },
      { target: "Energy (if production region)", direction: 1, strength: 2 },
      { target: "Construction / rebuild", direction: 1, strength: 1 },
    ],
    analogueTags: ["disaster", "weather", "supply_shock"],
  },
  {
    id: "elections_politics",
    label: "Elections / Political Instability",
    baseImpact: 58,
    keywords: ["election", "coup", "impeachment", "resigns", "government collapse", "no confidence", "protests", "unrest", "riot", "parliament dissolved", "snap election", "referendum"],
    strongKeywords: ["coup", "martial law", "collapse"],
    exposures: [
      { target: "Country FX & sovereign debt", direction: -1, strength: 3 },
      { target: "Country equities", direction: -1, strength: 2 },
      { target: "Policy-sensitive sectors", direction: 0, strength: 2 },
    ],
    analogueTags: ["politics", "em", "instability"],
  },
  {
    id: "fiscal_sovereign",
    label: "Fiscal / Sovereign Debt",
    baseImpact: 66,
    keywords: ["deficit", "debt ceiling", "government shutdown", "bond auction", "sovereign default", "downgrade", "fiscal stimulus", "budget", "treasury issuance", "imf bailout", "austerity"],
    strongKeywords: ["default", "downgrade", "failed auction"],
    exposures: [
      { target: "Long-end yields / term premium", direction: 1, strength: 3 },
      { target: "Country FX", direction: -1, strength: 2 },
      { target: "Gold", direction: 1, strength: 1 },
      { target: "Banks holding sovereigns", direction: -1, strength: 2 },
    ],
    analogueTags: ["fiscal", "sovereign", "rates"],
  },
  {
    id: "ai_infra",
    label: "AI Infrastructure / Power",
    baseImpact: 60,
    keywords: ["data center", "datacenter", "ai chips", "gpu", "nvidia", "ai capex", "ai spending", "power demand", "grid", "nuclear power", "smr", "electricity demand", "hyperscaler"],
    exposures: [
      { target: "Semiconductors (SMH)", direction: 1, strength: 2 },
      { target: "Utilities (XLU)", direction: 1, strength: 2 },
      { target: "Natural gas", direction: 1, strength: 1 },
      { target: "Copper / uranium", direction: 1, strength: 2 },
      { target: "Industrial electrical equipment", direction: 1, strength: 2 },
    ],
    analogueTags: ["ai", "tech", "capex", "energy"],
    transmission: [
      T("EVENT", "AI capex signal", "Datacenter/GPU/power commitment changes the AI infrastructure demand picture", 0, [
        T("FIRST-ORDER", "Compute supply chain", "Chip, memory, networking and cooling demand reprices", 1, [
          T("INDUSTRY", "Power bottleneck", "Grid interconnection and generation become the binding constraint", 1, [
            T("MARKETS", "Electrification complex", "Utilities, gas, uranium, copper and electrical-equipment names carry the theme", 1),
          ]),
        ]),
      ]),
    ],
  },
  {
    id: "crypto_events",
    label: "Crypto Market Structure",
    baseImpact: 50,
    keywords: ["bitcoin etf", "crypto regulation", "sec crypto", "exchange hack", "stablecoin", "halving", "defi exploit", "crypto exchange"],
    exposures: [
      { target: "BTC / ETH", direction: 0, strength: 3 },
      { target: "Crypto-exposed equities", direction: 0, strength: 2 },
    ],
    analogueTags: ["crypto"],
  },
];

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/** Country detection: name/keyword -> ISO2. Not exhaustive; major markets focus. */
export const COUNTRY_KEYWORDS: Record<string, string[]> = {
  US: ["united states", "u.s.", "america", "washington", "white house", "congress", "pentagon"],
  CN: ["china", "chinese", "beijing", "pboc", "xi jinping"],
  TW: ["taiwan", "taipei", "tsmc"],
  RU: ["russia", "russian", "moscow", "kremlin", "putin"],
  UA: ["ukraine", "ukrainian", "kyiv", "kiev", "zelensky"],
  IR: ["iran", "iranian", "tehran", "irgc"],
  IL: ["israel", "israeli", "tel aviv", "idf", "gaza", "jerusalem"],
  SA: ["saudi", "riyadh", "aramco"],
  JP: ["japan", "japanese", "tokyo", "boj", "yen"],
  DE: ["germany", "german", "berlin", "bundesbank"],
  FR: ["france", "french", "paris"],
  GB: ["britain", "british", "uk ", "united kingdom", "london", "bank of england"],
  IN: ["india", "indian", "delhi", "mumbai", "rbi"],
  BR: ["brazil", "brazilian", "brasilia"],
  KR: ["south korea", "korean", "seoul"],
  KP: ["north korea", "pyongyang"],
  MX: ["mexico", "mexican"],
  TR: ["turkey", "turkish", "ankara", "erdogan"],
  EG: ["egypt", "suez", "cairo"],
  YE: ["yemen", "houthi", "bab el-mandeb"],
  VE: ["venezuela", "caracas"],
  NG: ["nigeria", "lagos"],
  PK: ["pakistan", "islamabad"],
  AR: ["argentina", "buenos aires"],
  PA: ["panama canal", "panama"],
  QA: ["qatar", "doha"],
  AE: ["uae", "united arab emirates", "dubai", "abu dhabi"],
};

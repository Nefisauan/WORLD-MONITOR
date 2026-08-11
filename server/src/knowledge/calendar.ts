import type { CalendarEvent } from "../types.js";

// Scheduled macro catalysts. FOMC dates follow the Federal Reserve's published
// 2026 meeting calendar; CPI and Employment Situation dates follow the BLS
// release schedule. Verify against federalreserve.gov and bls.gov if dates are
// revised. Typical-reaction notes are approximate historical medians.

interface RecurringSpec {
  name: string;
  country: string;
  importance: number;
  assets: string[];
  typicalReaction: string;
  source: string;
  time?: string;
  dates: string[]; // ISO dates (2026)
}

const SPECS: RecurringSpec[] = [
  {
    name: "FOMC Rate Decision",
    country: "US",
    importance: 98,
    assets: ["Treasuries", "USD", "S&P 500", "Nasdaq", "Gold", "BTC"],
    typicalReaction: "2Y yields and USD move first; median S&P 500 absolute move on decision days ~1% with fat tails on surprises.",
    source: "Federal Reserve 2026 meeting calendar",
    time: "14:00 ET (statement), 14:30 ET (press conf.)",
    dates: ["2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17", "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09"],
  },
  {
    name: "US CPI",
    country: "US",
    importance: 95,
    assets: ["Treasuries", "USD", "Nasdaq", "Gold", "BTC"],
    typicalReaction: "Since 2022, CPI days show elevated realized vol; a 0.1pp core surprise has historically moved S&P ~0.5-1% intraday.",
    source: "BLS 2026 release schedule",
    time: "08:30 ET",
    dates: ["2026-01-13", "2026-02-11", "2026-03-11", "2026-04-10", "2026-05-12", "2026-06-10", "2026-07-14", "2026-08-12", "2026-09-11", "2026-10-13", "2026-11-10", "2026-12-10"],
  },
  {
    name: "US Employment Situation (Payrolls)",
    country: "US",
    importance: 92,
    assets: ["Treasuries", "USD", "S&P 500", "Gold"],
    typicalReaction: "Front-end yields react to payrolls + wage data; equity direction depends on regime (good-news-is-bad in tightening cycles).",
    source: "BLS 2026 release schedule",
    time: "08:30 ET",
    dates: ["2026-01-09", "2026-02-06", "2026-03-06", "2026-04-03", "2026-05-08", "2026-06-05", "2026-07-02", "2026-08-07", "2026-09-04", "2026-10-02", "2026-11-06", "2026-12-04"],
  },
  {
    name: "ECB Rate Decision",
    country: "EU",
    importance: 85,
    assets: ["EUR/USD", "Bunds", "Euro Stoxx"],
    typicalReaction: "EUR/USD and Bund yields reprice on guidance; spillover to global duration.",
    source: "ECB Governing Council schedule (verify exact 2026 dates on ecb.europa.eu)",
    time: "14:15 CET",
    dates: ["2026-02-05", "2026-03-19", "2026-04-30", "2026-06-11", "2026-07-23", "2026-09-10", "2026-10-29", "2026-12-17"],
  },
  {
    name: "US PCE Inflation",
    country: "US",
    importance: 80,
    assets: ["Treasuries", "USD", "Gold"],
    typicalReaction: "The Fed's preferred gauge; smaller reaction than CPI unless it diverges from CPI-implied expectations.",
    source: "BEA release schedule (typically last week of month)",
    time: "08:30 ET",
    dates: ["2026-01-30", "2026-02-27", "2026-03-27", "2026-04-30", "2026-05-29", "2026-06-26", "2026-07-31", "2026-08-28", "2026-09-25", "2026-10-30", "2026-11-25", "2026-12-23"],
  },
  {
    name: "OPEC+ Ministerial Monitoring",
    country: "SA",
    importance: 75,
    assets: ["Brent", "WTI", "Energy equities", "USD/CAD"],
    typicalReaction: "Production-quota surprises historically move Brent 2-5% same-day.",
    source: "OPEC meeting calendar (verify on opec.org; dates shift)",
    dates: ["2026-02-01", "2026-04-05", "2026-06-01", "2026-08-02", "2026-10-04", "2026-11-29"],
  },
];

export function buildCalendar(now: Date, horizonDays = 45): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const horizon = new Date(now.getTime() + horizonDays * 86_400_000);
  const today = new Date(now.getTime() - 86_400_000); // include yesterday for context
  for (const spec of SPECS) {
    for (const d of spec.dates) {
      const dt = new Date(d + "T12:00:00Z");
      if (dt >= today && dt <= horizon) {
        events.push({
          id: `${spec.name}-${d}`.replace(/\s+/g, "_"),
          date: d,
          time: spec.time,
          name: spec.name,
          country: spec.country,
          importance: spec.importance,
          assets: spec.assets,
          typicalReaction: spec.typicalReaction,
          source: spec.source,
        });
      }
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

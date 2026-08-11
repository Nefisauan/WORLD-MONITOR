import type { GlobalState } from "../types.js";
import { llmComplete, llmProvider } from "./llm.js";

// Morning brief: deterministic assembly from live state, optionally narrated
// by an LLM (which only sees and restates this assembled data).

export interface Brief {
  generatedAt: string;
  mode: "deterministic" | "llm";
  sections: { title: string; lines: string[] }[];
  narrative: string | null;
}

const fmt = (n: number | null | undefined, suffix = "%") =>
  n == null ? "n/a" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}${suffix}`;

export async function generateBrief(state: GlobalState): Promise<Brief> {
  const quotes = Object.values(state.quotes);
  const movers = quotes
    .filter((q) => q.changePct1D != null)
    .sort((a, b) => Math.abs(b.changePct1D!) - Math.abs(a.changePct1D!))
    .slice(0, 8);

  const unusual = quotes.filter((q) => q.unusual);
  const topEvents = state.clusters.slice(0, 6);
  const probShifts = state.probabilities
    .filter((p) => p.change24h != null && Math.abs(p.change24h) >= 1)
    .sort((a, b) => Math.abs(b.change24h!) - Math.abs(a.change24h!));
  const mispricings = state.probabilities
    .filter((p) => p.divergence != null && p.divergence >= 0.08)
    .sort((a, b) => b.divergence! - a.divergence!);
  const today = new Date().toISOString().slice(0, 10);
  const catalysts = state.calendar.filter((c) => c.date >= today).slice(0, 5);

  const sections: Brief["sections"] = [
    {
      title: "Overnight Markets",
      lines: movers.map(
        (q) => `${q.name}: ${fmt(q.changePct1D)}${q.zScore1D != null && Math.abs(q.zScore1D) >= 2 ? ` (${q.zScore1D.toFixed(1)}σ — unusual)` : ""}`,
      ),
    },
    {
      title: "Regime & Risk",
      lines: [
        `Market regime: ${state.regime?.regime ?? "n/a"} (confidence ${state.regime?.confidence ?? "n/a"}%)${state.regime?.previous ? `, previously ${state.regime.previous}` : ""}`,
        `Global risk score: ${state.globalRiskScore ?? "n/a"}/100`,
        ...state.riskDrivers.map((d) => `  driver: ${d.name} (${d.delta >= 0 ? "+" : ""}${d.delta})`),
      ],
    },
    {
      title: "Biggest Developments",
      lines: topEvents.map((c) => `[${c.impactScore}/100] ${c.headline} (${c.sourceCount} sources)`),
    },
    {
      title: "Probability Shifts (24h)",
      lines: probShifts.length
        ? probShifts.map((p) => `${p.question}: model ${(p.model! * 100).toFixed(0)}% (${p.change24h! >= 0 ? "+" : ""}${p.change24h}pp)`)
        : ["No material probability shifts in the last 24 hours"],
    },
    {
      title: "Potential Mispricings (model vs prediction market)",
      lines: mispricings.length
        ? mispricings.map(
            (p) => `${p.question}: model ${(p.model! * 100).toFixed(0)}% vs market ${(p.predictionMarket! * 100).toFixed(0)}% — gap ${(p.divergence! * 100).toFixed(0)}pp`,
          )
        : ["No significant model-vs-market divergences currently"],
    },
    {
      title: "Today's Catalysts",
      lines: catalysts.length
        ? catalysts.map((c) => `${c.date} ${c.name} (importance ${c.importance}) — ${c.assets.join(", ")}`)
        : ["No scheduled tier-1 catalysts in window"],
    },
    {
      title: "What Could Surprise the Market",
      lines: [
        ...unusual.map((q) => `Unusual move already in progress: ${q.name} ${fmt(q.changePct1D)} (${q.zScore1D?.toFixed(1)}σ) — check if narrative has caught up`),
        ...mispricings.slice(0, 2).map((p) => `Model-market gap on "${p.question}" — a repricing toward the model view would surprise consensus`),
        ...(catalysts[0] ? [`${catalysts[0].name}: ${catalysts[0].typicalReaction}`] : []),
      ],
    },
  ];

  let narrative: string | null = null;
  if (llmProvider()) {
    const context = sections
      .map((s) => `## ${s.title}\n${s.lines.join("\n")}`)
      .join("\n\n");
    narrative = await llmComplete(
      `Write a morning macro brief (max 350 words) for professional investors from this live data snapshot. Label FACT/INFERENCE/FORECAST sections.\n\n${context}`,
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: narrative ? "llm" : "deterministic",
    sections,
    narrative,
  };
}

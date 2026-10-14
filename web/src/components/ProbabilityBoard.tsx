import { useState } from "react";
import type { ProbabilityEstimate } from "../types";
import { Panel } from "./Panel";

export function ProbabilityBoard({ probabilities }: { probabilities: ProbabilityEstimate[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <Panel title="Probability Research" style={{ flex: 1.3, minHeight: 0 }}>
      {probabilities.length === 0 && <div className="empty-note">Research status not yet available.</div>}
      {probabilities.map((p) => (
        <div className="prob-row" key={p.id}>
          <button className="prob-toggle" aria-expanded={openId === p.id} onClick={() => setOpenId(openId === p.id ? null : p.id)}>
            <span className="prob-q">{p.question}</span>
            <span className="warn">Insufficient evidence · forecast withheld</span>
          </button>
          {openId === p.id && (
            <div className="prob-evidence">
              <p>{p.evidence.reason}</p>
              <p>Validation: not evaluated. Uncertainty interval: unavailable.</p>
              <p>Estimated at {p.asOf}. Method: {p.research.version}.</p>
              <p>{p.methodology}</p>
              <p>Legacy prior claim (unverified): {p.research.priorClaim}</p>
              <strong>Heuristic signal contributions (log-odds, not measured effects)</strong>
              {p.research.adjustments.length === 0 && <p>No eligible signal adjustments.</p>}
              {p.research.adjustments.map((a, i) => <p key={i}>{a.logOdds >= 0 ? "+" : ""}{a.logOdds.toFixed(2)}: {a.driver}</p>)}
              <p>Input snapshot: {p.research.inputs.quotes.length} eligible quotes; {p.research.inputs.events.length} events.
                Excluded: {p.research.inputs.excludedQuotes.length} quotes, {p.research.inputs.excludedEvents.length} events.</p>
              <details><summary>Quote provenance</summary>
                {p.research.inputs.quotes.map((q) => <p key={q.id}>{q.id} · {q.source} · {q.asOf}</p>)}
              </details>
              <p>{p.evidence.comparisonReason}</p>
              {p.research.relatedMarket && <p>Related, unmatched market: “{p.research.relatedMarket.question}” · quoted price {(p.research.relatedMarket.price * 100).toFixed(1)}¢. Context only.</p>}
            </div>
          )}
        </div>
      ))}
    </Panel>
  );
}

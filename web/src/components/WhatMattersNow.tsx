import type { EventCluster } from "../types";
import { timeAgo } from "./Panel";

interface Props {
  clusters: EventCluster[];
  onSelect: (cluster: EventCluster) => void;
}

function impactClass(score: number) {
  return score >= 70 ? "impact-high" : score >= 50 ? "impact-med" : "impact-low";
}

const CAT_LABELS: Record<string, string> = {
  oil_supply: "ENERGY",
  war_escalation: "MILITARY",
  ceasefire_deescalation: "DE-ESCALATION",
  sanctions_export_controls: "SANCTIONS",
  cb_policy: "CENTRAL BANKS",
  inflation_data: "INFLATION",
  growth_data: "GROWTH",
  banking_credit_stress: "CREDIT",
  shipping_disruption: "SHIPPING",
  taiwan_semis: "TAIWAN/SEMIS",
  cyber: "CYBER",
  natural_disaster: "DISASTER",
  elections_politics: "POLITICS",
  fiscal_sovereign: "FISCAL",
  ai_infra: "AI INFRA",
  crypto_events: "CRYPTO",
};

export function WhatMattersNow({ clusters, onSelect }: Props) {
  const ranked = clusters.filter((c) => c.categories.length > 0).slice(0, 20);

  return (
    <div className="panel" style={{ flex: 1, minHeight: 0 }}>
      <div className="panel-header">
        <span className="panel-title">
          <span className="live-dot" />
          What Matters Now
        </span>
        <span className="faint" style={{ fontSize: 9 }}>ranked by market impact</span>
      </div>
      <div className="panel-body">
        {ranked.length === 0 && <div className="empty-note">Ingesting event stream…</div>}
        {ranked.map((c) => (
          <div key={c.id} className="event-card" onClick={() => onSelect(c)}>
            <div className="event-meta">
              <span className={`impact-pill ${impactClass(c.impactScore)}`}>{c.impactScore}</span>
              {c.categories.slice(0, 2).map((cat) => (
                <span key={cat} className="cat-tag">{CAT_LABELS[cat] ?? cat.toUpperCase()}</span>
              ))}
              <span>{c.sourceCount} src</span>
              <span>{timeAgo(c.lastUpdate)}</span>
              {c.countries.slice(0, 4).map((iso) => (
                <span key={iso} className="faint">{iso}</span>
              ))}
            </div>
            <div className="headline">{c.headline}</div>
            <div className="exposure-row">
              {c.exposures.slice(0, 5).map((e, i) => (
                <span key={i} className={`exp-chip ${e.direction > 0 ? "pos" : e.direction < 0 ? "neg" : ""}`}>
                  {e.target} {e.direction > 0 ? "+".repeat(e.strength) : e.direction < 0 ? "−".repeat(e.strength) : "±"}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

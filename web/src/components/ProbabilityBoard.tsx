import { useState } from "react";
import type { ProbabilityEstimate } from "../types";
import { Panel } from "./Panel";

interface Props {
  probabilities: ProbabilityEstimate[];
}

function Bar({ label, value, cls }: { label: string; value: number | null; cls: string }) {
  return (
    <div className="pbar">
      <span className="lbl">{label}</span>
      <span className="track">
        {value != null && <span className={`fill ${cls}`} style={{ display: "block", width: `${value * 100}%` }} />}
      </span>
      <span className="pct num">{value != null ? `${Math.round(value * 100)}%` : "—"}</span>
    </div>
  );
}

export function ProbabilityBoard({ probabilities }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Panel title="Probability Engine / Mispricing Radar" live style={{ flex: 1.3, minHeight: 0 }}>
      {probabilities.length === 0 && <div className="empty-note">Computing probability estimates…</div>}
      {probabilities.map((p) => {
        const open = openId === p.id;
        const div = p.divergence != null ? Math.round(p.divergence * 100) : null;
        return (
          <div key={p.id} className="prob-row" onClick={() => setOpenId(open ? null : p.id)}>
            <div className="prob-q">
              <span className="forecast-tag">FORECAST</span>
              {p.question}
              {p.change24h != null && Math.abs(p.change24h) >= 0.5 && (
                <span className={`delta-chip ${p.change24h > 0 ? "down" : "up"}`}>
                  {p.change24h > 0 ? "+" : ""}{p.change24h}pp/24h
                </span>
              )}
              {div != null && div >= 8 && (
                <span className="delta-chip warn" title="Model vs prediction-market divergence — potential mispricing">
                  Δ{div}pp GAP
                </span>
              )}
            </div>
            <div className="prob-bars">
              <Bar label="Model" value={p.model} cls="fill-model" />
              <Bar label="Market" value={p.predictionMarket} cls="fill-market" />
              <Bar label="Base rate" value={p.baseRate} cls="fill-base" />
            </div>
            {open && (
              <div style={{ marginTop: 8, fontSize: 10.5, fontFamily: "var(--sans)", lineHeight: 1.5 }}>
                <div className="dim" style={{ marginBottom: 4 }}>
                  <strong>Drivers:</strong>
                </div>
                {p.drivers.map((d, i) => (
                  <div key={i} className="dim" style={{ paddingLeft: 8 }}>{d}</div>
                ))}
                {p.predictionMarketLabel && (
                  <div className="faint" style={{ marginTop: 5 }}>
                    Prediction market: “{p.predictionMarketLabel}” (Polymarket)
                  </div>
                )}
                <div className="faint" style={{ marginTop: 5 }}>{p.methodology}</div>
              </div>
            )}
          </div>
        );
      })}
    </Panel>
  );
}

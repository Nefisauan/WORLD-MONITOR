import { useEffect, useState } from "react";
import { fetchWhy } from "../api";
import type { WhyExplanation } from "../types";
import { fmtPct, pctClass } from "./Panel";

interface Props {
  assetId: string;
  onClose: () => void;
  onEventClick: (eventId: string) => void;
}

export function WhyDrawer({ assetId, onClose, onEventClick }: Props) {
  const [why, setWhy] = useState<WhyExplanation | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setWhy(null);
    setError(false);
    fetchWhy(assetId).then(setWhy).catch(() => setError(true));
  }, [assetId]);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <button className="close-btn" onClick={onClose}>ESC</button>
          <div className="event-meta"><span className="cat-tag">MOVE ATTRIBUTION</span></div>
          <h2>
            Why is {why?.assetName ?? assetId} moving{" "}
            {why?.move1D != null && (
              <span className={pctClass(why.move1D)}>{fmtPct(why.move1D)}</span>
            )}
            {why?.zScore != null && Math.abs(why.zScore) >= 2 && (
              <span className="warn" style={{ fontSize: 12 }}> ({Math.abs(why.zScore).toFixed(1)}σ unusual)</span>
            )}
            ?
          </h2>
        </div>

        {error && <div className="empty-note">No attribution available for this instrument.</div>}
        {!why && !error && <div className="empty-note">Analyzing…</div>}

        {why && (
          <>
            <div className="drawer-section">
              <h3><span className="inference-tag">INFERENCE</span> Ranked explanation (model estimate)</h3>
              {why.factors.map((f, i) => (
                <div key={i} style={{ marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                    <strong style={{ fontFamily: "var(--sans)" }}>{i + 1}. {f.label}</strong>
                    <span className="num" style={{ color: "var(--accent)", fontWeight: 700 }}>{f.sharePct}%</span>
                  </div>
                  <div className="pbar" style={{ margin: "3px 0" }}>
                    <span className="track"><span className="fill fill-model" style={{ display: "block", width: `${f.sharePct}%` }} /></span>
                  </div>
                  <div className="dim" style={{ fontSize: 10.5, fontFamily: "var(--sans)", lineHeight: 1.4 }}>{f.detail}</div>
                </div>
              ))}
              <div className="faint" style={{ fontSize: 9.5, fontFamily: "var(--sans)" }}>{why.disclaimer}</div>
            </div>

            {why.relatedEvents.length > 0 && (
              <div className="drawer-section">
                <h3><span className="fact-tag">FACT</span> Live events with exposure to this asset</h3>
                {why.relatedEvents.map((e) => (
                  <div
                    key={e.id}
                    className="wire-item"
                    style={{ cursor: "pointer", padding: "4px 0" }}
                    onClick={() => onEventClick(e.id)}
                  >
                    <span className="warn num" style={{ width: 30, flexShrink: 0 }}>[{e.impactScore}]</span>
                    <span className="wire-title">{e.headline}</span>
                  </div>
                ))}
              </div>
            )}

            {why.correlatedMovers.length > 0 && (
              <div className="drawer-section">
                <h3><span className="fact-tag">FACT</span> Correlated movers today (shared exposure tags)</h3>
                {why.correlatedMovers.map((m) => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0" }}>
                    <span>{m.name}</span>
                    <span className={`num ${pctClass(m.changePct1D)}`}>{fmtPct(m.changePct1D)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { EventTimeline } from "./EventTimeline";
import { useState } from "react";
import type { AnalogueMatch, EventCluster, TransmissionNode } from "../types";
import { timeAgo } from "./Panel";

interface Props {
  cluster: EventCluster;
  onClose: () => void;
}

function ChainNode({ node }: { node: TransmissionNode }) {
  const dirClass = node.direction === 1 ? "dir-pos" : node.direction === -1 ? "dir-neg" : "";
  return (
    <div className={`chain-node ${dirClass}`}>
      <div className="chain-stage">{node.stage}</div>
      <div className="chain-label">
        {node.label}
        {node.direction === 1 && <span className="up"> ▲</span>}
        {node.direction === -1 && <span className="down"> ▼</span>}
      </div>
      <div className="chain-detail">{node.detail}</div>
      {node.children?.map((c, i) => <ChainNode key={i} node={c} />)}
    </div>
  );
}

function Analogue({ a }: { a: AnalogueMatch }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="analogue">
      <div className="analogue-head" onClick={() => setOpen(!open)}>
        <div>
          <strong style={{ fontFamily: "var(--sans)", fontSize: 12 }}>{a.name}</strong>
          <span className="faint" style={{ marginLeft: 8 }}>{a.year}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="sim-bar"><div style={{ width: `${a.similarity * 100}%` }} /></span>
          <span className="dim num">{Math.round(a.similarity * 100)}%</span>
          <span className="faint">{open ? "▾" : "▸"}</span>
        </div>
      </div>
      {open && (
        <>
          <div style={{ padding: "8px 10px 0", fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--sans)", lineHeight: 1.45 }}>
            {a.summary}
          </div>
          <div style={{ padding: "6px 10px 0", fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            What happened next (approx. historical moves)
          </div>
          <div className="outcome-grid">
            {a.outcomes.map((o, i) => (
              <div key={i} className="outcome-cell" title={o.note}>
                <div className="asset">{o.asset}</div>
                <div className={`val num ${o.movePct >= 0 ? "up" : "down"}`}>
                  {o.movePct >= 0 ? "+" : ""}{o.movePct}%
                </div>
                <div className="hz">{o.horizon}{o.note ? " *" : ""}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function EventDrawer({ cluster, onClose }: Props) {
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <button className="close-btn" onClick={onClose}>ESC</button>
          <div className="event-meta">
            <span className={`impact-pill ${cluster.impactScore >= 70 ? "impact-high" : cluster.impactScore >= 50 ? "impact-med" : "impact-low"}`}>
              IMPACT {cluster.impactScore}/100
            </span>
            <span>credibility {cluster.credibility}%</span>
            <span>{cluster.sourceCount} sources</span>
            <span>first seen {timeAgo(cluster.firstSeen)} ago</span>
          </div>
          <h2>{cluster.headline}</h2>
        </div>

        <div className="drawer-section">
          <h3><span className="inference-tag">INFERENCE</span> Impact score decomposition</h3>
          {Object.entries(cluster.impactBreakdown).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, padding: "2px 0" }}>
              <span className="dim">{k.replace(/_/g, " ")}</span>
              <span className={`num ${v >= 0 ? "up" : "down"}`}>{v >= 0 ? "+" : ""}{v}</span>
            </div>
          ))}
        </div>

        {cluster.exposures.length > 0 && (
          <div className="drawer-section">
            <h3><span className="inference-tag">INFERENCE</span> Asset exposure map</h3>
            <div className="exposure-row">
              {cluster.exposures.map((e, i) => (
                <span key={i} className={`exp-chip ${e.direction > 0 ? "pos" : e.direction < 0 ? "neg" : ""}`} title={e.note}>
                  {e.target} {e.direction > 0 ? "+".repeat(e.strength) : e.direction < 0 ? "−".repeat(e.strength) : "±"}
                </span>
              ))}
            </div>
          </div>
        )}

        {cluster.transmission && (
          <div className="drawer-section">
            <h3><span className="inference-tag">INFERENCE</span> Transmission chain</h3>
            {cluster.transmission.map((n, i) => <ChainNode key={i} node={n} />)}
          </div>
        )}

        {cluster.analogues.length > 0 && (
          <div className="drawer-section">
            <h3><span className="fact-tag">HISTORY</span> Historical analogues</h3>
            {cluster.analogues.map((a) => <Analogue key={a.episodeId} a={a} />)}
            <div className="faint" style={{ fontSize: 9.5, marginTop: 4, fontFamily: "var(--sans)" }}>
              Similarity is tag/magnitude-based matching; outcomes are approximate documented historical moves, not predictions.
            </div>
          </div>
        )}

        <EventTimeline key={cluster.id} eventId={cluster.id} />

        <div className="drawer-section">
          <h3><span className="fact-tag">FACT</span> Source reporting ({cluster.items.length})</h3>
          {cluster.items.map((it) => (
            <div key={it.id} className="wire-item" style={{ padding: "4px 0" }}>
              <span className="wire-time">{timeAgo(it.publishedAt)}</span>
              <span className="wire-src">{it.source}</span>
              <a className="wire-title" href={it.url} target="_blank" rel="noreferrer">{it.title}</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

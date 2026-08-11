import { useEffect, useState } from "react";
import { fetchBrief } from "../api";
import type { Brief } from "../types";

interface Props {
  onClose: () => void;
}

export function BriefDrawer({ onClose }: Props) {
  const [brief, setBrief] = useState<Brief | null>(null);

  useEffect(() => {
    fetchBrief().then(setBrief).catch(() => undefined);
  }, []);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <button className="close-btn" onClick={onClose}>ESC</button>
          <div className="event-meta">
            <span className="cat-tag">GLOBAL DELTA / MORNING BRIEF</span>
            {brief && <span className="faint">{brief.mode === "llm" ? "LLM-narrated" : "deterministic"} · {brief.generatedAt.slice(11, 16)} UTC</span>}
          </div>
          <h2>What changed — institutional brief</h2>
        </div>

        {!brief && <div className="empty-note">Assembling brief from live state…</div>}

        {brief?.narrative && (
          <div className="drawer-section">
            <h3><span className="inference-tag">AI NARRATIVE</span></h3>
            <div style={{ fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.55, whiteSpace: "pre-wrap", color: "var(--text)" }}>
              {brief.narrative}
            </div>
          </div>
        )}

        {brief?.sections.map((s) => (
          <div key={s.title} className="drawer-section">
            <h3>{s.title}</h3>
            {s.lines.map((l, i) => (
              <div key={i} style={{ fontSize: 11, fontFamily: l.startsWith("  ") ? "var(--mono)" : "var(--sans)", padding: "2px 0", color: l.startsWith("  ") ? "var(--text-faint)" : "var(--text-dim)", lineHeight: 1.4 }}>
                {l}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

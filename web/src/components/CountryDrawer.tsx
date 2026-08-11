import type { CountryRisk, EventCluster } from "../types";

interface Props {
  country: CountryRisk;
  clusters: EventCluster[];
  onClose: () => void;
  onEventSelect: (c: EventCluster) => void;
}

export function CountryDrawer({ country, clusters, onClose, onEventSelect }: Props) {
  const events = clusters.filter((c) => c.countries.includes(country.iso2)).slice(0, 10);
  const riskColor = country.overall >= 65 ? "var(--crit)" : country.overall >= 45 ? "var(--warn)" : "var(--up)";

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <button className="close-btn" onClick={onClose}>ESC</button>
          <div className="event-meta"><span className="cat-tag">COUNTRY DOSSIER</span></div>
          <h2>
            {country.name}{" "}
            <span className="num" style={{ color: riskColor }}>{country.overall}/100</span>
          </h2>
        </div>

        <div className="drawer-section">
          <h3><span className="inference-tag">INFERENCE</span> Risk decomposition (curated prior + live news velocity)</h3>
          {Object.entries(country.components).map(([k, v]) => (
            <div key={k} className="pbar" style={{ marginBottom: 4 }}>
              <span className="lbl" style={{ width: 90 }}>{k.replace(/_/g, " ")}</span>
              <span className="track">
                <span
                  className="fill"
                  style={{
                    display: "block",
                    width: `${v}%`,
                    background: v >= 65 ? "var(--crit)" : v >= 45 ? "var(--warn)" : "#3d4a5a",
                  }}
                />
              </span>
              <span className="pct num">{v}</span>
            </div>
          ))}
          <div className="pbar" style={{ marginTop: 6 }}>
            <span className="lbl" style={{ width: 90 }}>news velocity</span>
            <span className="track">
              <span className="fill fill-model" style={{ display: "block", width: `${country.newsVelocity}%` }} />
            </span>
            <span className="pct num">{country.newsVelocity}</span>
          </div>
        </div>

        <div className="drawer-section">
          <h3><span className="inference-tag">INFERENCE</span> What markets care about here</h3>
          {country.marketsCare.map((m, i) => (
            <div key={i} style={{ fontSize: 11.5, fontFamily: "var(--sans)", padding: "2px 0", color: "var(--text)" }}>
              · {m}
            </div>
          ))}
        </div>

        <div className="drawer-section">
          <h3><span className="fact-tag">FACT</span> Live events mentioning {country.name}</h3>
          {events.length === 0 && <div className="faint" style={{ fontSize: 11 }}>No events in current stream.</div>}
          {events.map((c) => (
            <div key={c.id} className="wire-item" style={{ cursor: "pointer", padding: "4px 0" }} onClick={() => onEventSelect(c)}>
              <span className="warn num" style={{ width: 30, flexShrink: 0 }}>[{c.impactScore}]</span>
              <span className="wire-title">{c.headline}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import type { GlobalState } from "../types";
import { fmtPct, fmtPrice, pctClass } from "./Panel";

interface Props {
  state: GlobalState | null;
  connected: boolean;
  onAssetClick: (id: string) => void;
  onBriefClick: () => void;
}

const RISK_COLOR = (score: number) => (score >= 65 ? "var(--crit)" : score >= 45 ? "var(--warn)" : "var(--up)");

export function TopBar({ state, connected, onAssetClick, onBriefClick }: Props) {
  const [utc, setUtc] = useState("");
  useEffect(() => {
    const tick = () => setUtc(new Date().toISOString().slice(11, 19) + " UTC");
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const q = (id: string) => state?.quotes[id];
  const risk = state?.globalRiskScore;
  const regime = state?.regime;

  const cells: { k: string; id?: string }[] = [
    { k: "S&P 500", id: "SPX" },
    { k: "NASDAQ", id: "NDX" },
    { k: "VIX", id: "VIX" },
    { k: "US 10Y", id: "US10Y" },
    { k: "DXY", id: "DXY" },
    { k: "GOLD", id: "GOLD" },
    { k: "WTI", id: "WTI" },
    { k: "BTC", id: "BTC" },
  ];

  return (
    <div className="topbar">
      <div className="brand">
        WORLD<span>INTEL</span>
      </div>

      <div className="top-cell" title={state?.riskDrivers.map((d) => `${d.name}: ${d.delta >= 0 ? "+" : ""}${d.delta}`).join("\n")}>
        <span className="k">Global Risk</span>
        <span className="v risk-gauge">
          <span style={{ color: risk != null ? RISK_COLOR(risk) : undefined }}>{risk ?? "—"}</span>
          <span className="track">
            <span
              className="fill"
              style={{ display: "block", width: `${risk ?? 0}%`, background: risk != null ? RISK_COLOR(risk) : "#333" }}
            />
          </span>
        </span>
      </div>

      <div className="top-cell" title={regime?.signals.map((s) => `${s.name}: ${s.value} (${s.reading})`).join("\n")}>
        <span className="k">Regime</span>
        <span className="v" style={{ color: "var(--accent)", fontSize: 11 }}>
          {regime?.regime ?? "—"} <span className="faint">{regime ? `${regime.confidence}%` : ""}</span>
        </span>
      </div>

      <div className="topbar-cells">
        {cells.map(({ k, id }) => {
          const quote = id ? q(id) : undefined;
          const isYield = id?.startsWith("US") && id !== "USDCNY";
          return (
            <div key={k} className="top-cell" style={{ cursor: "pointer" }} onClick={() => id && onAssetClick(id)}>
              <span className="k">
                {k}
                {quote?.unusual && <span style={{ color: "var(--warn)" }}> ⚠</span>}
              </span>
              <span className="v num">
                {isYield && quote?.price != null ? `${quote.price.toFixed(2)}%` : fmtPrice(quote?.price)}{" "}
                <span className={pctClass(quote?.changePct1D)} style={{ fontSize: 10 }}>
                  {fmtPct(quote?.changePct1D, 1)}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="topbar-right">
        <span className={Object.values(state?.dataHealth ?? {}).some((h) => !h.ok) ? "warn" : "dim"}
          title={Object.entries(state?.dataHealth ?? {}).map(([name, h]) => `${name}: ${h.ok ? "ok" : "degraded"} · ${h.note ?? ""} · last complete success ${h.lastSuccess ?? "never"}`).join("\n")}>
          DATA {state ? Object.values(state.dataHealth).filter((h) => !h.ok).length + " degraded" : "pending"}
        </span>
        <button className="btn" onClick={onBriefClick}>BRIEF</button>
        <span>
          <kbd>⌘K</kbd>
        </span>
        <span className="num">{utc}</span>
        <span className={`conn-dot ${connected ? "on" : "off"}`} title={connected ? "stream connected" : "stream disconnected"} />
      </div>
    </div>
  );
}

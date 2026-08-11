import { useEffect, useMemo, useState } from "react";
import type { EventCluster, Quote } from "../types";
import { Panel, fmtPct, fmtPrice, pctClass } from "./Panel";
import { Sparkline } from "./Sparkline";

interface Props {
  quotes: Record<string, Quote>;
  clusters: EventCluster[];
  onAssetClick: (id: string) => void;
}

const DEFAULT_WATCH = ["SPX", "NDX", "BTC", "GOLD", "WTI", "US10Y", "DXY"];

// Instrument tags mirror (subset) for watchlist -> event matching.
const WATCH_TAGS: Record<string, string[]> = {
  SPX: ["us_equities", "risk_asset"], NDX: ["tech", "growth_stocks", "risk_asset"], DJI: ["us_equities"],
  RUT: ["small_caps"], VIX: ["volatility"], BTC: ["crypto"], ETH: ["crypto"], SOL: ["crypto"],
  GOLD: ["gold", "safe_haven"], SILVER: ["metals"], COPPER: ["copper", "china"],
  WTI: ["oil", "energy", "middle_east"], BRENT: ["oil", "energy", "middle_east"], NATGAS: ["natgas", "energy"],
  US10Y: ["rates"], US30Y: ["rates", "fiscal"], US5Y: ["rates"], US3M: ["rates", "fed"],
  DXY: ["usd"], EURUSD: ["europe"], USDJPY: ["japan", "carry"], USDCNY: ["china", "trade_war"],
  SMH: ["semiconductors", "taiwan", "ai"], XLE: ["oil", "energy"], ITA: ["defense", "war"],
  KRE: ["banks", "credit_stress"], HYG: ["credit"], TLT: ["rates", "safe_haven"],
};

const CATEGORY_TAGS: Record<string, string[]> = {
  oil_supply: ["oil", "energy", "middle_east"],
  war_escalation: ["defense", "safe_haven", "gold", "volatility", "oil", "war"],
  sanctions_export_controls: ["semiconductors", "china", "trade_war"],
  cb_policy: ["rates", "fed", "usd", "growth_stocks", "crypto", "gold"],
  inflation_data: ["rates", "usd", "gold"],
  banking_credit_stress: ["banks", "credit", "credit_stress", "safe_haven"],
  shipping_disruption: ["oil", "energy"],
  taiwan_semis: ["semiconductors", "taiwan", "tech"],
  fiscal_sovereign: ["rates", "fiscal", "gold"],
  ai_infra: ["semiconductors", "ai", "copper", "natgas"],
  crypto_events: ["crypto"],
};

export function Watchlist({ quotes, clusters, onAssetClick }: Props) {
  const [ids, setIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("wi-watchlist") || "") as string[];
    } catch {
      return DEFAULT_WATCH;
    }
  });
  const [input, setInput] = useState("");

  useEffect(() => {
    localStorage.setItem("wi-watchlist", JSON.stringify(ids));
  }, [ids]);

  const myTags = useMemo(() => new Set(ids.flatMap((id) => WATCH_TAGS[id] ?? [])), [ids]);

  const relevantEvents = useMemo(
    () =>
      clusters
        .filter((c) => c.impactScore >= 45)
        .filter((c) => c.categories.some((cat) => (CATEGORY_TAGS[cat] ?? []).some((t) => myTags.has(t))))
        .slice(0, 4),
    [clusters, myTags],
  );

  const add = () => {
    const id = input.trim().toUpperCase();
    if (id && quotes[id] && !ids.includes(id)) setIds([...ids, id]);
    setInput("");
  };

  return (
    <Panel
      title="My World — Watchlist"
      right={<span className="faint" style={{ fontSize: 9 }}>{relevantEvents.length} developments affect you</span>}
      style={{ flex: 1.1, minHeight: 0 }}
    >
      <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
        <input
          className="watch-input"
          placeholder="Add instrument ID (e.g. BRENT, SMH, USDJPY)… Enter to add"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          list="wi-instruments"
        />
        <datalist id="wi-instruments">
          {Object.keys(quotes).map((id) => <option key={id} value={id} />)}
        </datalist>
      </div>

      <table className="grid">
        <tbody>
          {ids.map((id) => {
            const q = quotes[id];
            if (!q) return null;
            return (
              <tr key={id} onClick={() => onAssetClick(id)}>
                <td>
                  {q.name}
                  {q.unusual && q.zScore1D != null && (
                    <span className={`z-badge ${q.zScore1D > 0 ? "hot-up" : "hot"}`}>{Math.abs(q.zScore1D).toFixed(1)}σ</span>
                  )}
                </td>
                <td><Sparkline data={q.spark.length > 5 ? q.spark : q.dailySpark.slice(-30)} width={52} height={16} /></td>
                <td className="num">{q.cls === "rate" ? `${q.price?.toFixed(2)}%` : fmtPrice(q.price)}</td>
                <td className={`num ${pctClass(q.changePct1D)}`}>{fmtPct(q.changePct1D, 1)}</td>
                <td
                  className="faint"
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIds(ids.filter((x) => x !== id));
                  }}
                >
                  ✕
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {relevantEvents.length > 0 && (
        <div style={{ padding: "6px 10px" }}>
          <div className="faint" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
            Developments affecting your watchlist
          </div>
          {relevantEvents.map((c) => (
            <div key={c.id} style={{ fontSize: 10.5, fontFamily: "var(--sans)", padding: "3px 0", color: "var(--text-dim)", lineHeight: 1.35 }}>
              <span className="warn num">[{c.impactScore}]</span> {c.headline}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

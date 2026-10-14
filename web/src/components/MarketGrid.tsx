import { useMemo, useState } from "react";
import type { Quote } from "../types";
import { Sparkline } from "./Sparkline";
import { fmtPct, fmtPrice, pctClass, timeAgo } from "./Panel";

interface Props {
  quotes: Record<string, Quote>;
  onAssetClick: (id: string) => void;
}

const TABS = ["All", "US Equities", "Global Equities", "Rates", "FX", "Crypto", "Energy", "Metals", "Agriculture", "Credit", "Sectors"];

export function MarketGrid({ quotes, onAssetClick }: Props) {
  const [tab, setTab] = useState("All");

  const rows = useMemo(() => {
    const all = Object.values(quotes);
    const filtered = tab === "All" ? all : all.filter((q) => q.group === tab);
    // "All" shows the most relevant: unusual movers first, then by |1D|
    if (tab === "All") {
      return [...filtered].sort((a, b) => {
        if (a.unusual !== b.unusual) return a.unusual ? -1 : 1;
        return Math.abs(b.changePct1D ?? 0) - Math.abs(a.changePct1D ?? 0);
      });
    }
    return filtered;
  }, [quotes, tab]);

  return (
    <div className="panel" style={{ flex: 1, minHeight: 0 }}>
      <div className="panel-header">
        <span className="panel-title">

          Global Markets
        </span>
        <div className="mkt-tabs">
          {TABS.map((t) => (
            <button key={t} className={`mkt-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "US Equities" ? "US" : t === "Global Equities" ? "World" : t === "Agriculture" ? "Ags" : t}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-body">
        <table className="grid">
          <thead>
            <tr>
              <th>Instrument</th>
              <th></th>
              <th>Last</th>
              <th>1D</th>
              <th>5D</th>
              <th>1M</th>
              <th>YTD</th>
              <th>Vol30</th>
              <th>Observed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id} onClick={() => onAssetClick(q.id)} title={`${q.source} · observed ${q.asOf} · retrieved ${q.retrievedAt}\nPrice: ${q.priceKind}; history: ${q.historyStale ? "unavailable or stale" : q.historyAsOf}\nClick for move attribution`}>
                <td>
                  {q.name}
                  {q.unusual && q.zScore1D != null && (
                    <span className={`z-badge ${q.zScore1D > 0 ? "hot-up" : "hot"}`}>
                      {Math.abs(q.zScore1D).toFixed(1)}σ
                    </span>
                  )}
                  {q.priceKind === "historical_fallback" && <span className="z-badge warn">historical close</span>}
                  {q.historyStale && <span className="z-badge warn">history unavailable</span>}
                  {q.stale && <span className="z-badge" style={{ color: "var(--text-faint)" }}>stale</span>}
                </td>
                <td>
                  <Sparkline data={q.spark.length > 5 ? q.spark : q.dailySpark.slice(-30)} />
                </td>
                <td className="num">{q.cls === "rate" ? (q.price != null ? `${q.price.toFixed(2)}%` : "—") : fmtPrice(q.price)}</td>
                <td className={`num ${pctClass(q.changePct1D)}`}>{fmtPct(q.changePct1D, 2)}</td>
                <td className={`num ${pctClass(q.changePct5D)}`}>{fmtPct(q.changePct5D, 1)}</td>
                <td className={`num ${pctClass(q.changePct1M)}`}>{fmtPct(q.changePct1M, 1)}</td>
                <td className={`num ${pctClass(q.changePctYTD)}`}>{fmtPct(q.changePctYTD, 1)}</td>
                <td className="num dim">{q.vol30D != null ? `${q.vol30D.toFixed(0)}%` : "—"}</td>
                <td className="num dim">{timeAgo(q.asOf)} ago</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty-note">No live quotes for this group yet.</div>}
      </div>
    </div>
  );
}

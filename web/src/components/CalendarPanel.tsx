import type { CalendarEvent } from "../types";
import { Panel } from "./Panel";

interface Props {
  calendar: CalendarEvent[];
}

export function CalendarPanel({ calendar }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Panel title="Event Radar / Catalysts" style={{ flex: 1, minHeight: 0 }}>
      {calendar.length === 0 && <div className="empty-note">No scheduled catalysts in window.</div>}
      {calendar.map((c) => (
        <div key={c.id} className="cal-row" title={`${c.typicalReaction}\nSource: ${c.source}`}>
          <span className="cal-date num" style={c.date === today ? { color: "var(--warn)", fontWeight: 700 } : undefined}>
            {c.date === today ? "TODAY" : c.date.slice(5)}
            {c.time ? ` ${c.time.split(" ")[0]}` : ""}
          </span>
          <span
            className="cal-imp num"
            style={{ color: c.importance >= 90 ? "var(--crit)" : c.importance >= 75 ? "var(--warn)" : "var(--text-dim)" }}
          >
            {c.importance}
          </span>
          <span style={{ flex: 1, fontFamily: "var(--sans)", fontSize: 11.5 }}>
            {c.name} <span className="faint">{c.country}</span>
            <div className="faint" style={{ fontSize: 9.5 }}>{c.assets.join(" · ")}</div>
          </span>
        </div>
      ))}
    </Panel>
  );
}

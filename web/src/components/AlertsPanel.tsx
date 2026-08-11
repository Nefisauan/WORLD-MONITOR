import type { AlertItem } from "../types";
import { Panel, timeAgo } from "./Panel";

interface Props {
  alerts: AlertItem[];
}

export function AlertsPanel({ alerts }: Props) {
  return (
    <Panel title="Alert Intelligence" live style={{ flex: 1, minHeight: 0 }}>
      {alerts.length === 0 && <div className="empty-note">No active alerts — thresholds not triggered.</div>}
      {alerts.map((a) => (
        <div key={a.id} className={`alert-item ${a.severity}`}>
          <div className="alert-title">
            {a.title} <span className="faint" style={{ fontWeight: 400 }}>{timeAgo(a.ts)}</span>
          </div>
          <div className="alert-body">{a.body}</div>
        </div>
      ))}
    </Panel>
  );
}

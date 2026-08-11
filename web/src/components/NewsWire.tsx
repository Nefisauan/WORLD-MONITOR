import type { EventCluster } from "../types";
import { Panel, timeAgo } from "./Panel";

interface Props {
  clusters: EventCluster[];
  onSelect: (c: EventCluster) => void;
}

// Collapsed wire: one row per developing event (not per article).
export function NewsWire({ clusters, onSelect }: Props) {
  const recent = [...clusters]
    .sort((a, b) => b.lastUpdate.localeCompare(a.lastUpdate))
    .slice(0, 60);

  return (
    <Panel title="Wire — Deduplicated Event Stream" live style={{ flex: 1, minHeight: 0 }}>
      {recent.map((c) => (
        <div key={c.id} className="wire-item" style={{ cursor: "pointer" }} onClick={() => onSelect(c)}>
          <span className="wire-time num">{timeAgo(c.lastUpdate)}</span>
          <span className="wire-src">
            {c.sourceCount > 1 ? `${c.sourceCount} sources` : c.items[0]?.source}
          </span>
          <span className="wire-title">{c.headline}</span>
        </div>
      ))}
    </Panel>
  );
}

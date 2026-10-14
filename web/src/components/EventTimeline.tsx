import { useEffect, useState } from "react";
import type { EventCluster } from "../types";

interface TimelinePage {
  entries: { revision: number; recordedAt: string; method: string; snapshot: EventCluster }[];
  nextBefore: number | null;
}

/** Parent keys this component by event ID so paging never leaks between events. */
export function EventTimeline({ eventId }: { eventId: string }) {
  const [before, setBefore] = useState<number | null>(null);
  const [entries, setEntries] = useState<TimelinePage["entries"]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    const query = before == null ? "" : `?before=${before}`;
    fetch(`/api/v1/events/${encodeURIComponent(eventId)}/timeline${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Archive unavailable");
        return await response.json() as TimelinePage;
      })
      .then((page) => {
        if (controller.signal.aborted) return;
        setEntries((old) => before == null ? page.entries : [...old, ...page.entries]);
        setNextBefore(page.nextBefore);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [eventId, before, attempt]);

  return <div className="drawer-section">
    <h3>Recorded event timeline</h3>
    <p className="dim">Evidence snapshots in observation order. Source reporting is not independently verified.</p>
    <div className="faint" style={{ overflowWrap: "anywhere" }}>Event ID: {eventId}</div>
    {entries.map((entry) => <details key={entry.revision} className="analogue" style={{ padding: 8, marginTop: 8 }}>
      <summary>Revision {entry.revision} · {entry.recordedAt} · {entry.snapshot.sourceCount} sources</summary>
      <p>{entry.snapshot.headline}</p>
      <p className="dim">Recorded impact: {entry.snapshot.impactScore}/100 · method {entry.method}</p>
      <p className="dim">First detected {entry.snapshot.firstSeen}; latest publication {entry.snapshot.lastUpdate}.</p>
      {entry.snapshot.items.map((item) => <div key={item.id} style={{ marginBottom: 8 }}>
        <a href={item.url} target="_blank" rel="noreferrer" className="wire-title">{item.title}</a>
        <div className="faint">{item.source} · published {item.publishedAt} · detected {item.detectedAt}</div>
      </div>)}
    </details>)}
    {loading && <p role="status" className="dim">Loading recorded history…</p>}
    {error && <p role="alert" className="warn">Recorded history unavailable. <button className="btn" onClick={() => setAttempt((n) => n + 1)}>Retry</button></p>}
    {!loading && !error && entries.length === 0 && <p className="dim">No recorded revisions.</p>}
    {!loading && !error && nextBefore != null && <button className="btn" onClick={() => setBefore(nextBefore)}>Older revisions</button>}
  </div>;
}

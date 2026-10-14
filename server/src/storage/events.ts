import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { EventCluster, NewsItem } from "../types.js";

export interface EventRevision {
  revision: number;
  recordedAt: string;
  method: "lexical-events-v2";
  snapshot: EventCluster;
}

const WINDOW_MS = 36 * 3600_000;
const METHOD = "lexical-events-v2";

/** Single application writer on a local filesystem; not a distributed database. */
export class EventStore {
  private db: DatabaseSync;

  constructor(file: string) {
    if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    try {
      this.db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
      const version = Number(this.db.prepare("PRAGMA user_version").get()!.user_version);
      if (version !== 0 && version !== 1) throw new Error("Unsupported event database schema version");
      if (version === 0) this.db.exec(`
        BEGIN IMMEDIATE;
        CREATE TABLE events (id TEXT PRIMARY KEY, first_seen TEXT NOT NULL, last_update TEXT NOT NULL, latest_revision INTEGER NOT NULL) STRICT;
        CREATE TABLE event_revisions (
          event_id TEXT NOT NULL REFERENCES events(id), revision INTEGER NOT NULL,
          recorded_at TEXT NOT NULL, signature TEXT NOT NULL, snapshot TEXT NOT NULL, method TEXT NOT NULL,
          PRIMARY KEY(event_id, revision)
        ) STRICT;
        CREATE TABLE event_members (article_id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id), detected_at TEXT NOT NULL) STRICT;
        CREATE INDEX event_activity ON events(last_update);
        CREATE INDEX member_event ON event_members(event_id);
        CREATE TRIGGER immutable_revision_update BEFORE UPDATE ON event_revisions BEGIN SELECT RAISE(ABORT, 'event revisions are append-only'); END;
        CREATE TRIGGER immutable_revision_delete BEFORE DELETE ON event_revisions BEGIN SELECT RAISE(ABORT, 'event revisions are append-only'); END;
        PRAGMA user_version=1;
        COMMIT;
      `);
    } catch (error) { this.db.close(); throw error; }
  }

  close() { this.db.close(); }

  get(id: string): EventCluster | null {
    const row = this.db.prepare(`SELECT r.snapshot FROM events e JOIN event_revisions r
      ON r.event_id=e.id AND r.revision=e.latest_revision WHERE e.id=?`).get(id);
    return row ? JSON.parse(String(row.snapshot)) as EventCluster : null;
  }

  /** Recover active events plus exact owners of incoming articles, including archived owners. */
  previous(items: NewsItem[], now: number): EventCluster[] {
    const ids = new Set(this.db.prepare("SELECT id FROM events WHERE last_update > ?")
      .all(new Date(now - WINDOW_MS).toISOString()).map((row) => String(row.id)));
    const find = this.db.prepare("SELECT event_id, detected_at FROM event_members WHERE article_id=?");
    const ownership = new Map<string, { eventId: string; detectedAt: string }>();
    for (const item of items) {
      const row = find.get(item.id);
      if (row) { ids.add(String(row.event_id)); ownership.set(item.id, { eventId: String(row.event_id), detectedAt: String(row.detected_at) }); }
    }
    return [...ids].sort().map((id) => {
      const event = this.get(id)!;
      // Retain historical membership even if an article aged out of the latest snapshot.
      const known = new Set(event.items.map((item) => item.id));
      for (const item of items) {
        const membership = ownership.get(item.id);
        if (membership?.eventId === id && !known.has(item.id)) event.items.push({ ...item, detectedAt: membership.detectedAt });
      }
      return event;
    });
  }

  recoverNews(now: number): NewsItem[] {
    return [...new Map(this.previous([], now).flatMap((event) => event.items)
      .filter((item) => Date.parse(item.publishedAt) > now - WINDOW_MS && Date.parse(item.publishedAt) <= now)
      .map((item) => [item.id, item])).values()];
  }

  /** Record a polling batch atomically. Identical evidence does not generate another revision. */
  record(clusters: EventCluster[], recordedAt: string) {
    if (!Number.isFinite(Date.parse(recordedAt)) || new Date(recordedAt).toISOString() !== recordedAt) throw new Error("Invalid event record time");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const event of clusters) {
        if (!event.id || !event.items.length || !Number.isFinite(Date.parse(event.firstSeen)) ||
            !Number.isFinite(Date.parse(event.lastUpdate)) || Date.parse(event.firstSeen) > Date.parse(recordedAt) ||
            Date.parse(event.lastUpdate) > Date.parse(recordedAt)) throw new Error("Invalid event snapshot");
        const previous = this.db.prepare(`SELECT e.latest_revision, e.first_seen, r.signature, r.recorded_at FROM events e
          JOIN event_revisions r ON r.event_id=e.id AND r.revision=e.latest_revision WHERE e.id=?`).get(event.id);
        if (previous && String(previous.recorded_at) > recordedAt) throw new Error("Event record time cannot move backwards");
        if (previous && previous.first_seen !== event.firstSeen) throw new Error("Event first detection cannot change");
        // Age-only score decay is not new source evidence. Full point-in-time scores
        // are still preserved whenever evidence changes.
        const signature = createHash("sha256").update(JSON.stringify({ method: METHOD,
          headline: event.headline, categories: event.categories, countries: event.countries,
          items: [...event.items].sort((a, b) => a.id.localeCompare(b.id)),
        })).digest("hex");
        if (previous?.signature === signature) continue;
        const revision = previous ? Number(previous.latest_revision) + 1 : 1;
        this.db.prepare(`INSERT INTO events VALUES(?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET last_update=excluded.last_update, latest_revision=excluded.latest_revision`)
          .run(event.id, event.firstSeen, event.lastUpdate, revision);
        const member = this.db.prepare("INSERT INTO event_members VALUES(?, ?, ?) ON CONFLICT(article_id) DO NOTHING");
        const owner = this.db.prepare("SELECT event_id, detected_at FROM event_members WHERE article_id=?");
        for (const item of event.items) {
          member.run(item.id, event.id, item.detectedAt);
          if (owner.get(item.id)?.event_id !== event.id) throw new Error("Article already belongs to another event");
        }
        this.db.prepare("INSERT INTO event_revisions VALUES(?, ?, ?, ?, ?, ?)")
          .run(event.id, revision, recordedAt, signature, JSON.stringify(event), METHOD);
      }
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  timeline(id: string, before = Number.MAX_SAFE_INTEGER, limit = 20): { entries: EventRevision[]; nextBefore: number | null } {
    if (!Number.isSafeInteger(before) || before < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error("Invalid timeline pagination");
    const rows = this.db.prepare(`SELECT revision, recorded_at, snapshot, method FROM event_revisions
      WHERE event_id=? AND revision<? ORDER BY revision DESC LIMIT ?`).all(id, before, limit + 1);
    const entries = rows.slice(0, limit).map((row): EventRevision => ({
      revision: Number(row.revision), recordedAt: String(row.recorded_at), method: String(row.method) as EventRevision["method"],
      snapshot: JSON.parse(String(row.snapshot)) as EventCluster,
    }));
    return { entries, nextBefore: rows.length > limit ? entries.at(-1)!.revision : null };
  }
}

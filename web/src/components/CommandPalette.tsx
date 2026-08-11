import { useEffect, useMemo, useRef, useState } from "react";
import type { CountryRisk, EventCluster, Quote } from "../types";

export interface Command {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  quotes: Record<string, Quote>;
  clusters: EventCluster[];
  countryRisk: CountryRisk[];
  onAsset: (id: string) => void;
  onEvent: (c: EventCluster) => void;
  onCountry: (c: CountryRisk) => void;
  onBrief: () => void;
}

export function CommandPalette({ open, onClose, quotes, clusters, countryRisk, onAsset, onEvent, onCountry, onBrief }: Props) {
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = [
      { id: "brief", label: "/brief — What changed? Morning brief", hint: "global delta", run: onBrief },
    ];
    for (const q of Object.values(quotes)) {
      cmds.push({
        id: `why-${q.id}`,
        label: `/why ${q.id} — ${q.name}`,
        hint: "move attribution",
        run: () => onAsset(q.id),
      });
    }
    for (const c of countryRisk) {
      cmds.push({
        id: `country-${c.iso2}`,
        label: `/country ${c.name}`,
        hint: `risk ${c.overall}/100`,
        run: () => onCountry(c),
      });
    }
    for (const c of clusters.slice(0, 40)) {
      cmds.push({
        id: `event-${c.id}`,
        label: c.headline,
        hint: `event ${c.impactScore}/100`,
        run: () => onEvent(c),
      });
    }
    return cmds;
  }, [quotes, clusters, countryRisk, onAsset, onEvent, onCountry, onBrief]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return commands.slice(0, 14);
    return commands
      .filter((c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q))
      .slice(0, 14);
  }, [commands, query]);

  if (!open) return null;

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          placeholder="Search assets, events, countries… try: why btc · country china · brief · hormuz"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setSel((s) => Math.min(s + 1, filtered.length - 1));
            else if (e.key === "ArrowUp") setSel((s) => Math.max(s - 1, 0));
            else if (e.key === "Enter" && filtered[sel]) {
              filtered[sel].run();
              onClose();
            } else if (e.key === "Escape") onClose();
          }}
        />
        <div className="palette-results">
          {filtered.map((c, i) => (
            <div
              key={c.id}
              className={`palette-item ${i === sel ? "sel" : ""}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => {
                c.run();
                onClose();
              }}
            >
              <span style={{ fontFamily: "var(--sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
              <span className="hint">{c.hint}</span>
            </div>
          ))}
          {filtered.length === 0 && <div className="empty-note">No matches.</div>}
        </div>
      </div>
    </div>
  );
}

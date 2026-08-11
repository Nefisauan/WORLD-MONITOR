import { useCallback, useEffect, useState } from "react";
import { useGlobalState } from "./api";
import type { CountryRisk, EventCluster } from "./types";
import { TopBar } from "./components/TopBar";
import { MarketGrid } from "./components/MarketGrid";
import { WhatMattersNow } from "./components/WhatMattersNow";
import { EventDrawer } from "./components/EventDrawer";
import { WorldMap } from "./components/WorldMap";
import { ProbabilityBoard } from "./components/ProbabilityBoard";
import { CalendarPanel } from "./components/CalendarPanel";
import { AlertsPanel } from "./components/AlertsPanel";
import { NewsWire } from "./components/NewsWire";
import { Watchlist } from "./components/Watchlist";
import { WhyDrawer } from "./components/WhyDrawer";
import { CountryDrawer } from "./components/CountryDrawer";
import { BriefDrawer } from "./components/BriefDrawer";
import { CommandPalette } from "./components/CommandPalette";
import { Panel } from "./components/Panel";

export default function App() {
  const { state, connected } = useGlobalState();
  const [selectedEvent, setSelectedEvent] = useState<EventCluster | null>(null);
  const [whyAsset, setWhyAsset] = useState<string | null>(null);
  const [country, setCountry] = useState<CountryRisk | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
        setSelectedEvent(null);
        setWhyAsset(null);
        setCountry(null);
        setBriefOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openEventById = useCallback(
    (id: string) => {
      const c = state?.clusters.find((x) => x.id === id);
      if (c) {
        setWhyAsset(null);
        setSelectedEvent(c);
      }
    },
    [state],
  );

  return (
    <div className="app">
      <TopBar
        state={state}
        connected={connected}
        onAssetClick={setWhyAsset}
        onBriefClick={() => setBriefOpen(true)}
      />

      <div className="main-grid">
        {/* Left: what matters + alerts */}
        <div className="col">
          <WhatMattersNow clusters={state?.clusters ?? []} onSelect={setSelectedEvent} />
          <AlertsPanel alerts={state?.alerts ?? []} />
        </div>

        {/* Center: map + markets */}
        <div className="col">
          <Panel title="Global Intelligence Map" live style={{ flex: 1.1, minHeight: 220 }}>
            <WorldMap
              points={state?.mapPoints ?? []}
              countryRisk={state?.countryRisk ?? []}
              onCountryClick={setCountry}
            />
          </Panel>
          <MarketGrid quotes={state?.quotes ?? {}} onAssetClick={setWhyAsset} />
        </div>

        {/* Right: probabilities, watchlist, calendar, wire */}
        <div className="col col-right">
          <ProbabilityBoard probabilities={state?.probabilities ?? []} />
          <Watchlist quotes={state?.quotes ?? {}} clusters={state?.clusters ?? []} onAssetClick={setWhyAsset} />
          <CalendarPanel calendar={state?.calendar ?? []} />
          <NewsWire clusters={state?.clusters ?? []} onSelect={setSelectedEvent} />
        </div>
      </div>

      {selectedEvent && <EventDrawer cluster={selectedEvent} onClose={() => setSelectedEvent(null)} />}
      {whyAsset && (
        <WhyDrawer assetId={whyAsset} onClose={() => setWhyAsset(null)} onEventClick={openEventById} />
      )}
      {country && (
        <CountryDrawer
          country={country}
          clusters={state?.clusters ?? []}
          onClose={() => setCountry(null)}
          onEventSelect={(c) => {
            setCountry(null);
            setSelectedEvent(c);
          }}
        />
      )}
      {briefOpen && <BriefDrawer onClose={() => setBriefOpen(false)} />}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        quotes={state?.quotes ?? {}}
        clusters={state?.clusters ?? []}
        countryRisk={state?.countryRisk ?? []}
        onAsset={setWhyAsset}
        onEvent={setSelectedEvent}
        onCountry={setCountry}
        onBrief={() => setBriefOpen(true)}
      />
    </div>
  );
}

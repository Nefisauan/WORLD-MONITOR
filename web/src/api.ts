import { useEffect, useRef, useState } from "react";
import type { Brief, GlobalState, MacroResponse, WhyExplanation } from "./types";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

/** Live global state: initial snapshot + SSE-driven refetches (debounced). */
export function useGlobalState(): { state: GlobalState | null; connected: boolean } {
  const [state, setState] = useState<GlobalState | null>(null);
  const [connected, setConnected] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    const refetch = () => {
      getJson<GlobalState>("/api/state")
        .then((s) => alive && setState(s))
        .catch(() => undefined);
    };
    refetch();

    const es = new EventSource("/api/stream");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener("update", () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(refetch, 400);
    });
    const poll = setInterval(refetch, 90_000); // safety net

    return () => {
      alive = false;
      es.close();
      clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { state, connected };
}

export const fetchWhy = (assetId: string) => getJson<WhyExplanation>(`/api/why/${assetId}`);
export const fetchBrief = () => getJson<Brief>("/api/brief");
export const fetchMacro = () => getJson<MacroResponse>("/api/macro");
export const fetchConfig = () => getJson<{ fred: boolean; finnhub: boolean; llm: string | null }>("/api/config");

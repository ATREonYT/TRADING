"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RadarPayload } from "@/lib/radar/types";

interface LiveState<T> {
  data: T[];
  degraded: boolean;
  notes: string[];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  /** ids that appeared since the previous poll — for "new" flash animations */
  freshIds: Set<string>;
  refresh: () => void;
}

/**
 * Polls a Radar API endpoint on an interval, keeps the UI live, and reports
 * which items are newly arrived so the feed can flash them. `paused` pauses
 * polling (e.g. when the tab is hidden) to save quota.
 */
export function useLive<T extends { id?: string; symbol?: string }>(
  url: string,
  intervalMs = 20000,
  idKey: (item: T) => string = (i) => i.id ?? i.symbol ?? "",
): LiveState<T> {
  const [state, setState] = useState<Omit<LiveState<T>, "refresh">>({
    data: [],
    degraded: false,
    notes: [],
    loading: true,
    error: null,
    lastUpdated: null,
    freshIds: new Set(),
  });
  const seen = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as RadarPayload<T>;
      if (!active.current) return;
      const fresh = new Set<string>();
      for (const it of json.items) {
        const id = idKey(it);
        if (id && !seen.current.has(id)) {
          fresh.add(id);
          seen.current.add(id);
        }
      }
      // First load shouldn't flash everything.
      const isFirst = state.lastUpdated === null;
      setState({
        data: json.items,
        degraded: json.degraded,
        notes: json.notes ?? [],
        loading: false,
        error: null,
        lastUpdated: Date.now(),
        freshIds: isFirst ? new Set() : fresh,
      });
    } catch (e) {
      if (!active.current) return;
      setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    active.current = true;
    const tick = async () => {
      if (typeof document === "undefined" || !document.hidden) await load();
      timer.current = setTimeout(tick, intervalMs);
    };
    tick();
    return () => {
      active.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, intervalMs]);

  return { ...state, refresh: load };
}

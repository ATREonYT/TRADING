"use client";

/**
 * Live floor presence — polls GET httpBase()/presence on an interval.
 * Fails silently (empty map) when the floor server is offline or during SSR.
 */

import { useEffect, useState } from "react";
import { httpBase } from "@/lib/net";

export function usePresence(pollMs = 15_000): Record<string, number> {
  const [floors, setFloors] = useState<Record<string, number>>({});

  useEffect(() => {
    let ctrl: AbortController | null = null;
    let disposed = false;

    const load = async (): Promise<void> => {
      const base = httpBase();
      if (!base) return;
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const res = await fetch(`${base}/presence`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (disposed || !data || typeof data !== "object") return;
        const f = (data as { floors?: unknown }).floors;
        if (!f || typeof f !== "object" || Array.isArray(f)) return;
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(f as Record<string, unknown>)) {
          if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
        }
        setFloors(out);
      } catch {
        // Offline or aborted — the UI just shows no presence. Quietly.
      }
    };

    void load();
    const timer = setInterval(() => void load(), pollMs);
    return () => {
      disposed = true;
      clearInterval(timer);
      ctrl?.abort();
    };
  }, [pollMs]);

  return floors;
}

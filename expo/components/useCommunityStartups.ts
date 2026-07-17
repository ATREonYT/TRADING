"use client";

/**
 * Every community startup on the site — one entry per claimed stand, live or
 * away, polled from GET httpBase()/startups. The directory merges these with
 * the seed startups so anything a founder sets up is searchable within
 * seconds, and its category joins the filter chips automatically.
 * Fails silently (empty list) when the floor server is offline or during SSR.
 */

import { useEffect, useState } from "react";
import { httpBase } from "@/lib/net";
import type { Startup } from "@/lib/types";

export interface CommunityStartup {
  /** null = registered from the profile editor, no floor stand claimed yet. */
  floorId: string | null;
  spotIndex: number;
  /** Founder currently walking that floor (vs. an away stand). */
  online: boolean;
  lastSeen: number;
  startup: Startup;
}

function isEntry(v: unknown): v is CommunityStartup {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  const s = e.startup as Record<string, unknown> | undefined;
  return (
    (typeof e.floorId === "string" || e.floorId === null) &&
    typeof e.spotIndex === "number" &&
    typeof e.online === "boolean" &&
    typeof e.lastSeen === "number" &&
    !!s &&
    typeof s === "object" &&
    typeof s.id === "string" &&
    typeof s.name === "string"
  );
}

export function useCommunityStartups(pollMs = 20_000): CommunityStartup[] {
  const [startups, setStartups] = useState<CommunityStartup[]>([]);

  useEffect(() => {
    let ctrl: AbortController | null = null;
    let disposed = false;

    const load = async (): Promise<void> => {
      const base = httpBase();
      if (!base) return;
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const res = await fetch(`${base}/startups`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (disposed || !data || typeof data !== "object") return;
        const list = (data as { startups?: unknown }).startups;
        if (!Array.isArray(list)) return;
        setStartups(list.filter(isEntry));
      } catch {
        // Offline or aborted — the directory just shows the seed startups.
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

  return startups;
}

"use client";

/**
 * Cross-device progress sync. The store pushes a debounced snapshot of app
 * state (booth, badges, quests, streaks, membership) to the floor server
 * under the current identity; on load — and after signing in — it pulls
 * and applies whatever is newer than this device's last sync point.
 *
 * Merge rule is last-writer-wins by server timestamp: simple, predictable,
 * and right for a single person hopping devices. The pulled blob goes
 * through the store's own defensive sanitize() before it touches anything,
 * exactly like localStorage does.
 */

import { httpBase } from "@/lib/net";
import { guestSecret, tokenFor } from "@/lib/auth";
import type { AppState } from "@/lib/types";

export const SYNC_TS_KEY = "founderfloor:sync-ts";

/** The slice of state that travels: everything except device-local marks. */
export function syncableState(s: AppState): Record<string, unknown> {
  const { lastSeenAt: _seen, prevSeenAt: _prev, ...rest } = s;
  return rest;
}

export async function pullState(
  me: string,
): Promise<{ state: unknown; savedAt: number } | null> {
  const base = httpBase();
  if (!base || !me) return null;
  try {
    const tok = tokenFor(me);
    const gs = guestSecret();
    const headers: Record<string, string> = {};
    if (tok) headers.Authorization = `Bearer ${tok}`;
    if (gs) headers["X-FF-GS"] = gs;
    const res = await fetch(`${base}/state?me=${encodeURIComponent(me)}`, { headers });
    if (!res.ok) return null;
    const data = (await res.json()) as { state?: unknown; savedAt?: number };
    return { state: data.state ?? null, savedAt: typeof data.savedAt === "number" ? data.savedAt : 0 };
  } catch {
    return null; // offline — local-only until the server is back
  }
}

/** Returns the server's savedAt on success, null on failure/offline. */
export async function pushState(me: string, state: Record<string, unknown>): Promise<number | null> {
  const base = httpBase();
  if (!base || !me) return null;
  try {
    const res = await fetch(`${base}/state/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ me, state, token: tokenFor(me), gs: guestSecret() }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; savedAt?: number };
    return data.ok && typeof data.savedAt === "number" ? data.savedAt : null;
  } catch {
    return null;
  }
}

export function getLastSyncTs(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(SYNC_TS_KEY) || 0);
  } catch {
    return 0;
  }
}

export function setLastSyncTs(ts: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SYNC_TS_KEY, String(ts));
  } catch {
    // storage blocked — we'll just pull again next load
  }
}

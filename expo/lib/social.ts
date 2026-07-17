"use client";

/**
 * Client for the floor server's social API (mutual connections + off-floor
 * DMs). See server/index.mjs: GET /social, POST /social/request|respond|dm.
 * Everything degrades to no-ops when the server is unreachable.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState, InboxData, ProfileCard } from "@/lib/types";
import { httpBase } from "@/lib/net";
import { tokenFor } from "@/lib/auth";

export const EMPTY_INBOX: InboxData = {
  requests: [],
  outgoing: [],
  connections: [],
  threads: {},
};

/** The requester's calling card, built from local state at request time. */
export function buildCard(state: AppState): ProfileCard {
  return {
    id: state.profile.id,
    name: state.profile.name || "founder",
    title: state.profile.title,
    status: state.profile.status,
    badges: state.badges.slice(0, 20),
    connections: state.connections.length,
    startupName: state.myStartup?.name,
    startupRevenue: state.myStartup?.verifiedRevenue,
    floorsVisited: state.quest.floors.length,
  };
}

async function post(path: string, body: unknown): Promise<boolean> {
  const base = httpBase();
  if (!base) return false;
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function sendConnectRequest(card: ProfileCard, to: string): Promise<boolean> {
  return post("/social/request", { card, to, token: tokenFor(card.id) });
}

export function respondToRequest(
  me: string,
  meName: string,
  peer: string,
  accept: boolean,
): Promise<boolean> {
  return post("/social/respond", { me, meName, peer, accept, token: tokenFor(me) });
}

export function sendSocialDm(
  from: string,
  fromName: string,
  to: string,
  text: string,
): Promise<boolean> {
  return post("/social/dm", { from, fromName, to, text, token: tokenFor(from) });
}

export async function fetchInbox(me: string, signal?: AbortSignal): Promise<InboxData | null> {
  const base = httpBase();
  if (!base || !me) return null;
  try {
    const tok = tokenFor(me);
    const res = await fetch(
      `${base}/social?me=${encodeURIComponent(me)}${tok ? `&token=${encodeURIComponent(tok)}` : ""}`,
      { signal },
    );
    if (!res.ok) return null;
    return (await res.json()) as InboxData;
  } catch {
    return null;
  }
}

/**
 * Poll the inbox while mounted. Returns [inbox, refresh, reachable].
 * A null profile id (pre-hydration) polls nothing.
 */
export function useInbox(
  profileId: string,
  intervalMs = 10_000,
): [InboxData, () => void, boolean] {
  const [inbox, setInbox] = useState<InboxData>(EMPTY_INBOX);
  const [reachable, setReachable] = useState(true);
  const idRef = useRef(profileId);
  idRef.current = profileId;

  const refresh = useCallback(() => {
    const id = idRef.current;
    if (!id) return;
    void fetchInbox(id).then((data) => {
      setReachable(data !== null);
      if (data) setInbox(data);
    });
  }, []);

  useEffect(() => {
    if (!profileId) return;
    refresh();
    const t = setInterval(refresh, intervalMs);
    return () => clearInterval(t);
  }, [profileId, intervalMs, refresh]);

  return [inbox, refresh, reachable];
}

/** localStorage-backed "last seen" per DM thread, for unread dots. */
const SEEN_KEY = "founderfloor:dm-seen";

export function getSeenMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function markThreadSeen(peerId: string, ts: number): void {
  if (typeof window === "undefined") return;
  const map = getSeenMap();
  map[peerId] = Math.max(map[peerId] ?? 0, ts);
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(map));
  } catch {
    // storage full/blocked — unread dots degrade gracefully
  }
}

/** Count threads with messages newer than their seen mark (not from me). */
export function unreadCount(inbox: InboxData, me: string): number {
  const seen = getSeenMap();
  let n = 0;
  for (const [peerId, msgs] of Object.entries(inbox.threads)) {
    const last = msgs.length ? msgs[msgs.length - 1] : null;
    if (last && last.fromId !== me && last.ts > (seen[peerId] ?? 0)) n++;
  }
  return n + inbox.requests.length;
}

"use client";

/**
 * Client for the floor server's social API (mutual connections + off-floor
 * DMs). See server/index.mjs: GET /social, POST /social/request|respond|dm.
 * Everything degrades to no-ops when the server is unreachable.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState, InboxData, ProfileCard, Startup } from "@/lib/types";
import { httpBase } from "@/lib/net";
import { guestSecret, tokenFor } from "@/lib/auth";

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
  return post("/social/request", { card, to, token: tokenFor(card.id), gs: guestSecret() });
}

export function respondToRequest(
  me: string,
  meName: string,
  peer: string,
  accept: boolean,
  meStartup?: string,
): Promise<boolean> {
  return post("/social/respond", {
    me,
    meName,
    peer,
    accept,
    meStartup,
    token: tokenFor(me),
    gs: guestSecret(),
  });
}

export function sendSocialDm(
  from: string,
  fromName: string,
  to: string,
  text: string,
): Promise<boolean> {
  return post("/social/dm", { from, fromName, to, text, token: tokenFor(from), gs: guestSecret() });
}

/**
 * Put a startup in the site-wide registry the moment it's created — the
 * directory lists it (category chip included) before its founder ever
 * claims a floor stand. Fire-and-forget; offline saves stay local-only
 * until the next save while the server is up.
 */
export function registerStartup(me: string, startup: Startup): Promise<boolean> {
  return post("/startups/register", { me, startup, token: tokenFor(me), gs: guestSecret() });
}

export function unregisterStartup(me: string): Promise<boolean> {
  return post("/startups/unregister", { me, token: tokenFor(me), gs: guestSecret() });
}

export async function fetchInbox(me: string, signal?: AbortSignal): Promise<InboxData | null> {
  const base = httpBase();
  if (!base || !me) return null;
  try {
    // Credentials travel in headers, not the query string — URLs end up in
    // proxy logs and browser history.
    const tok = tokenFor(me);
    const gs = guestSecret();
    const headers: Record<string, string> = {};
    if (tok) headers.Authorization = `Bearer ${tok}`;
    if (gs) headers["X-FF-GS"] = gs;
    const res = await fetch(`${base}/social?me=${encodeURIComponent(me)}`, { signal, headers });
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

/**
 * Live social pushes for pages that aren't on a floor: opens a lightweight
 * ws connection to the invisible "__inbox" room, where the server delivers
 * connect_request / connect_accept / social_dm events instantly. Reconnects
 * every 5s while mounted; silently offline when the server is down.
 */
export function useSocialPush(
  profileId: string,
  onEvent: (ev: { t: string } & Record<string, unknown>) => void,
): void {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!profileId || typeof window === "undefined") return;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const open = () => {
      if (closed) return;
      const base = httpBase().replace(/^http/, "ws");
      if (!base) return;
      try {
        ws = new WebSocket(`${base}/ws?floor=__inbox`);
      } catch {
        retry = setTimeout(open, 5000);
        return;
      }
      ws.onopen = () => {
        ws?.send(
          JSON.stringify({
            t: "join",
            player: { id: profileId, name: "inbox", look: { skin: 0, outfit: 0, hair: 0 } },
            s: { x: 0, y: 0, dir: "down", moving: false },
            token: tokenFor(profileId),
            gs: guestSecret(),
          }),
        );
      };
      ws.onmessage = (e) => {
        try {
          const ev = JSON.parse(String(e.data)) as { t: string } & Record<string, unknown>;
          if (ev.t === "social_dm" || ev.t === "connect_request" || ev.t === "connect_accept") {
            cbRef.current(ev);
          }
        } catch {
          // malformed frame — ignore
        }
      };
      ws.onclose = () => {
        ws = null;
        if (!closed) retry = setTimeout(open, 5000);
      };
      ws.onerror = () => {
        // close follows; the close handler schedules the retry
      };
    };

    open();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      try {
        ws?.close(1000);
      } catch {
        // already closed
      }
    };
  }, [profileId]);
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

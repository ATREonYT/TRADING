/**
 * FounderFloor — WebSocket net client (browser-only transport).
 *
 * Implements the NetClient contract in lib/types.ts against the floor server
 * in server/index.mjs. Every method is a safe no-op during SSR. Also exports
 * httpBase() — the server's HTTP origin for GET /presence and GET /guestbook,
 * derived from the same source as the ws URL.
 *
 * Offline behavior:
 * - If the socket never opens at all, one {t:"status", online:false, count:1}
 *   event fires and the client goes dormant (sends become no-ops) — the game
 *   then runs single-player. Tab focus / network-online wakes it for another
 *   attempt, so a server that comes up later is still found.
 * - If a previously-open socket drops, the same offline status fires once and
 *   the client keeps retrying forever with capped exponential backoff (3s,
 *   6s, ... 30s), re-sending join with the last known MoveState. A laptop
 *   sleep or server restart must never permanently strand a live session.
 */

import type { BoothClaim, EmoteKind, MoveState, NetClient, NetEvent, PlayerProfile } from "@/lib/types";

const RECONNECT_DELAY_MS = 3000;
const RECONNECT_DELAY_MAX_MS = 30_000;

/**
 * HTTP origin of the floor server (same host/port as the ws endpoint), e.g.
 * "http://host:3001" — for GET /presence and GET /guestbook. Derived exactly
 * like the ws URL: NEXT_PUBLIC_WS_URL with a ws->http scheme swap when set,
 * otherwise the page's hostname on :3001. Returns "" during SSR, and for an
 * unparsable NEXT_PUBLIC_WS_URL (which would leave the ws client offline too).
 */
export function httpBase(): string {
  if (typeof window === "undefined") return ""; // SSR — no origin to derive
  const env = process.env.NEXT_PUBLIC_WS_URL;
  if (env) {
    try {
      return new URL(env.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:")).origin;
    } catch {
      return "";
    }
  }
  return `${window.location.protocol === "https:" ? "https" : "http"}://${window.location.hostname}:3001`;
}

/**
 * Bearer token for a signed-in account id (read inline rather than importing
 * lib/auth.ts, which imports this module — keeps the graph acyclic). Guests
 * return undefined and JSON.stringify drops the key.
 */
function authTokenFor(profileId: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem("founderfloor:auth");
    const a = raw ? (JSON.parse(raw) as { id?: string; token?: string }) : null;
    return a && a.id === profileId && typeof a.token === "string" ? a.token : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Guest secret (same key/logic as lib/auth.ts guestSecret(), duplicated here
 * for the same acyclic-import reason as authTokenFor). Sent with join so the
 * server can bind guest ids to this browser — see verifyIdentity server-side.
 */
function guestSecretInline(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const existing = window.localStorage.getItem("founderfloor:gs");
    if (existing && existing.length >= 16) return existing;
    const s = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    window.localStorage.setItem("founderfloor:gs", s);
    return s;
  } catch {
    return undefined;
  }
}

type Phase =
  | "idle" // created, connect() not called yet
  | "connecting" // socket created, waiting for open
  | "open" // connected and joined
  | "waiting" // dropped after open; reconnect timer pending
  | "dormant" // gave up; sends are no-ops, no further events
  | "closed"; // disconnect() called

export function createNetClient(wsUrl?: string): NetClient {
  const subs = new Set<(ev: NetEvent) => void>();

  let phase: Phase = "idle";
  let ws: WebSocket | null = null;
  let selfId = "";
  let floorId = "";
  let me: PlayerProfile | null = null;
  let lastMove: MoveState | null = null;
  let myClaim: BoothClaim | null = null; // re-announced with join on reconnect
  let backoffMs = RECONNECT_DELAY_MS; // doubles per failed retry, capped
  let reconnectAttempt = false; // is the current socket a reconnect attempt?
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let warned = false; // at most one console.warn per client lifetime
  let wakeListener: (() => void) | null = null; // visibility/online revival

  const isBrowser = (): boolean => typeof window !== "undefined";

  function emit(ev: NetEvent): void {
    // Snapshot so subscribers can unsubscribe (or subscribe) mid-dispatch.
    for (const cb of [...subs]) {
      try {
        cb(ev);
      } catch {
        // A throwing subscriber must never break the transport.
      }
    }
  }

  function resolveUrl(): string {
    // Priority: explicit argument > NEXT_PUBLIC_WS_URL > same-host default.
    // The default follows wherever the page is served from — never a
    // hardcoded localhost — so LAN/tunnel access works out of the box.
    const base =
      wsUrl ||
      process.env.NEXT_PUBLIC_WS_URL ||
      `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:3001/ws`;
    const u = new URL(base);
    u.searchParams.set("floor", floorId);
    return u.toString();
  }

  function clearTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function detach(sock: WebSocket): void {
    sock.onopen = null;
    sock.onmessage = null;
    sock.onerror = null;
    sock.onclose = null;
  }

  function dropSocket(): void {
    if (!ws) return;
    const old = ws;
    ws = null;
    detach(old);
    if (old.readyState === WebSocket.CONNECTING) {
      // Closing a CONNECTING socket logs a browser console warning (and can
      // throw in some engines). Let the handshake settle, then close —
      // relevant under React strict mode's mount/unmount/mount cycle.
      old.onopen = () => old.close(1000);
      old.onerror = () => {
        // Swallow — this socket is abandoned; nothing listens anymore.
      };
      return;
    }
    try {
      old.close(1000);
    } catch {
      // Already closing/closed — ignore.
    }
  }

  function goDormant(): void {
    phase = "dormant";
    clearTimer();
    if (!warned) {
      warned = true;
      // Single concise line — the game keeps running offline, so no spam.
      console.warn("[net] floor server unreachable — continuing offline");
    }
  }

  function emitOffline(): void {
    emit({ t: "status", online: false, count: 1 });
  }

  function retryNow(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    phase = "connecting";
    reconnectAttempt = true;
    openSocket();
  }

  function scheduleReconnect(): void {
    phase = "waiting";
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (phase !== "waiting") return;
      retryNow();
    }, backoffMs);
    backoffMs = Math.min(backoffMs * 2, RECONNECT_DELAY_MAX_MS);
  }

  function handleFailure(hadOpened: boolean): void {
    if (phase === "closed" || phase === "dormant") return;
    if (hadOpened) {
      // A live connection dropped: announce offline once for this outage,
      // then retry forever with fresh backoff — an outage longer than any
      // fixed budget (laptop sleep, server restart) must not strand the tab.
      emitOffline();
      backoffMs = RECONNECT_DELAY_MS;
      scheduleReconnect();
    } else if (revivedFromDormant) {
      // A wake()-triggered probe from dormancy failed — the server is still
      // down. Back to (quiet) dormancy rather than an endless retry loop on
      // a machine that may simply not be running the floor server.
      revivedFromDormant = false;
      goDormant();
    } else if (reconnectAttempt) {
      // A reconnect attempt failed; offline was already announced. Keep at
      // it — the next try backs off up to the cap.
      scheduleReconnect();
    } else {
      // The very first connection never opened: one offline signal, then
      // dormant — the game runs single-player with NPC founders only. A tab
      // focus or network-online event wakes it for another attempt.
      emitOffline();
      goDormant();
    }
  }

  let revivedFromDormant = false;

  /** Focus/online: fire a pending retry immediately, or revive a dormant client. */
  function wake(): void {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    if (phase === "waiting") {
      backoffMs = RECONNECT_DELAY_MS;
      retryNow();
    } else if (phase === "dormant" && me && lastMove) {
      backoffMs = RECONNECT_DELAY_MS;
      revivedFromDormant = true;
      retryNow();
    }
  }

  function openSocket(): void {
    let sock: WebSocket;
    try {
      sock = new WebSocket(resolveUrl());
    } catch {
      handleFailure(false);
      return;
    }
    ws = sock;
    let opened = false;

    sock.onopen = () => {
      if (ws !== sock) return;
      opened = true;
      phase = "open";
      reconnectAttempt = false;
      revivedFromDormant = false;
      backoffMs = RECONNECT_DELAY_MS; // a future outage gets a fresh budget
      if (me && lastMove) {
        // player is the full profile — id/name/look plus the optional status
        // line, which the server relays on join and hover cards read.
        // JSON.stringify drops the claim key when it is null -> undefined.
        sock.send(
          JSON.stringify({
            t: "join",
            player: me,
            s: lastMove,
            claim: myClaim ?? undefined,
            token: authTokenFor(me.id),
            gs: guestSecretInline(),
          }),
        );
      }
    };

    sock.onmessage = (e: MessageEvent) => {
      if (ws !== sock) return;
      let raw: unknown;
      try {
        raw = JSON.parse(String(e.data));
      } catch {
        return; // malformed frame — ignore
      }
      if (typeof raw !== "object" || raw === null || typeof (raw as { t?: unknown }).t !== "string") {
        return;
      }
      const ev = raw as NetEvent;
      if (ev.t === "welcome") selfId = ev.selfId;
      emit(ev); // dispatch parsed server events verbatim
    };

    sock.onerror = () => {
      // Browsers always follow error with close; the close handler decides.
    };

    sock.onclose = () => {
      if (ws !== sock) return;
      ws = null;
      handleFailure(opened);
    };
  }

  return {
    get online(): boolean {
      return phase === "open";
    },

    get selfId(): string {
      return selfId;
    },

    connect(fid: string, m: PlayerProfile, spawn: MoveState, claim?: BoothClaim): void {
      if (!isBrowser()) return; // SSR no-op
      // Calling connect while active (e.g. switching floors) silently
      // replaces the previous connection without emitting stale events.
      clearTimer();
      dropSocket();
      floorId = fid;
      me = m;
      lastMove = spawn;
      myClaim = claim ?? null;
      selfId = m.id; // provisional; the server may suffix it (welcome.selfId)
      reconnectAttempt = false;
      revivedFromDormant = false;
      backoffMs = RECONNECT_DELAY_MS;
      phase = "connecting";
      if (!wakeListener) {
        wakeListener = wake;
        window.addEventListener("online", wakeListener);
        document.addEventListener("visibilitychange", wakeListener);
      }
      openSocket();
    },

    disconnect(): void {
      if (!isBrowser()) return; // SSR no-op
      phase = "closed";
      clearTimer();
      if (wakeListener) {
        window.removeEventListener("online", wakeListener);
        document.removeEventListener("visibilitychange", wakeListener);
        wakeListener = null;
      }
      dropSocket(); // detaches all socket listeners — no events after this
    },

    sendMove(s: MoveState): void {
      lastMove = s; // always remembered, so a reconnect joins in place
      if (phase !== "open" || !ws || ws.readyState !== ws.OPEN) return;
      ws.send(JSON.stringify({ t: "move", s }));
    },

    sendBoothSet(claim: BoothClaim): void {
      myClaim = claim; // survives reconnect: join re-announces the stand
      if (phase !== "open" || !ws || ws.readyState !== ws.OPEN) return;
      ws.send(JSON.stringify({ t: "booth_set", claim }));
    },

    sendBoothClear(): void {
      myClaim = null;
      if (phase !== "open" || !ws || ws.readyState !== ws.OPEN) return;
      ws.send(JSON.stringify({ t: "booth_clear" }));
    },

    sendReport(targetId: string, reason: string): void {
      if (phase !== "open" || !ws || ws.readyState !== ws.OPEN) return;
      ws.send(JSON.stringify({ t: "report", targetId, reason }));
    },

    sendChat(text: string, scope: "floor" | "dm", peerId?: string): void {
      // The server echoes floor chat (and dms) back to the sender for
      // consistent ordering, so this client never fakes a local echo.
      // When offline this is a pure no-op — the UI is responsible for
      // locally echoing the player's own floor-chat messages.
      if (phase !== "open" || !ws || ws.readyState !== ws.OPEN) return;
      // JSON.stringify drops the peerId key when it is undefined.
      ws.send(JSON.stringify({ t: "chat", text, scope, peerId }));
    },

    sendEmote(kind: EmoteKind): void {
      // The server echoes {t:"emote"} back to the sender, so local and remote
      // bubbles share one render path. Offline this is a pure no-op — the
      // engine draws the local bubble itself.
      if (phase !== "open" || !ws || ws.readyState !== ws.OPEN) return;
      ws.send(JSON.stringify({ t: "emote", kind }));
    },

    sendSign(key: string, text: string, boothName?: string): void {
      // The server validates/caps the entry and broadcasts {t:"guestbook"} to
      // the floor (sender included). Offline this is a pure no-op — the UI
      // disables the sign form while the floor server is unreachable.
      if (phase !== "open" || !ws || ws.readyState !== ws.OPEN) return;
      // JSON.stringify drops the boothName key when it is undefined.
      ws.send(JSON.stringify({ t: "sign", key, text, boothName }));
    },

    on(cb: (ev: NetEvent) => void): () => void {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };
}

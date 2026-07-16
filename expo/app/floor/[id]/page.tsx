"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppState } from "@/lib/store";
import { floorById } from "@/lib/data/floors";
import { STARTUPS, replyFor } from "@/lib/data/startups";
import { createNetClient } from "@/lib/net";
import { createGame } from "@/game/engine";
import { TIER_ORDER } from "@/lib/types";
import type {
  BoothInstance,
  ChatMsg,
  GameHandle,
  NetClient,
  Startup,
} from "@/lib/types";
import BoothCard from "@/components/BoothCard";
import ChatPanel from "@/components/ChatPanel";
import Toast, { type ToastData } from "@/components/Toast";
import TierTag, { TIER_LABEL } from "@/components/TierTag";

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function FloorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [state, actions] = useAppState();
  const floor = floorById(params.id);

  // hydration gate — the store fills from localStorage after mount
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

  // ---- HUD state ----
  const [presence, setPresence] = useState({ count: 1, online: false });
  const [nearBooth, setNearBooth] = useState<BoothInstance | null>(null);
  const [activeBooth, setActiveBooth] = useState<BoothInstance | null>(null);
  const [floorMsgs, setFloorMsgs] = useState<ChatMsg[]>([]);
  const [dms, setDms] = useState<Record<string, ChatMsg[]>>({});
  const [dmStartupId, setDmStartupId] = useState<string | null>(null);
  const [typingFor, setTypingFor] = useState<string | null>(null);
  const [tab, setTab] = useState<"floor" | "dm">("floor");
  const [toast, setToast] = useState<ToastData | null>(null);

  // ---- refs (stable across the game's lifetime) ----
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<GameHandle | null>(null);
  const netRef = useRef<NetClient | null>(null);
  const replyTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myStartup = state.myStartup;
  const startups: Record<string, Startup> = useMemo(
    () => (myStartup ? { ...STARTUPS, [myStartup.id]: myStartup } : { ...STARTUPS }),
    [myStartup],
  );

  const profileRef = useRef(state.profile);
  profileRef.current = state.profile;
  const startupsRef = useRef(startups);
  startupsRef.current = startups;
  const myStartupRef = useRef(myStartup);
  myStartupRef.current = myStartup;
  const dmStartupIdRef = useRef(dmStartupId);
  dmStartupIdRef.current = dmStartupId;

  const nameSet = state.profile.name !== "";
  const tierOk = floor ? TIER_ORDER[state.sub] >= TIER_ORDER[floor.tier] : false;
  const allowed = Boolean(ready && floor && nameSet && tierOk);

  // no name yet — go pick one in the lobby
  useEffect(() => {
    if (ready && floor && !nameSet) router.replace("/lobby");
  }, [ready, floor, nameSet, router]);

  const showToast = useCallback((text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const openDm = useCallback((s: Startup) => {
    setDms((prev) =>
      prev[s.id]
        ? prev
        : {
            ...prev,
            [s.id]: [
              {
                id: uid(),
                fromId: `npc:${s.id}`,
                from: s.founder,
                text: replyFor(s, ""),
                ts: Date.now(),
                scope: "dm",
                peerId: `npc:${s.id}`,
              },
            ],
          },
    );
    setDmStartupId(s.id);
    setTab("dm");
  }, []);

  const connectedIds = useMemo(
    () => new Set(state.connections.map((c) => c.startupId)),
    [state.connections],
  );

  const handleConnect = useCallback(
    (s: Startup) => {
      if (!floor || connectedIds.has(s.id)) return;
      actions.addConnection({
        startupId: s.id,
        name: s.name,
        founder: s.founder,
        floorId: floor.id,
      });
      showToast(`Connected with ${s.founder} of ${s.name}.`);
      // The founder acknowledges the connection in their own voice, in the DM thread.
      if (!s.id.startsWith("mine")) {
        const ack: ChatMsg = {
          id: uid(),
          fromId: `npc:${s.id}`,
          from: s.founder,
          text: s.dialogue?.connectReply ?? "Connected — good to meet you.",
          ts: Date.now(),
          scope: "dm",
          peerId: `npc:${s.id}`,
        };
        setDms((prev) => ({ ...prev, [s.id]: [...(prev[s.id] ?? []), ack] }));
      }
    },
    [floor, connectedIds, actions, showToast],
  );

  const handleSend = useCallback(
    (text: string, scope: "floor" | "dm") => {
      const me = profileRef.current;
      if (scope === "floor") {
        const msg: ChatMsg = {
          id: uid(),
          fromId: me.id,
          from: me.name,
          text,
          ts: Date.now(),
          scope: "floor",
        };
        // Always append locally — offline the input should never feel dead,
        // online we filter our own echo out of incoming events.
        setFloorMsgs((m) => [...m.slice(-199), msg]);
        netRef.current?.sendChat(text, "floor");
        return;
      }
      // Read the active DM id from a ref — doing this work inside a state
      // updater is impure and runs twice under React strict mode (which
      // duplicated the sent message in dev).
      const currentId = dmStartupIdRef.current;
      if (!currentId) return;
      const startup = startupsRef.current[currentId];
      if (!startup) return;
      const mine: ChatMsg = {
        id: uid(),
        fromId: me.id,
        from: me.name,
        text,
        ts: Date.now(),
        scope: "dm",
        peerId: `npc:${currentId}`,
      };
      setDms((prev) => ({
        ...prev,
        [currentId]: [...(prev[currentId] ?? []), mine],
      }));
      setTypingFor(currentId);
      // One timer per DM thread — replies to booth A must survive a quick hop to booth B.
      if (replyTimers.current[currentId]) clearTimeout(replyTimers.current[currentId]);
      replyTimers.current[currentId] = setTimeout(() => {
        delete replyTimers.current[currentId];
        const reply: ChatMsg = {
          id: uid(),
          fromId: `npc:${currentId}`,
          from: startup.founder,
          text: replyFor(startup, text),
          ts: Date.now(),
          scope: "dm",
          peerId: `npc:${currentId}`,
        };
        setDms((prev) => ({
          ...prev,
          [currentId]: [...(prev[currentId] ?? []), reply],
        }));
        setTypingFor((t) => (t === currentId ? null : t));
      }, 600 + Math.random() * 300);
    },
    [],
  );

  const handleFocusChange = useCallback((focused: boolean) => {
    handleRef.current?.setInputEnabled(!focused);
  }, []);

  // ---- mount the game + net client ----
  useEffect(() => {
    if (!allowed) return;
    const f = floorById(params.id);
    const canvas = canvasRef.current;
    if (!f || !canvas) return;

    // Canvas buffer sizing is owned by the engine's dpr-aware ResizeObserver.
    const net = createNetClient();
    netRef.current = net;
    const offNet = net.on((ev) => {
      if (ev.t === "chat" && ev.msg.scope === "floor") {
        // Filter our own echo by the server-assigned wire identity only —
        // a second tab shares the same profile id but gets its own selfId.
        if (ev.msg.fromId !== net.selfId) setFloorMsgs((m) => [...m.slice(-199), ev.msg]);
      }
    });

    const handle = createGame({
      canvas,
      floor: f,
      me: profileRef.current,
      myStartup: myStartupRef.current,
      startups: startupsRef.current,
      net,
      cb: {
        onNearBooth: (b) => setNearBooth(b),
        onInteract: (b) => {
          setActiveBooth(b);
          if (!b.isYours) {
            setDms((prev) =>
              prev[b.startup.id]
                ? prev
                : {
                    ...prev,
                    [b.startup.id]: [
                      {
                        id: uid(),
                        fromId: `npc:${b.startup.id}`,
                        from: b.startup.founder,
                        text: replyFor(b.startup, ""),
                        ts: Date.now(),
                        scope: "dm",
                        peerId: `npc:${b.startup.id}`,
                      },
                    ],
                  },
            );
            setDmStartupId(b.startup.id);
            setTab("dm");
          }
        },
        onPresence: (count, online) => setPresence({ count, online }),
      },
    });
    handleRef.current = handle;
    // The engine owns the connection: createGame() already called net.connect()
    // with its collision-aware spawn point — connecting again here would double-join.

    // strict-mode double-mount is handled by this cleanup running between passes
    return () => {
      offNet();
      handle.destroy();
      net.disconnect();
      handleRef.current = null;
      netRef.current = null;
      for (const t of Object.values(replyTimers.current)) clearTimeout(t);
      replyTimers.current = {};
    };
  }, [allowed, params.id]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // ---- non-game branches ----
  if (!floor) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-16">
        <div className="panel p-6">
          <h1 className="font-display text-2xl">No such floor</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            There is no floor called &ldquo;{params.id}&rdquo;. Halls get
            renamed, links go stale. The lobby has the current map.
          </p>
          <Link
            href="/lobby"
            className="mt-5 inline-block rounded-md bg-ink px-4 py-2 text-sm text-paper hover:bg-ink/85"
          >
            Back to the lobby
          </Link>
        </div>
      </main>
    );
  }

  if (!ready || !nameSet) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-16">
        <p className="text-sm text-muted">Checking your badge…</p>
      </main>
    );
  }

  if (!tierOk) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-16">
        <div className="panel p-6">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl">{floor.name}</h1>
            <TierTag tier={floor.tier} />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            This floor requires a {TIER_LABEL[floor.tier]} membership. You are
            on {TIER_LABEL[state.sub]}. The door is polite but firm.
          </p>
          <div className="mt-5 flex gap-3">
            <Link
              href="/profile"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              Upgrade in Profile
            </Link>
            <Link
              href="/lobby"
              className="rounded-md border border-ink px-4 py-2 text-sm hover:bg-panel"
            >
              Back to the lobby
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ---- the game ----
  const dmStartup = dmStartupId ? startups[dmStartupId] : undefined;
  const dmThread = dmStartup
    ? {
        startup: dmStartup,
        msgs: dms[dmStartup.id] ?? [],
        typing: typingFor === dmStartup.id,
        connected: connectedIds.has(dmStartup.id),
      }
    : null;
  const myIds = [
    state.profile.id,
    ...(netRef.current ? [netRef.current.selfId] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 bg-paper">
      <canvas
        ref={canvasRef}
        className="pixelated absolute inset-0 h-full w-full"
        aria-label={`${floor.name} — walkable expo floor`}
      />

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
        <div className="panel pointer-events-auto flex items-center gap-3 px-3 py-2 shadow-card">
          <span className="font-display text-base leading-none">{floor.name}</span>
          <TierTag tier={floor.tier} />
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <span className="panel flex items-center gap-2 px-3 py-2 text-xs text-muted shadow-card">
            <span
              aria-hidden="true"
              className={`inline-block h-2 w-2 rounded-full ${
                presence.online ? "bg-verify" : "bg-line"
              }`}
            />
            {presence.online
              ? `${presence.count} here`
              : "solo preview — floor server offline"}
          </span>
          <Link
            href="/lobby"
            className="panel px-3 py-2 text-xs text-ink shadow-card hover:bg-paper"
          >
            Leave
          </Link>
        </div>
      </div>

      {/* controls hint */}
      <div className="pointer-events-none absolute bottom-3 right-3">
        <span className="panel px-3 py-1.5 text-xs text-muted shadow-card">
          WASD / arrows to walk · E to talk
        </span>
      </div>

      {/* interact hint */}
      {nearBooth && !activeBooth && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2">
          <span className="panel px-3 py-1.5 text-sm shadow-card">
            <kbd className="micro mr-2 rounded-sm border border-line px-1 py-0.5 text-muted">
              E
            </kbd>
            talk to {nearBooth.startup.name}
          </span>
        </div>
      )}

      {/* booth card */}
      {activeBooth && (
        <div className="pointer-events-none absolute right-3 top-16">
          <BoothCard
            startup={
              startups[activeBooth.startup.id] ?? activeBooth.startup
            }
            isYours={activeBooth.isYours}
            connected={connectedIds.has(activeBooth.startup.id)}
            onConnect={() => handleConnect(activeBooth.startup)}
            onChat={() => openDm(activeBooth.startup)}
            onClose={() => setActiveBooth(null)}
          />
        </div>
      )}

      {/* chat */}
      <div className="pointer-events-none absolute bottom-3 left-3">
        <ChatPanel
          tab={tab}
          onTab={setTab}
          floorMsgs={floorMsgs}
          dm={dmThread}
          myIds={myIds}
          onSend={handleSend}
          onFocusChange={handleFocusChange}
          onConnect={handleConnect}
        />
      </div>

      <Toast toast={toast} />
    </div>
  );
}

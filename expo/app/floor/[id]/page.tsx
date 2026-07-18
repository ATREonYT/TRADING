"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppState } from "@/lib/store";
import { floorById } from "@/lib/data/floors";
import { STARTUPS, IDLE_LINES, replyFor } from "@/lib/data/startups";
import { createNetClient } from "@/lib/net";
import { createGame } from "@/game/engine";
import { isClaimableSpot, seedSpotIndex } from "@/game/tilemap";
import { ONBOARDING_STEPS, TIER_ORDER } from "@/lib/types";
import type {
  ActivityItem,
  BoothClaim,
  BoothInstance,
  ChatMsg,
  ConnectRequest,
  EmoteKind,
  GameHandle,
  HoverTarget,
  NetClient,
  Startup,
} from "@/lib/types";
import { questStates, unlockedEmotes } from "@/lib/data/quests";
import { buildCard, respondToRequest, sendConnectRequest, sendSocialDm, useInbox } from "@/lib/social";
import RequestCard from "@/components/RequestCard";
import MailToast, { type MailToastData } from "@/components/MailToast";
import BoothCard from "@/components/BoothCard";
import OpenStandCard from "@/components/OpenStandCard";
import ChatPanel, { type ChatThread } from "@/components/ChatPanel";
import EmoteBar from "@/components/EmoteBar";
import HoverCard from "@/components/HoverCard";
import TutorialCoach from "@/components/TutorialCoach";
import QuestPanel from "@/components/QuestPanel";
import EventPill from "@/components/EventPill";
import ConfettiBurst from "@/components/ConfettiBurst";
import Toast, { type ToastData } from "@/components/Toast";
import TierTag, { TIER_LABEL } from "@/components/TierTag";

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function firstName(full: string): string {
  return full.split(" ")[0] || full;
}

/** One chat thread in the panel: an NPC founder DM, a live-player DM, or a
 * connection DM ("social") that follows you between floors and pages. */
interface ThreadState {
  key: string; // "npc:<startupId>" | "player:<wireId>" | "social:<profileId>"
  kind: "npc" | "player" | "social";
  label: string;
  title: string;
  startupId?: string;
  peerId?: string;
  msgs: ChatMsg[];
  typing: boolean;
  unread: boolean;
  /** Closed threads keep their history but lose their tab. */
  open: boolean;
  /** Player threads only: the peer has left the floor. */
  left?: boolean;
}

/** Muted transcript line for liveness changes ("<name> left the floor"). */
function systemMsg(text: string): ChatMsg {
  return { id: uid(), fromId: "system", from: "", text, ts: Date.now(), scope: "dm" };
}

/** Flip a player thread's liveness: title, flag, and one transcript line. */
function withPeerPresence(th: ThreadState, present: boolean): ThreadState {
  return {
    ...th,
    left: !present,
    title: present ? `${th.label} · on this floor` : `${th.label} · left the floor`,
    msgs: [
      ...th.msgs,
      systemMsg(present ? `${th.label} is back on this floor` : `${th.label} left the floor`),
    ],
  };
}

const MAX_ACTIVITY = 8;

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
  const [threads, setThreads] = useState<Record<string, ThreadState>>({});
  const [tab, setTab] = useState<string>("floor");
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [coarse, setCoarse] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  // Touch users have no M key; this mirrors the engine's on-when-map-overflows
  // default (true on any phone-sized viewport) and drives the "map" button.
  const [minimapOn, setMinimapOn] = useState(true);
  /** Session mute list (wire ids) — their chat, DMs, bubbles and emotes hide. */
  const [mutedIds, setMutedIds] = useState<ReadonlySet<string>>(new Set());
  /** Chat starts folded on every screen; opening a DM unfolds it. */
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  /** Incoming connection request shown as a popup card (newest wins). */
  const [incomingReq, setIncomingReq] = useState<ConnectRequest | null>(null);
  /** Incoming connection DM — pixel-mail notification, click opens the thread. */
  const [mailToast, setMailToast] = useState<MailToastData | null>(null);
  /** Incremented on each quest completion — triggers the confetti burst. */
  const [burst, setBurst] = useState(0);

  // ---- refs (stable across the game's lifetime) ----
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<GameHandle | null>(null);
  const netRef = useRef<NetClient | null>(null);
  const replyTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The claim held before the last optimistic booth_set (for denial rollback). */
  // One-shot rollback token for the claim in flight: consumed by the first
  // booth_denied and time-limited, so a denial arriving from a reconnect
  // re-announce (not a fresh claim) can't resurrect a spot abandoned long ago.
  const prevClaimRef = useRef<{ claim: BoothClaim; ts: number } | null>(null);
  // Last NPC booth the player talked at — its thread closes on walk-away
  // regardless of whether the booth card is still open.
  const lastNpcBoothRef = useRef<{ spotIndex: number; startupId: string } | null>(null);

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
  const claimsRef = useRef(state.claims);
  claimsRef.current = state.claims;
  const activeBoothRef = useRef(activeBooth);
  activeBoothRef.current = activeBooth;
  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const connectionsRef = useRef(state.connections);
  connectionsRef.current = state.connections;
  const mutedRef = useRef(mutedIds);
  mutedRef.current = mutedIds;
  const badgesRef = useRef(state.badges);
  badgesRef.current = state.badges;
  const stateRef = useRef(state);
  stateRef.current = state;

  // social inbox: request/connection state for booth cards and DM threads
  const [inbox, refreshInbox] = useInbox(ready ? state.profile.id : "", 15_000);
  /** Wire ids carry a "-2" suffix for second tabs; match them to profile ids. */
  const matchesPeer = useCallback(
    (profileId: string, wireOrProfileId: string | undefined): boolean =>
      wireOrProfileId !== undefined &&
      (wireOrProfileId === profileId || wireOrProfileId.startsWith(`${profileId}-`)),
    [],
  );

  const nameSet = state.profile.name !== "";
  const tierOk = floor ? TIER_ORDER[state.sub] >= TIER_ORDER[floor.tier] : false;
  const allowed = Boolean(ready && floor && nameSet && tierOk);

  // no name yet — go pick one in the lobby
  useEffect(() => {
    if (ready && floor && !nameSet) router.replace("/lobby");
  }, [ready, floor, nameSet, router]);

  // coarse pointer (touch) — different control hints, same game
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setCoarse(mq.matches);
    const onChange = (e: MediaQueryListEvent): void => setCoarse(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Mail toast click: open that connection's chat thread in the panel.
  const openSocialFromToast = useCallback((peerId: string) => {
    const key = `social:${peerId}`;
    setThreads((prev) =>
      prev[key] ? { ...prev, [key]: { ...prev[key], open: true, unread: false } } : prev,
    );
    setTab(key);
    setChatCollapsed(false);
  }, []);

  // Escape closes the topmost overlay (request card first, then booth card) —
  // keyboard users shouldn't need to hunt a small × with the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      if (incomingReq) setIncomingReq(null);
      else if (activeBooth) setActiveBooth(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [incomingReq, activeBooth]);

  // Phones: the top-right minimap sits under the booth/request cards (DOM
  // paints above canvas) — hide it while a card is open, restore after.
  useEffect(() => {
    if (!coarse) return;
    const cardOpen = Boolean(activeBooth || incomingReq);
    handleRef.current?.setMinimap(cardOpen ? false : minimapOn);
  }, [coarse, activeBooth, incomingReq, minimapOn]);

  const showToast = useCallback((text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // ---- threads ----

  const openNpcThread = useCallback((s: Startup) => {
    const key = `npc:${s.id}`;
    const greeting: ChatMsg = {
      id: uid(),
      fromId: key,
      from: s.founder,
      text: replyFor(s, ""),
      ts: Date.now(),
      scope: "dm",
      peerId: key,
    };
    setThreads((prev) => {
      const existing = prev[key];
      if (existing) {
        return { ...prev, [key]: { ...existing, open: true, unread: false } };
      }
      return {
        ...prev,
        [key]: {
          key,
          kind: "npc",
          label: firstName(s.founder),
          title: `${s.founder} · ${s.name}`,
          startupId: s.id,
          msgs: [greeting],
          typing: false,
          unread: false,
          open: true,
        },
      };
    });
    setTab(key);
    setChatCollapsed(false);
  }, []);

  const openPlayerThread = useCallback((wireId: string, name: string) => {
    const key = `player:${wireId}`;
    setThreads((prev) => {
      const existing = prev[key];
      if (existing) {
        return { ...prev, [key]: { ...existing, open: true, unread: false } };
      }
      return {
        ...prev,
        [key]: {
          key,
          kind: "player",
          label: name,
          title: `${name} · on this floor`,
          peerId: wireId,
          msgs: [],
          typing: false,
          unread: false,
          open: true,
        },
      };
    });
    setTab(key);
    setChatCollapsed(false);
  }, []);

  const handleTab = useCallback((key: string) => {
    setTab(key);
    setChatCollapsed(false);
    if (key !== "floor") {
      setThreads((prev) =>
        prev[key] ? { ...prev, [key]: { ...prev[key], unread: false } } : prev,
      );
    }
  }, []);

  const closeThread = useCallback((key: string) => {
    setThreads((prev) =>
      prev[key] ? { ...prev, [key]: { ...prev[key], open: false } } : prev,
    );
    setTab((t) => (t === key ? "floor" : t));
  }, []);

  const connectedIds = useMemo(
    () => new Set(state.connections.map((c) => c.startupId)),
    [state.connections],
  );
  const connectedIdsRef = useRef(connectedIds);
  connectedIdsRef.current = connectedIds;

  // ---- moderation: session mute + report (player threads) ----

  const toggleMute = useCallback((threadKey: string) => {
    const th = threadsRef.current[threadKey];
    const peerId = th?.peerId;
    if (!peerId) return;
    setMutedIds((prev) => {
      const next = new Set(prev);
      if (next.has(peerId)) next.delete(peerId);
      else next.add(peerId);
      handleRef.current?.setMuted([...next]);
      return next;
    });
  }, []);

  const reportPeer = useCallback(
    (threadKey: string) => {
      const th = threadsRef.current[threadKey];
      if (!th?.peerId) return;
      netRef.current?.sendReport(th.peerId, `reported from DM with "${th.label}"`);
      showToast("Reported. The operator will take a look.");
    },
    [showToast],
  );

  const handleConnect = useCallback(
    (s: Startup, ownerId?: string) => {
      if (!floor) return;
      if (ownerId) {
        // A real person's stand: connecting is a REQUEST — they see your
        // card (name, title, badges, track record) and accept or decline.
        // ownerId is their stable profile id; the server routes it.
        void sendConnectRequest(buildCard(stateRef.current), ownerId).then((ok) => {
          if (ok) refreshInbox();
        });
        actions.completeOnboarding("connect");
        showToast(`Request sent to ${s.founder}. They'll see your card.`);
        return;
      }
      if (connectedIdsRef.current.has(s.id)) return;
      actions.addConnection({
        startupId: s.id,
        name: s.name,
        founder: s.founder,
        floorId: floor.id,
      });
      actions.completeOnboarding("connect");
      showToast(`Connected with ${s.founder} of ${s.name}.`);
      // The founder acknowledges the connection in their own voice, in the DM thread.
      if (!s.id.startsWith("mine")) {
        const key = `npc:${s.id}`;
        const ack: ChatMsg = {
          id: uid(),
          fromId: key,
          from: s.founder,
          text: s.dialogue?.connectReply ?? "Connected — good to meet you.",
          ts: Date.now(),
          scope: "dm",
          peerId: key,
        };
        setThreads((prev) => {
          const existing = prev[key];
          if (existing) {
            return {
              ...prev,
              [key]: {
                ...existing,
                msgs: [...existing.msgs, ack],
                unread: existing.open && tabRef.current !== key ? true : existing.unread,
              },
            };
          }
          // No thread yet (connected from the booth card without chatting) —
          // keep the ack in a hidden thread so it's there when they open it.
          return {
            ...prev,
            [key]: {
              key,
              kind: "npc",
              label: firstName(s.founder),
              title: `${s.founder} · ${s.name}`,
              startupId: s.id,
              msgs: [ack],
              typing: false,
              unread: false,
              open: false,
            },
          };
        });
      }
    },
    [floor, actions, showToast],
  );

  const connectThreadKey = useCallback(
    (key: string) => {
      const th = threadsRef.current[key];
      if (!th || !floor) return;
      if (th.kind === "npc" && th.startupId) {
        const s = startupsRef.current[th.startupId];
        if (s) handleConnect(s);
        return;
      }
      // A real player: send a connection request. Their wire id is fine —
      // the server resolves live wire ids to profile ids.
      if (!th.peerId) return;
      void sendConnectRequest(buildCard(stateRef.current), th.peerId).then((ok) => {
        if (ok) refreshInbox();
      });
      actions.completeOnboarding("connect");
      showToast(`Request sent to ${th.label}. They'll see your card.`);
    },
    [floor, actions, handleConnect, showToast],
  );

  const handleClaim = useCallback(
    (b: BoothInstance) => {
      const s = myStartupRef.current;
      if (!floor || !s) return;
      // Remember what we held: if the server denies this spot, the stand
      // rolls back instead of silently ghosting for everyone else.
      const prevIdx = claimsRef.current[floor.id];
      prevClaimRef.current =
        prevIdx !== undefined
          ? { claim: { spotIndex: prevIdx, startup: s }, ts: Date.now() }
          : null;
      actions.claimSpot(floor.id, b.spotIndex);
      const claim = { spotIndex: b.spotIndex, startup: s };
      handleRef.current?.setMyBooth(claim);
      netRef.current?.sendBoothSet(claim);
      setActiveBooth(null);
      showToast(`Stand claimed. ${s.name} is now on this floor.`);
    },
    [floor, actions, showToast],
  );

  const handleUnclaim = useCallback(() => {
    if (!floor) return;
    actions.unclaimSpot(floor.id);
    handleRef.current?.setMyBooth(null);
    netRef.current?.sendBoothClear();
    setActiveBooth(null);
    showToast("Stand packed up.");
  }, [floor, actions, showToast]);

  const handleSend = useCallback(
    (text: string, tabKey: string) => {
      const me = profileRef.current;
      if (tabKey === "floor") {
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
        handleRef.current?.showBubble("me", text);
        return;
      }

      const th = threadsRef.current[tabKey];
      if (!th || !th.open) return;
      // Social threads skip the local append — the push echo lands instantly.
      if (th.kind !== "social") {
        const mine: ChatMsg = {
          id: uid(),
          fromId: me.id,
          from: me.name,
          text,
          ts: Date.now(),
          scope: "dm",
          peerId: th.kind === "player" ? th.peerId : `npc:${th.startupId}`,
        };
        setThreads((prev) => {
          const cur = prev[tabKey];
          if (!cur) return prev;
          return {
            ...prev,
            [tabKey]: {
              ...cur,
              msgs: [...cur.msgs, mine],
              typing: cur.kind === "npc" ? true : cur.typing,
            },
          };
        });
      }
      actions.completeOnboarding("talk");
      // Quest deed: distinct founders/players talked to.
      actions.recordTalkedTo(th.kind === "player" ? (th.peerId ?? tabKey) : (th.startupId ?? tabKey));

      if (th.kind === "social") {
        // Connection DM: no local append — the server pushes the echo back
        // instantly to every tab, which keeps ordering consistent everywhere.
        if (th.peerId) {
          void sendSocialDm(me.id, me.name, th.peerId, text);
        }
        return;
      }

      if (th.kind === "player") {
        // Local-append + filter the server echo (same policy as the floor tab).
        if (th.peerId) netRef.current?.sendChat(text, "dm", th.peerId);
        return;
      }

      // NPC thread: schedule the founder's reply.
      const sid = th.startupId;
      if (!sid) return;
      if (replyTimers.current[sid]) clearTimeout(replyTimers.current[sid]);
      replyTimers.current[sid] = setTimeout(() => {
        delete replyTimers.current[sid];
        const startup = startupsRef.current[sid];
        if (!startup) return;
        const key = `npc:${sid}`;
        const reply: ChatMsg = {
          id: uid(),
          fromId: key,
          from: startup.founder,
          text: replyFor(startup, text),
          ts: Date.now(),
          scope: "dm",
          peerId: key,
        };
        setThreads((prev) => {
          const cur = prev[key];
          if (!cur) return prev;
          return {
            ...prev,
            [key]: {
              ...cur,
              typing: false,
              msgs: [...cur.msgs, reply],
              unread: cur.open && tabRef.current !== key ? true : cur.unread,
            },
          };
        });
        handleRef.current?.showBubble(key, reply.text);
      }, 600 + Math.random() * 300);
    },
    [actions],
  );

  const handleFocusChange = useCallback((focused: boolean) => {
    handleRef.current?.setInputEnabled(!focused);
  }, []);

  const handleEmote = useCallback(
    (kind: EmoteKind) => {
      handleRef.current?.emote(kind);
      actions.completeOnboarding("emote");
      actions.recordEmote();
    },
    [actions],
  );

  // Demo Night badge — granted once, while the event is live on this floor.
  const handleEventLive = useCallback(() => {
    if (badgesRef.current.includes("demo-night")) return;
    actions.grantBadge("demo-night");
    showToast("Demo Night, live, and you're in the room. Badge earned.");
  }, [actions, showToast]);

  // Tour finishes itself when the last step lands.
  useEffect(() => {
    if (!ready || state.tutorialDone) return;
    if (state.onboarding.length >= ONBOARDING_STEPS.length) {
      actions.setTutorialDone(true);
      showToast("Tour done. You look like a regular already.");
    }
  }, [ready, state.onboarding, state.tutorialDone, actions, showToast]);

  // Quest deed: floors visited.
  useEffect(() => {
    if (ready && allowed && floor) actions.recordFloorVisit(floor.id);
  }, [ready, allowed, floor, actions]);

  // Deep links land people straight on floors — count the visit here too so
  // streaks and the away-mark don't depend on passing through the lobby.
  useEffect(() => {
    if (ready && allowed) actions.recordVisit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, allowed]);

  // Quest rewards — grant each completed quest's badge/title/emote exactly once.
  const quests = useMemo(() => questStates(state), [state]);
  const emotes = useMemo(() => unlockedEmotes(state), [state]);
  useEffect(() => {
    if (!ready) return;
    for (const q of quests) {
      if (!q.done || q.claimed) continue;
      actions.markQuestClaimed(q.def.id);
      actions.grantBadge(q.def.reward.badge);
      showToast(`Quest complete: ${q.def.title} — ${q.def.rewardLabel}`);
      setBurst((b) => b + 1);
      break; // one toast per render pass; the next completes on the following pass
    }
  }, [ready, quests, actions, showToast]);

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
      if (ev.t === "welcome") {
        setActivity(ev.activity.slice(-MAX_ACTIVITY));
        // Reconcile DM thread liveness against the fresh player list.
        const present = new Set(ev.players.map((p) => p.id));
        setThreads((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const th of Object.values(prev)) {
            if (th.kind !== "player" || !th.peerId) continue;
            const here = present.has(th.peerId) || th.peerId === net.selfId;
            if (here === !th.left) continue;
            next[th.key] = withPeerPresence(th, here);
            changed = true;
          }
          return changed ? next : prev;
        });
      }
      if (ev.t === "player_leave") {
        const key = `player:${ev.id}`;
        setThreads((prev) =>
          prev[key] && !prev[key].left
            ? { ...prev, [key]: withPeerPresence(prev[key], false) }
            : prev,
        );
      }
      if (ev.t === "player_join") {
        const key = `player:${ev.player.id}`;
        setThreads((prev) =>
          prev[key]?.left ? { ...prev, [key]: withPeerPresence(prev[key], true) } : prev,
        );
      }
      if (ev.t === "activity") {
        setActivity((prev) => [...prev, ev.item].slice(-MAX_ACTIVITY));
      }
      if (ev.t === "chat" && ev.msg.scope === "floor") {
        // Filter our own echo by the server-assigned wire identity only —
        // a second tab shares the same profile id but gets its own selfId.
        // Muted players' messages are dropped entirely.
        if (ev.msg.fromId !== net.selfId && !mutedRef.current.has(ev.msg.fromId)) {
          setFloorMsgs((m) => [...m.slice(-199), ev.msg]);
        }
      }
      if (ev.t === "chat" && ev.msg.scope === "dm") {
        // Our own echo — we already appended locally when sending.
        if (ev.msg.fromId === net.selfId) return;
        if (mutedRef.current.has(ev.msg.fromId)) return; // muted peer
        const peer = ev.msg.peerId ?? ev.msg.fromId;
        if (!peer) return;
        const key = `player:${peer}`;
        setThreads((prev) => {
          const existing = prev[key];
          const unread = tabRef.current !== key;
          if (existing) {
            return {
              ...prev,
              [key]: {
                ...existing,
                open: true,
                msgs: [...existing.msgs, ev.msg],
                unread,
              },
            };
          }
          return {
            ...prev,
            [key]: {
              key,
              kind: "player",
              label: ev.msg.from,
              title: `${ev.msg.from} · on this floor`,
              peerId: peer,
              msgs: [ev.msg],
              typing: false,
              unread,
              open: true,
            },
          };
        });
      }
      if (ev.t === "social_dm") {
        // A connection DM (maybe sent from the Connections screen) — surface
        // it as a chat thread right here on the floor. Own echoes keep the
        // thread consistent when you sent it from another tab or this panel.
        const myId = profileRef.current.id;
        const mineSent = ev.from === myId;
        const peer = mineSent ? ev.to : ev.from;
        const peerName = mineSent ? ev.toName : ev.fromName;
        const key = `social:${peer}`;
        const msg: ChatMsg = {
          id: uid(),
          fromId: mineSent ? myId : peer,
          from: mineSent ? profileRef.current.name : ev.fromName,
          text: ev.text,
          ts: ev.ts,
          scope: "dm",
          peerId: peer,
        };
        setThreads((prev) => {
          const existing = prev[key];
          const unread = !mineSent && tabRef.current !== key;
          if (existing) {
            return {
              ...prev,
              [key]: { ...existing, open: true, msgs: [...existing.msgs, msg], unread },
            };
          }
          return {
            ...prev,
            [key]: {
              key,
              kind: "social",
              label: peerName,
              title: `${peerName} · connection`,
              peerId: peer,
              msgs: [msg],
              typing: false,
              unread,
              open: true,
            },
          };
        });
        if (!mineSent && tabRef.current !== key) {
          setMailToast({
            id: Date.now(),
            fromName: ev.fromName,
            text: ev.text,
            peerId: peer,
          });
        }
      }
      if (ev.t === "connect_request") {
        // Someone wants to connect — show their card right here on the floor.
        setIncomingReq(ev.req);
        refreshInbox();
      }
      if (ev.t === "connect_accept") {
        // Mirror into the local store: quests and calling-card counts must
        // include real people, not just NPC handshakes.
        actions.addConnection({
          name: ev.peerName,
          founder: ev.peerName,
          floorId: f.id,
          peerId: ev.peerId,
        });
        showToast(`${ev.peerName} accepted — you're connected. Chat lives in Connections.`);
        refreshInbox();
      }
      if (ev.t === "booth_denied") {
        // Someone else claimed that spot first. If this was a MOVE, the
        // server still holds our previous spot — restore it locally and
        // re-announce so every state (server, net client, room) reconverges
        // instead of leaving a ghost stand behind.
        const prev = prevClaimRef.current;
        prevClaimRef.current = null; // one-shot — a second denial won't loop
        if (prev && Date.now() - prev.ts < 15_000 && prev.claim.spotIndex !== ev.spotIndex) {
          actions.claimSpot(f.id, prev.claim.spotIndex);
          handleRef.current?.setMyBooth(prev.claim);
          netRef.current?.sendBoothSet(prev.claim);
          showToast("Someone claimed that spot first. Your stand stays put.");
        } else {
          actions.unclaimSpot(f.id);
          handleRef.current?.setMyBooth(null);
          netRef.current?.sendBoothClear();
          showToast("Someone claimed that stand first. Pick another spot.");
        }
      }
    });

    // A stored claim whose spot no longer exists (floor defs change between
    // versions) would announce an invisible stand that still blocks that
    // index in arbitration — drop it instead.
    let claimIdx: number | undefined = claimsRef.current[f.id];
    if (claimIdx !== undefined && !isClaimableSpot(f, claimIdx)) {
      actions.unclaimSpot(f.id);
      claimIdx = undefined;
    }
    const mine = myStartupRef.current;
    const myClaim =
      mine && claimIdx !== undefined ? { spotIndex: claimIdx, startup: mine } : undefined;

    const handle = createGame({
      canvas,
      floor: f,
      me: profileRef.current, // includes the optional status line
      myStartup: mine,
      myClaim,
      startups: startupsRef.current,
      idleLines: IDLE_LINES,
      net,
      cb: {
        onNearBooth: (b) => {
          setNearBooth(b);
          const active = activeBoothRef.current;
          if (active) {
            if (!b || b.spotIndex !== active.spotIndex) {
              setActiveBooth(null); // walked away — the card closes behind you
            } else {
              // Same stand, fresh instance (the floor was rebuilt) — keep the
              // card but point it at current data.
              setActiveBooth(b);
            }
          }
          // The NPC conversation closes on walk-away even if the card was
          // dismissed by hand earlier — tracked separately from the card so
          // "tap ×, then wander off" doesn't leave the thread open. Closing
          // hides the thread; its history survives. The chat panel folds
          // back down so the floor stays the main thing.
          const lastNpc = lastNpcBoothRef.current;
          if (lastNpc && (!b || b.spotIndex !== lastNpc.spotIndex)) {
            lastNpcBoothRef.current = null;
            const key = `npc:${lastNpc.startupId}`;
            setThreads((prev) =>
              prev[key]?.open ? { ...prev, [key]: { ...prev[key], open: false } } : prev,
            );
            setTab((t) => {
              if (t === key) {
                setChatCollapsed(true);
                return "floor";
              }
              return t;
            });
          }
        },
        onInteract: (b) => {
          setActiveBooth(b);
          actions.completeOnboarding("interact");
          // DM opens only for seed-startup booths: their founder is an NPC.
          // Live-claimed stands have a real owner walking the floor, and your
          // own booth has you.
          if (b.startup && !b.isYours && !b.ownerId) {
            openNpcThread(b.startup);
            lastNpcBoothRef.current = { spotIndex: b.spotIndex, startupId: b.startup.id };
          }
        },
        onPresence: (count, online) => setPresence({ count, online }),
        onHover: (t) => setHover(t),
        onPlayerClick: (p) => openPlayerThread(p.id, p.name),
        onFirstAction: (kind) => actions.completeOnboarding(kind),
      },
    });
    handleRef.current = handle;
    // The engine owns the connection: createGame() already called net.connect()
    // with its collision-aware spawn point — connecting again here would double-join.

    // Directory deep link: /floor/<id>?booth=<startupId> auto-walks you from
    // the spawn point up to the booth you searched for.
    const search = new URLSearchParams(window.location.search);
    const boothParam = search.get("booth");
    const spotParam = search.get("spot");
    if (boothParam) {
      // seedSpotIndex accounts for reservedSpot — a raw startupIds.indexOf
      // drifts one spot off on floors whose reserved spot sits mid-list
      const spotIndex = seedSpotIndex(f, boothParam);
      if (spotIndex >= 0) handle.walkToBooth(spotIndex);
    } else if (spotParam) {
      // Community stands aren't in startupIds — the directory deep-links them
      // by their claimed spot index directly.
      const spotIndex = Number(spotParam);
      if (Number.isInteger(spotIndex) && spotIndex >= 0) handle.walkToBooth(spotIndex);
    }

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
  }, [allowed, params.id, actions, showToast, openNpcThread, openPlayerThread, refreshInbox]);

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
  const openThreads: ChatThread[] = Object.values(threads)
    .filter((t) => t.open)
    .map((t) => ({
      key: t.key,
      kind: t.kind,
      label: t.label,
      title: t.title,
      msgs: t.msgs,
      typing: t.typing,
      unread: t.unread,
      left: t.left ?? false,
      muted: t.peerId !== undefined && mutedIds.has(t.peerId),
      connected:
        t.kind === "npc"
          ? t.startupId !== undefined && connectedIds.has(t.startupId)
          : t.kind === "social"
            ? true // a social thread only exists between connected people
            : // Mutual (server-side) connections; wire ids may carry a tab suffix.
              inbox.connections.some((c) => matchesPeer(c.peerId, t.peerId)) ||
              inbox.outgoing.some((p) => matchesPeer(p, t.peerId)),
    }));

  const myIds = [
    state.profile.id,
    ...(netRef.current ? [netRef.current.selfId] : []),
  ];

  // Guestbook key: startup id for seed booths, "spot:<i>" for claimed stands.
  const guestbookKey =
    activeBooth && activeBooth.startup
      ? activeBooth.isYours || activeBooth.ownerId
        ? `spot:${activeBooth.spotIndex}`
        : activeBooth.startup.id
      : null;

  return (
    <div className="fixed inset-0 z-50 bg-paper">
      <canvas
        ref={canvasRef}
        className="pixelated absolute inset-0 h-full w-full"
        aria-label={`${floor.name} — walkable expo floor`}
      />

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <span className="panel flex items-center gap-3 px-3 py-2 shadow-card">
            <span className="font-display text-base leading-none">{floor.name}</span>
            <TierTag tier={floor.tier} />
          </span>
          {/* CSS-hidden (not unmounted) on phones so the live-badge effect
              still runs; the chip itself is lobby content, not phone HUD */}
          <span className="hidden sm:block">
            <EventPill floorId={floor.id} onLiveHere={handleEventLive} />
          </span>
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

      {/* quest tracker — the single "what should I do?" surface (the ticker
          now lives in the chat panel's header, and the tour is its own card) */}
      <div className="pointer-events-none absolute left-3 top-24 sm:top-16">
        <QuestPanel quests={quests} />
      </div>

      {/* incoming connection DM — pixel mail, top right, click to open */}
      <MailToast
        toast={
          mailToast && {
            ...mailToast,
            company: inbox.connections.find((c) => c.peerId === mailToast.peerId)
              ?.peerStartup,
          }
        }
        onOpen={openSocialFromToast}
        onDismiss={() => setMailToast(null)}
      />

      {/* incoming connection request — their card, front and center */}
      {incomingReq && (
        <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 sm:top-16">
          <RequestCard
            compact
            req={incomingReq}
            onRespond={(accept) => {
              const from = incomingReq.from;
              setIncomingReq(null);
              void respondToRequest(
                state.profile.id,
                state.profile.name,
                from.id,
                accept,
                state.myStartup?.name,
              ).then(() => refreshInbox());
              if (accept) {
                // Mirror the mutual connection into the local store so quests
                // and calling-card counts include real people, not just NPCs.
                actions.addConnection({
                  startupId: from.startupName ? `claim:${from.id}` : undefined,
                  name: from.startupName ?? from.name,
                  founder: from.name,
                  floorId: floor.id,
                  peerId: from.id,
                });
              }
              showToast(
                accept
                  ? `Connected with ${from.name}. Chat lives in Connections.`
                  : "Declined, quietly.",
              );
            }}
          />
        </div>
      )}

      {/* interact hint */}
      {nearBooth && !activeBooth && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2">
          <span className="panel px-3 py-1.5 text-sm shadow-card">
            {!coarse && (
              <kbd className="micro mr-2 rounded-sm border border-line px-1 py-0.5 text-muted">
                E
              </kbd>
            )}
            {nearBooth.startup
              ? nearBooth.isYours
                ? "your stand"
                : coarse
                  ? `tap to talk to ${nearBooth.startup.name}`
                  : `talk to ${nearBooth.startup.name}`
              : "open stand"}
          </span>
        </div>
      )}

      {/* booth card */}
      {activeBooth && (
        <div className="pointer-events-none absolute right-3 top-16">
          {activeBooth.startup ? (
            <BoothCard
              // A live player's stand carries its own startup data — never
              // resolve it through the local startups map, where every
              // client's own startup shares the same id.
              startup={
                activeBooth.ownerId && !activeBooth.isYours
                  ? activeBooth.startup
                  : startups[activeBooth.startup.id] ?? activeBooth.startup
              }
              isYours={activeBooth.isYours}
              live={
                Boolean(activeBooth.ownerId) &&
                !activeBooth.isYours &&
                activeBooth.ownerOnline !== false
              }
              ownerAway={
                Boolean(activeBooth.ownerId) &&
                !activeBooth.isYours &&
                activeBooth.ownerOnline === false
              }
              connected={
                activeBooth.ownerId && !activeBooth.isYours
                  ? inbox.connections.some((c) => c.peerId === activeBooth.ownerId)
                  : connectedIds.has(activeBooth.startup.id)
              }
              pending={
                Boolean(activeBooth.ownerId) &&
                !activeBooth.isYours &&
                inbox.outgoing.includes(activeBooth.ownerId ?? "")
              }
              onConnect={() =>
                activeBooth.startup &&
                handleConnect(
                  activeBooth.startup,
                  activeBooth.isYours ? undefined : activeBooth.ownerId,
                )
              }
              onChat={() => activeBooth.startup && openNpcThread(activeBooth.startup)}
              onUnclaim={activeBooth.isYours ? handleUnclaim : undefined}
              onClose={() => setActiveBooth(null)}
              guestbook={
                guestbookKey
                  ? {
                      net: netRef.current,
                      floorId: floor.id,
                      boothKey: guestbookKey,
                      onFocusChange: handleFocusChange,
                      onSigned: actions.recordSigned,
                    }
                  : undefined
              }
            />
          ) : (
            <OpenStandCard
              floorName={floor.name}
              hasStartup={Boolean(myStartup)}
              claimedElsewhere={state.claims[floor.id] !== undefined}
              onClaim={() => handleClaim(activeBooth)}
              onClose={() => setActiveBooth(null)}
            />
          )}
        </div>
      )}

      {/* tutorial coach — one instruction at a time, above the bottom HUD */}
      {!state.tutorialDone && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 flex -translate-x-1/2 justify-center">
          <TutorialCoach
            done={state.onboarding}
            coarse={coarse}
            onSkip={() => actions.setTutorialDone(true)}
          />
        </div>
      )}

      {/* bottom HUD: chat (left), emotes (center), help (right) */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col items-center gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <div className="order-3 flex w-full justify-start sm:order-none sm:w-auto">
          <ChatPanel
            tab={tab}
            onTab={handleTab}
            floorMsgs={floorMsgs}
            threads={openThreads}
            myIds={myIds}
            onSend={handleSend}
            onFocusChange={handleFocusChange}
            onConnect={connectThreadKey}
            onClose={closeThread}
            onToggleMute={toggleMute}
            onReport={reportPeer}
            collapsed={chatCollapsed}
            onCollapsedChange={setChatCollapsed}
            ticker={activity.length ? activity[activity.length - 1].text : undefined}
          />
        </div>
        <div className="order-2 flex items-stretch gap-2 sm:order-none">
          <EmoteBar onEmote={handleEmote} unlocked={emotes} />
          {coarse && (
            <button
              type="button"
              aria-pressed={minimapOn}
              onClick={() => {
                const next = !minimapOn;
                setMinimapOn(next);
                handleRef.current?.setMinimap(next);
              }}
              className={`panel pointer-events-auto px-3 text-xs shadow-card ${
                minimapOn ? "text-ink" : "text-muted"
              }`}
            >
              map
            </button>
          )}
          {/* help lives with the other controls — a lone centered "?" island
              above the emote bar read as misplaced on phones */}
          <div className="relative">
            {helpOpen && (
              <div className="panel pointer-events-auto absolute bottom-10 right-0 w-56 p-3 text-xs leading-relaxed text-muted shadow-card">
                <p className="micro mb-1.5 text-ink">Controls</p>
                {coarse ? (
                  <p>Tap to walk. Tap a booth to talk. Buttons below to react.</p>
                ) : (
                  <>
                    <p>WASD / arrows or click — walk</p>
                    <p>E — talk to the booth you&rsquo;re near</p>
                    <p>1–8 — reactions · M — minimap</p>
                  </>
                )}
                <p className="mt-1.5 border-t border-line pt-1.5">
                  Quests live top-left. Finish them for reactions and titles.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setHelpOpen((v) => !v)}
              aria-expanded={helpOpen}
              aria-label="Help"
              className="panel pointer-events-auto h-9 w-9 text-sm text-muted shadow-card hover:text-ink"
            >
              ?
            </button>
          </div>
        </div>
      </div>

      {/* hover card — desktop pointer only by nature */}
      <HoverCard target={hover} startups={startups} />

      <ConfettiBurst burstId={burst} />
      <Toast toast={toast} />
    </div>
  );
}

"use client";

/**
 * Site-wide messenger: a chat-bubble button pinned bottom-right that opens
 * your conversations with connections — pick a person (name · company) and
 * the thread opens right there. Incoming DMs raise the MailToast top-right.
 *
 * Mounted from the root layout on every page EXCEPT floors — the floor has
 * its own chat panel wired into the game (this widget would fight it for
 * the same events and screen edge).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "@/lib/store";
import { STARTUPS, replyFor } from "@/lib/data/startups";
import {
  getSeenMap,
  markThreadSeen,
  sendSocialDm,
  useInbox,
  useSocialPush,
} from "@/lib/social";
import MailToast, { type MailToastData } from "@/components/MailToast";

/** A local message in a founder (NPC) thread — no server involved. */
interface NpcMsg {
  fromMe: boolean;
  text: string;
  ts: number;
}

/** 12x11 pixel speech bubble for the launcher button. */
function PixelChat({ size = 20, color = "#F2EFE7" }: { size?: number; color?: string }) {
  const px = size / 12;
  const r = (x: number, y: number, w: number, h: number, key: string) => (
    <rect key={key} x={x * px} y={y * px} width={w * px} height={h * px} />
  );
  return (
    <svg
      width={size}
      height={(size * 11) / 12}
      viewBox={`0 0 ${size} ${(size * 11) / 12}`}
      aria-hidden="true"
      shapeRendering="crispEdges"
      fill={color}
    >
      {r(1, 0, 10, 1, "top")}
      {r(0, 1, 1, 6, "left")}
      {r(11, 1, 1, 6, "right")}
      {r(1, 7, 10, 1, "bottom")}
      {/* tail */}
      {r(3, 8, 2, 1, "t1")}
      {r(3, 9, 1, 1, "t2")}
      {/* dots */}
      {r(3, 3, 1, 2, "d1")}
      {r(5.5, 3, 1, 2, "d2")}
      {r(8, 3, 1, 2, "d3")}
    </svg>
  );
}

function relativeTime(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Messenger() {
  const pathname = usePathname();
  const [state] = useAppState();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [mail, setMail] = useState<MailToastData | null>(null);
  const [seenTick, setSeenTick] = useState(0);
  /** Founder (NPC) conversations, keyed "npc:<startupId>" — session-local. */
  const [npcThreads, setNpcThreads] = useState<Record<string, NpcMsg[]>>({});
  const [npcTyping, setNpcTyping] = useState<string | null>(null);
  const npcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (npcTimer.current) clearTimeout(npcTimer.current);
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const onFloor = pathname?.startsWith("/floor/") ?? false;
  const me = mounted && !onFloor && state.profile.name ? state.profile.id : "";

  const [inbox, refresh] = useInbox(me, 12000);

  // Refs so the push handler sees current UI state without re-subscribing.
  const openRef = useRef(open);
  openRef.current = open;
  const activeRef = useRef(activeThread);
  activeRef.current = activeThread;
  const inboxRef = useRef(inbox);
  inboxRef.current = inbox;

  useSocialPush(me, (ev) => {
    if (ev.t === "social_dm" && typeof ev.from === "string" && ev.from !== me) {
      const reading = openRef.current && activeRef.current === ev.from;
      if (reading) {
        if (typeof ev.ts === "number") markThreadSeen(ev.from, ev.ts);
      } else {
        const conn = inboxRef.current.connections.find((c) => c.peerId === ev.from);
        setMail({
          id: Date.now(),
          fromName: typeof ev.fromName === "string" ? ev.fromName : "connection",
          company: conn?.peerStartup,
          text: typeof ev.text === "string" ? ev.text : "",
          peerId: ev.from,
        });
      }
    }
    refresh();
  });

  const openThread = useCallback(
    (peerId: string) => {
      setOpen(true);
      setActiveThread(peerId);
      if (peerId.startsWith("npc:")) {
        // First open: the founder says hello, in their own voice.
        const s = STARTUPS[peerId.slice(4)];
        if (s) {
          setNpcThreads((prev) =>
            prev[peerId]?.length
              ? prev
              : { ...prev, [peerId]: [{ fromMe: false, text: replyFor(s, ""), ts: Date.now() }] },
          );
        }
        return;
      }
      const msgs = inboxRef.current.threads[peerId];
      const last = msgs?.length ? msgs[msgs.length - 1] : null;
      if (last) markThreadSeen(peerId, last.ts);
      setSeenTick((t) => t + 1);
    },
    [],
  );

  // Reading a thread marks it seen as messages land; keep it scrolled down.
  const activeMsgs =
    activeThread && !activeThread.startsWith("npc:") ? inbox.threads[activeThread] ?? [] : [];
  useEffect(() => {
    if (!open || !activeThread || activeMsgs.length === 0) return;
    markThreadSeen(activeThread, activeMsgs[activeMsgs.length - 1].ts);
    setSeenTick((t) => t + 1);
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, activeThread, activeMsgs.length]);

  // Founder threads scroll down as messages/typing land too.
  const npcLen = activeThread ? npcThreads[activeThread]?.length ?? 0 : 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [npcLen, npcTyping]);

  // Escape steps back: thread -> list -> closed.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      if (activeRef.current) setActiveThread(null);
      else setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!me) return null;

  const seen = ((): Record<string, number> => {
    void seenTick;
    return getSeenMap();
  })();

  const unreadThreads = Object.entries(inbox.threads).filter(([peerId, msgs]) => {
    const last = msgs.length ? msgs[msgs.length - 1] : null;
    return last && last.fromId !== me && last.ts > (seen[peerId] ?? 0);
  }).length;
  const badge = unreadThreads + inbox.requests.length;

  const isNpc = activeThread?.startsWith("npc:") ?? false;
  const activeNpcStartup = isNpc && activeThread ? STARTUPS[activeThread.slice(4)] : undefined;
  const activePeer = activeThread
    ? isNpc
      ? activeNpcStartup
        ? { peerName: activeNpcStartup.founder, peerStartup: activeNpcStartup.name }
        : null
      : inbox.connections.find((c) => c.peerId === activeThread)
    : null;

  const send = (e: React.FormEvent): void => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !activeThread) return;
    setDraft("");
    if (isNpc && activeNpcStartup) {
      const key = activeThread;
      setNpcThreads((prev) => ({
        ...prev,
        [key]: [...(prev[key] ?? []), { fromMe: true, text, ts: Date.now() }],
      }));
      setNpcTyping(key);
      if (npcTimer.current) clearTimeout(npcTimer.current);
      npcTimer.current = setTimeout(() => {
        setNpcTyping((cur) => (cur === key ? null : cur));
        setNpcThreads((prev) => ({
          ...prev,
          [key]: [
            ...(prev[key] ?? []),
            { fromMe: false, text: replyFor(activeNpcStartup, text), ts: Date.now() },
          ],
        }));
      }, 900 + Math.random() * 900);
      return;
    }
    void sendSocialDm(me, state.profile.name || "founder", activeThread, text).then(() =>
      refresh(),
    );
  };

  // Unified chat list: real people (server DMs) first by activity, then the
  // founders you met at their booths (in-game conversations, local replies).
  const sorted = [...inbox.connections].sort((a, b) => {
    const lastA = inbox.threads[a.peerId]?.at(-1)?.ts ?? a.ts;
    const lastB = inbox.threads[b.peerId]?.at(-1)?.ts ?? b.ts;
    return lastB - lastA;
  });
  const npcRows = state.connections
    .filter((c) => c.startupId && !c.peerId && STARTUPS[c.startupId])
    .map((c) => {
      const s = STARTUPS[c.startupId as string];
      const key = `npc:${c.startupId}`;
      return { key, startup: s, lastTs: npcThreads[key]?.at(-1)?.ts ?? c.ts };
    })
    .sort((a, b) => b.lastTs - a.lastTs);

  return (
    <>
      <MailToast toast={mail} onOpen={openThread} onDismiss={() => setMail(null)} />

      {/* ---- panel ---- */}
      {open && (
        <div
          role="dialog"
          aria-label="Chats"
          className="panel anim-in fixed bottom-20 right-4 z-40 flex max-h-[min(480px,70vh)] w-[320px] max-w-[calc(100vw-24px)] flex-col shadow-card"
        >
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            {activeThread ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveThread(null)}
                  aria-label="Back to all chats"
                  className="btn-press rounded-sm px-1 text-muted hover:text-ink"
                >
                  ←
                </button>
                <span className="min-w-0 truncate text-sm text-ink">
                  {activePeer?.peerName ?? "Chat"}
                  {activePeer?.peerStartup && (
                    <span className="text-muted"> · {activePeer.peerStartup}</span>
                  )}
                </span>
              </>
            ) : (
              <span className="font-display text-base">Chats</span>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chats"
              className="ml-auto rounded-sm px-1 leading-none text-muted hover:text-ink"
            >
              ×
            </button>
          </div>

          {activeThread ? (
            <>
              <div ref={scrollRef} className="min-h-[160px] flex-1 overflow-y-auto p-2">
                {isNpc ? (
                  <>
                    {(npcThreads[activeThread ?? ""] ?? []).map((m, i) => (
                      <div
                        key={`${m.ts}-${i}`}
                        className={`rounded-sm px-2 py-1 text-sm ${m.fromMe ? "bg-accent-soft/50" : ""}`}
                      >
                        <span className={`micro mr-2 ${m.fromMe ? "text-accent" : "text-muted"}`}>
                          {m.fromMe ? "you" : activePeer?.peerName ?? "them"}
                        </span>
                        {m.text}
                      </div>
                    ))}
                    {npcTyping === activeThread && (
                      <p className="micro px-2 py-1 text-muted">
                        {activePeer?.peerName ?? "They"} is typing…
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    {activeMsgs.length === 0 && (
                      <p className="px-2 py-3 text-sm text-muted">
                        No messages yet. You did the hard part already.
                      </p>
                    )}
                    {activeMsgs.map((m, i) => (
                      <div
                        key={`${m.ts}-${i}`}
                        className={`rounded-sm px-2 py-1 text-sm ${
                          m.fromId === me ? "bg-accent-soft/50" : ""
                        }`}
                      >
                        <span
                          className={`micro mr-2 ${m.fromId === me ? "text-accent" : "text-muted"}`}
                        >
                          {m.fromId === me ? "you" : activePeer?.peerName ?? "them"}
                        </span>
                        {m.text}
                      </div>
                    ))}
                  </>
                )}
              </div>
              <form onSubmit={send} className="flex gap-2 border-t border-line p-2">
                <label htmlFor="messenger-draft" className="sr-only">
                  Message {activePeer?.peerName ?? "connection"}
                </label>
                <input
                  id="messenger-draft"
                  type="text"
                  value={draft}
                  maxLength={500}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Message ${activePeer?.peerName ?? ""}…`}
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-md border border-line px-2.5 py-1.5 text-sm placeholder:text-muted/70"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="btn-press rounded-md bg-ink px-3 py-1.5 text-sm text-paper hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-2">
              {inbox.requests.length > 0 && (
                <Link
                  href="/connections"
                  className="mb-1 block rounded-md border border-accent/40 bg-accent-soft/40 px-3 py-2 text-sm text-accent hover:bg-accent-soft"
                >
                  {inbox.requests.length} connection request
                  {inbox.requests.length === 1 ? "" : "s"} waiting →
                </Link>
              )}
              {sorted.length === 0 && npcRows.length === 0 ? (
                <p className="px-2 py-4 text-sm text-muted">
                  No chats yet. Walk a floor and talk to any founder — every
                  conversation lands here.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {sorted.map((c) => {
                    const msgs = inbox.threads[c.peerId] ?? [];
                    const last = msgs.length ? msgs[msgs.length - 1] : null;
                    const unread =
                      last && last.fromId !== me && last.ts > (seen[c.peerId] ?? 0);
                    return (
                      <li key={c.peerId}>
                        <button
                          type="button"
                          onClick={() => openThread(c.peerId)}
                          className="btn-press flex w-full items-center gap-2 rounded-md border border-line px-3 py-2 text-left hover:border-muted"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink">
                              {c.peerName}
                              {c.peerStartup && (
                                <span className="text-muted"> · {c.peerStartup}</span>
                              )}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              {last
                                ? `${last.fromId === me ? "you: " : ""}${last.text}`
                                : `connected ${relativeTime(c.ts)}`}
                            </span>
                          </span>
                          {unread && (
                            <span
                              aria-label="Unread"
                              className="h-2 w-2 shrink-0 rounded-full bg-accent"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                  {npcRows.length > 0 && (
                    <li className="micro mt-1 px-1 pt-1 text-muted" aria-hidden="true">
                      Founders you met
                    </li>
                  )}
                  {npcRows.map((r) => {
                    const last = npcThreads[r.key]?.at(-1) ?? null;
                    return (
                      <li key={r.key}>
                        <button
                          type="button"
                          onClick={() => openThread(r.key)}
                          className="btn-press flex w-full items-center gap-2 rounded-md border border-line px-3 py-2 text-left hover:border-muted"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink">
                              {r.startup.founder}
                              <span className="text-muted"> · {r.startup.name}</span>
                            </span>
                            <span className="block truncate text-xs text-muted">
                              {last
                                ? `${last.fromMe ? "you: " : ""}${last.text}`
                                : "met at their booth — say hi"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- launcher ---- */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chats" : `Open chats${badge ? ` (${badge} unread)` : ""}`}
        aria-expanded={open}
        className="btn-press fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-md border border-ink bg-ink shadow-card hover:bg-ink/90"
      >
        <PixelChat />
        {badge > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-medium text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>
    </>
  );
}

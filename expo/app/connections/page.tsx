"use client";

/**
 * Connections — the social home base. Incoming requests (with the
 * requester's track record), your mutual connections with persistent chat
 * that works off-floor, and the founders you collected at seed booths.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/lib/store";
import { FLOORS } from "@/lib/data/floors";
import { STARTUPS } from "@/lib/data/startups";
import {
  getSeenMap,
  markThreadSeen,
  respondToRequest,
  sendSocialDm,
  useInbox,
  useSocialPush,
} from "@/lib/social";
import RequestCard from "@/components/RequestCard";
import Toast, { type ToastData } from "@/components/Toast";

function relativeTime(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Which floor a seed startup exhibits on (for the "visit them" link). */
function floorOf(startupId: string): { id: string; name: string } | null {
  for (const f of FLOORS) {
    if (f.startupIds.includes(startupId)) return { id: f.id, name: f.name };
  }
  return null;
}

export default function ConnectionsPage() {
  const [state, actions] = useAppState();
  const [ready, setReady] = useState(false);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<ToastData | null>(null);
  const [seenTick, setSeenTick] = useState(0); // re-render after mark-seen
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const me = ready ? state.profile.id : "";
  const [inbox, refresh, reachable] = useInbox(me, 15_000);
  // Live pushes make the chat real-time; polling is just the safety net.
  useSocialPush(me, (ev) => {
    // Your outgoing request was accepted while you sat here — mirror the new
    // mutual connection into the local store so quests and card counts see it.
    if (ev.t === "connect_accept" && typeof ev.peerId === "string") {
      actions.addConnection({
        name: typeof ev.peerName === "string" ? ev.peerName : "founder",
        founder: typeof ev.peerName === "string" ? ev.peerName : undefined,
        floorId: "",
        peerId: ev.peerId,
      });
    }
    refresh();
  });

  const activeMsgs = openThread ? inbox.threads[openThread] ?? [] : [];
  const activePeer = inbox.connections.find((c) => c.peerId === openThread);

  // opening (or receiving into) the open thread marks it read
  useEffect(() => {
    if (!openThread || activeMsgs.length === 0) return;
    markThreadSeen(openThread, activeMsgs[activeMsgs.length - 1].ts);
    setSeenTick((t) => t + 1);
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [openThread, activeMsgs.length]);

  const seen = useMemo(() => {
    void seenTick;
    return getSeenMap();
  }, [seenTick, inbox]);

  const respond = async (peer: string, accept: boolean) => {
    if (accept) {
      const req = inbox.requests.find((r) => r.from.id === peer);
      if (req) {
        actions.addConnection({
          startupId: req.from.startupName ? `claim:${peer}` : undefined,
          name: req.from.startupName ?? req.from.name,
          founder: req.from.name,
          floorId: "",
          peerId: peer,
        });
      }
    }
    await respondToRequest(me, state.profile.name, peer, accept, state.myStartup?.name);
    refresh();
    setToast({
      id: Date.now(),
      text: accept ? "Connected. Go say something." : "Declined, quietly.",
    });
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim().slice(0, 500);
    if (!text || !openThread) return;
    setDraft("");
    const ok = await sendSocialDm(me, state.profile.name, openThread, text);
    if (!ok) setToast({ id: Date.now(), text: "Couldn't send — floor server unreachable." });
    refresh();
  };

  // NPC founders collected at seed booths (local-only, no chat off-floor)
  const npcConnections = state.connections.filter((c) => c.startupId);

  if (!ready) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-14">
        <p className="text-sm text-muted">Opening your rolodex…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl">Connections</h1>
        {!reachable && (
          <span className="text-xs text-muted">
            floor server offline — requests and chats will appear when it&rsquo;s back
          </span>
        )}
      </div>

      {/* ---- incoming requests ---- */}
      {inbox.requests.length > 0 && (
        <section aria-label="Connection requests" className="panel p-6">
          <h2 className="font-display text-xl">Requests</h2>
          <p className="mt-1 text-sm text-muted">
            People who walked up and asked. Their card shows what they&rsquo;ve
            actually done here.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {inbox.requests.map((req) => (
              <RequestCard
                key={req.from.id}
                req={req}
                onRespond={(accept) => void respond(req.from.id, accept)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---- mutual connections + chat ---- */}
      <section aria-label="Your connections" className="panel p-6">
        <h2 className="font-display text-xl">People</h2>
        <p className="mt-1 text-sm text-muted">
          Mutual connections. Chat works from here even when you&rsquo;re not
          on a floor.
        </p>
        {inbox.connections.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Nobody yet. Walk a floor, meet someone real, hit Request.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-[240px,1fr]">
            <ul className="flex max-h-[420px] flex-col gap-1 overflow-y-auto">
              {[...inbox.connections]
                .sort((a, b) => b.ts - a.ts)
                .map((c) => {
                  const msgs = inbox.threads[c.peerId] ?? [];
                  const last = msgs.length ? msgs[msgs.length - 1] : null;
                  const unread =
                    last && last.fromId !== me && last.ts > (seen[c.peerId] ?? 0);
                  return (
                    <li key={c.peerId}>
                      <div
                        className={`btn-press flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                          openThread === c.peerId
                            ? "border-accent bg-accent-soft/40"
                            : "border-line hover:border-muted"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenThread(c.peerId)}
                          aria-pressed={openThread === c.peerId}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-ink">
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
                        </button>
                        {unread && (
                          <span
                            aria-label="Unread"
                            className="h-2 w-2 shrink-0 rounded-full bg-accent"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setOpenThread(c.peerId)}
                          className={`micro btn-press shrink-0 rounded-sm border px-2 py-1 ${
                            openThread === c.peerId
                              ? "border-accent text-accent"
                              : "border-line text-muted hover:border-accent hover:text-accent"
                          }`}
                        >
                          Chat
                        </button>
                      </div>
                    </li>
                  );
                })}
            </ul>

            {openThread && activePeer ? (
              <div className="anim-in flex min-h-[280px] flex-col rounded-md border border-line">
                <div className="flex items-center justify-between border-b border-line bg-paper/60 px-3 py-2">
                  <span className="text-sm text-ink">{activePeer.peerName}</span>
                  <span className="micro text-muted">
                    connected {relativeTime(activePeer.ts)}
                  </span>
                </div>
                <div ref={scrollRef} className="max-h-[300px] flex-1 overflow-y-auto p-2">
                  {activeMsgs.length === 0 && (
                    <p className="px-2 py-3 text-sm text-muted">
                      No messages yet. You did the hard part already.
                    </p>
                  )}
                  {activeMsgs.map((m, i) => (
                    <div
                      key={`${m.ts}-${i}`}
                      className={`px-2 py-1 text-sm ${
                        m.fromId === me ? "bg-accent-soft/50" : ""
                      }`}
                    >
                      <span className={`micro mr-2 ${m.fromId === me ? "text-accent" : "text-muted"}`}>
                        {m.fromId === me ? "you" : activePeer.peerName}
                      </span>
                      <span className="break-words text-ink">{m.text}</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={send} className="flex gap-2 border-t border-line p-2">
                  <input
                    type="text"
                    value={draft}
                    maxLength={500}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={`Message ${activePeer.peerName}`}
                    className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-sm placeholder:text-muted/70"
                  />
                  <button
                    type="button"
                    onClick={send}
                    className="btn-press rounded-md bg-ink px-3 py-1.5 text-sm text-paper hover:bg-ink/85"
                  >
                    Send
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex min-h-[280px] items-center justify-center rounded-md border border-dashed border-line">
                <p className="text-sm text-muted">Pick a person to open the chat.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---- collected founders (NPC booths) ---- */}
      <section aria-label="Founders you met" className="panel p-6">
        <h2 className="font-display text-xl">Founders you met</h2>
        <p className="mt-1 text-sm text-muted">
          Collected at their booths. They only talk in person — visit the floor.
        </p>
        {npcConnections.length === 0 ? (
          <p className="mt-4 text-sm text-muted">None yet. The booths are full of them.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {[...npcConnections]
              .sort((a, b) => b.ts - a.ts)
              .map((c) => {
                const home = c.startupId ? floorOf(c.startupId) : null;
                const startup = c.startupId ? STARTUPS[c.startupId] : undefined;
                return (
                  <li key={c.ts} className="flex flex-col gap-1.5 py-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-sm text-ink">{c.founder ?? c.name}</span>
                      <span className="text-xs text-muted">{startup?.name ?? c.name}</span>
                      <span className="micro text-muted">{relativeTime(c.ts)}</span>
                      {home && (
                        <Link
                          href={`/floor/${home.id}${c.startupId ? `?booth=${c.startupId}` : ""}`}
                          className="micro text-accent hover:underline"
                        >
                          visit on {home.name}
                        </Link>
                      )}
                    </div>
                    <input
                      type="text"
                      defaultValue={c.note ?? ""}
                      maxLength={200}
                      onBlur={(e) => actions.setConnectionNote(c.ts, e.target.value)}
                      placeholder="add a note…"
                      className="w-full max-w-md rounded-md border border-line px-2 py-1 text-xs placeholder:text-muted/60"
                    />
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <Toast toast={toast} />
    </main>
  );
}

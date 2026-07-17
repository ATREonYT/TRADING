"use client";

/**
 * Floor chat + dynamic DM threads. The Floor tab is fixed; threads are keyed
 * "npc:<startupId>" or "player:<wireId>" and come/go as the floor page opens
 * and closes them. On small screens the whole panel collapses to a header bar.
 */

import { useEffect, useRef, useState } from "react";
import type { ChatMsg } from "@/lib/types";

export interface ChatThread {
  /** "npc:<startupId>", "player:<wireId>", or "social:<profileId>". */
  key: string;
  kind: "npc" | "player" | "social";
  /** Short tab label (a first name, usually). */
  label: string;
  /** Header line, e.g. "Marisol Vega · Soup Ticket". */
  title: string;
  msgs: ChatMsg[];
  typing: boolean;
  unread: boolean;
  connected: boolean;
  /** Player threads only: the peer has left the floor. */
  left?: boolean;
  /** Player threads only: their messages and bubbles are hidden for you. */
  muted?: boolean;
}

interface ChatPanelProps {
  /** "floor" or an open thread key. */
  tab: string;
  onTab: (t: string) => void;
  floorMsgs: ChatMsg[];
  threads: ChatThread[];
  /** ids that count as "me" (local profile id and the net self id). */
  myIds: string[];
  onSend: (text: string, tab: string) => void;
  /** Wire game input on/off while typing. */
  onFocusChange: (focused: boolean) => void;
  /** Connect with the person behind a thread. */
  onConnect: (key: string) => void;
  /** Hide a thread's tab (never deletes its history). */
  onClose: (key: string) => void;
  /** Player threads only: toggle the session mute for this peer. */
  onToggleMute?: (key: string) => void;
  /** Player threads only: report this peer to the operator. */
  onReport?: (key: string) => void;
  /** Collapse state is owned by the page (so opening a DM can expand it). */
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
  /** Latest activity-ticker line, shown in the panel header. */
  ticker?: string;
}

function MessageRow({ msg, mine }: { msg: ChatMsg; mine: boolean }) {
  // Liveness lines ("Ada left the floor") — muted, no sender.
  if (msg.fromId === "system") {
    return <p className="px-3 py-1 text-xs italic text-muted">{msg.text}</p>;
  }
  return (
    <div className={`px-3 py-1 text-sm ${mine ? "bg-accent-soft/60" : ""}`}>
      <span className={`micro mr-2 ${mine ? "text-accent" : "text-muted"}`}>
        {msg.from}
      </span>
      <span className="break-words text-ink">{msg.text}</span>
    </div>
  );
}

export default function ChatPanel({
  tab,
  onTab,
  floorMsgs,
  threads,
  myIds,
  onSend,
  onFocusChange,
  onConnect,
  onClose,
  onToggleMute,
  onReport,
  collapsed,
  onCollapsedChange,
  ticker,
}: ChatPanelProps) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const active = tab === "floor" ? null : threads.find((t) => t.key === tab) ?? null;
  const activeKey = active ? active.key : "floor";
  const msgs = active ? active.msgs : floorMsgs;
  const typing = active?.typing ?? false;
  const anyUnread = threads.some((t) => t.unread);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing, activeKey, collapsed]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t.slice(0, 500), activeKey);
    setText("");
    inputRef.current?.focus();
  };

  if (collapsed) {
    return (
      <section
        aria-label="Chat (collapsed)"
        className="panel pointer-events-auto w-full overflow-hidden shadow-card sm:w-80"
      >
        <button
          type="button"
          onClick={() => onCollapsedChange(false)}
          className="flex h-11 w-full items-center justify-between gap-2 px-3"
          aria-expanded={false}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="micro shrink-0 text-muted">Chat</span>
            {ticker && (
              <span className="truncate text-xs text-muted/80">{ticker}</span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {anyUnread && (
              <span
                aria-label="Unread messages"
                className="inline-block h-2 w-2 rounded-full bg-accent"
              />
            )}
            <span className="text-xs text-muted">open</span>
          </span>
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="Chat"
      className="panel anim-in pointer-events-auto flex w-full flex-col overflow-hidden shadow-card sm:w-80"
    >
      <div className="flex items-stretch border-b border-line">
        <div
          className="flex flex-1 overflow-x-auto"
          role="tablist"
          aria-label="Chat channels"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeKey === "floor"}
            onClick={() => onTab("floor")}
            className={`micro shrink-0 px-3 py-2.5 ${
              activeKey === "floor"
                ? "border-b-2 border-accent text-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            Floor
          </button>
          {threads.map((th) => (
            <span key={th.key} className="flex shrink-0 items-stretch">
              <button
                type="button"
                role="tab"
                aria-selected={activeKey === th.key}
                onClick={() => onTab(th.key)}
                className={`micro flex items-center gap-1.5 px-2.5 py-2.5 ${
                  activeKey === th.key
                    ? "border-b-2 border-accent text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span className="max-w-[84px] truncate">{th.label}</span>
                {th.unread && (
                  <span
                    aria-label="Unread"
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                  />
                )}
              </button>
              {activeKey === th.key && (
                <button
                  type="button"
                  onClick={() => onClose(th.key)}
                  aria-label={`Close chat with ${th.label}`}
                  className="px-1.5 text-muted hover:text-ink"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onCollapsedChange(true)}
          aria-label="Collapse chat"
          className="shrink-0 border-l border-line px-3 text-xs text-muted hover:text-ink"
        >
          hide
        </button>
      </div>

      {active && (
        <div className="flex items-center justify-between gap-2 border-b border-line bg-paper/60 px-3 py-1.5">
          <span className="truncate text-xs text-muted">{active.title}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            {active.kind === "player" && onToggleMute && (
              <button
                type="button"
                onClick={() => onToggleMute(active.key)}
                className={`micro rounded-sm border px-1.5 py-0.5 ${
                  active.muted
                    ? "border-ink text-ink"
                    : "border-line text-muted hover:border-ink hover:text-ink"
                }`}
              >
                {active.muted ? "Unmute" : "Mute"}
              </button>
            )}
            {active.kind === "player" && onReport && (
              <button
                type="button"
                onClick={() => onReport(active.key)}
                className="micro rounded-sm border border-line px-1.5 py-0.5 text-muted hover:border-ink hover:text-ink"
              >
                Report
              </button>
            )}
            <button
              type="button"
              onClick={() => onConnect(active.key)}
              disabled={active.connected}
              className={`micro rounded-sm border px-1.5 py-0.5 ${
                active.connected
                  ? "cursor-default border-verify/40 text-verify"
                  : "border-accent text-accent hover:bg-accent-soft"
              }`}
            >
              {active.connected ? "Connected" : "Connect"}
            </button>
          </span>
        </div>
      )}

      <div
        ref={scrollRef}
        className="h-36 overflow-y-auto py-1 sm:h-44"
        aria-live="polite"
      >
        {msgs.length === 0 && (
          <p className="px-3 py-2 text-sm text-muted">
            {activeKey === "floor"
              ? "Nobody has said anything yet. Floors are quiet until they aren't."
              : "Say something."}
          </p>
        )}
        {msgs.map((m) => (
          <MessageRow key={m.id} msg={m} mine={myIds.includes(m.fromId)} />
        ))}
        {typing && active && (
          <p className="animate-pulse px-3 py-1 text-xs text-muted">
            {active.label} is typing…
          </p>
        )}
      </div>

      {active?.left && (
        <p className="border-t border-line px-3 py-1 text-xs text-muted">
          not on this floor — they&rsquo;ll miss this
        </p>
      )}

      <form onSubmit={submit} className="flex gap-2 border-t border-line p-2">
        <label htmlFor="chat-input" className="sr-only">
          {activeKey === "floor" ? "Message the floor" : `Message ${active?.label ?? ""}`}
        </label>
        <input
          id="chat-input"
          ref={inputRef}
          type="text"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          placeholder={
            activeKey === "floor"
              ? "Say something to the floor"
              : `Message ${active?.label ?? ""}`
          }
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-md border border-line px-2 text-sm placeholder:text-muted/70"
        />
        <button
          type="submit"
          className="h-10 rounded-md bg-ink px-3 text-sm text-paper hover:bg-ink/85"
        >
          Send
        </button>
      </form>
    </section>
  );
}

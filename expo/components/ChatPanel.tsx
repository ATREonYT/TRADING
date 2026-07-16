"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMsg, Startup } from "@/lib/types";

export interface DmThread {
  startup: Startup;
  msgs: ChatMsg[];
  typing: boolean;
  connected: boolean;
}

interface ChatPanelProps {
  tab: "floor" | "dm";
  onTab: (t: "floor" | "dm") => void;
  floorMsgs: ChatMsg[];
  dm: DmThread | null;
  /** ids that count as "me" (local profile id and the net self id). */
  myIds: string[];
  onSend: (text: string, scope: "floor" | "dm") => void;
  /** Wire game input on/off while typing. */
  onFocusChange: (focused: boolean) => void;
  onConnect: (s: Startup) => void;
}

function MessageRow({ msg, mine }: { msg: ChatMsg; mine: boolean }) {
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
  dm,
  myIds,
  onSend,
  onFocusChange,
  onConnect,
}: ChatPanelProps) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTab: "floor" | "dm" = tab === "dm" && dm ? "dm" : "floor";
  const msgs = activeTab === "dm" && dm ? dm.msgs : floorMsgs;
  const typing = activeTab === "dm" && dm ? dm.typing : false;
  const dmName = dm ? dm.startup.founder.split(" ")[0] || dm.startup.founder : "";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing, activeTab]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t.slice(0, 500), activeTab);
    setText("");
    inputRef.current?.focus();
  };

  return (
    <section
      aria-label="Chat"
      className="panel pointer-events-auto flex w-80 max-w-[calc(100vw-24px)] flex-col overflow-hidden shadow-card"
    >
      <div className="flex border-b border-line" role="tablist" aria-label="Chat channels">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "floor"}
          onClick={() => onTab("floor")}
          className={`micro flex-1 px-3 py-2 ${
            activeTab === "floor"
              ? "border-b-2 border-accent text-ink"
              : "text-muted hover:text-ink"
          }`}
        >
          Floor
        </button>
        {dm && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "dm"}
            onClick={() => onTab("dm")}
            className={`micro flex-1 truncate px-3 py-2 ${
              activeTab === "dm"
                ? "border-b-2 border-accent text-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            {dmName}
          </button>
        )}
      </div>

      {activeTab === "dm" && dm && (
        <div className="flex items-center justify-between gap-2 border-b border-line bg-paper/60 px-3 py-1.5">
          <span className="truncate text-xs text-muted">
            {dm.startup.founder} · {dm.startup.name}
          </span>
          <button
            type="button"
            onClick={() => onConnect(dm.startup)}
            disabled={dm.connected}
            className={`micro rounded-sm border px-1.5 py-0.5 ${
              dm.connected
                ? "cursor-default border-verify/40 text-verify"
                : "border-accent text-accent hover:bg-accent-soft"
            }`}
          >
            {dm.connected ? "Connected" : "Connect"}
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="h-44 overflow-y-auto py-1"
        aria-live="polite"
      >
        {msgs.length === 0 && (
          <p className="px-3 py-2 text-sm text-muted">
            {activeTab === "floor"
              ? "Nobody has said anything yet. Floors are quiet until they aren't."
              : "Say something."}
          </p>
        )}
        {msgs.map((m) => (
          <MessageRow key={m.id} msg={m} mine={myIds.includes(m.fromId)} />
        ))}
        {typing && (
          <p className="animate-pulse px-3 py-1 text-xs text-muted">
            {dmName} is typing…
          </p>
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-line p-2">
        <label htmlFor="chat-input" className="sr-only">
          {activeTab === "floor" ? "Message the floor" : `Message ${dmName}`}
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
          placeholder={activeTab === "floor" ? "Say something to the floor" : `Message ${dmName}`}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-sm placeholder:text-muted/70"
        />
        <button
          type="submit"
          className="rounded-md bg-ink px-3 py-1.5 text-sm text-paper hover:bg-ink/85"
        >
          Send
        </button>
      </form>
    </section>
  );
}

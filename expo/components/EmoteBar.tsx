"use client";

/**
 * Five one-key reactions. Keys 1-5 fire globally while no text field is
 * focused; the buttons work everywhere (and are the only path on touch).
 */

import { useEffect, useRef } from "react";
import { EMOTES, type EmoteKind } from "@/lib/types";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export default function EmoteBar({
  onEmote,
}: {
  onEmote: (kind: EmoteKind) => void;
}) {
  const cbRef = useRef(onEmote);
  cbRef.current = onEmote;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isTyping(e.target)) return;
      const emote = EMOTES.find((x) => x.key === e.key);
      if (!emote) return;
      e.preventDefault();
      cbRef.current(emote.kind);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      role="toolbar"
      aria-label="Reactions"
      className="panel pointer-events-auto flex gap-0.5 p-1 shadow-card"
    >
      {EMOTES.map((em) => (
        <button
          key={em.kind}
          type="button"
          onClick={() => onEmote(em.kind)}
          aria-label={`${em.label} (key ${em.key})`}
          title={`${em.label} — ${em.key}`}
          className="flex h-10 w-10 flex-col items-center justify-center rounded-sm hover:bg-paper active:bg-accent-soft"
        >
          <span aria-hidden="true" className="text-base leading-none">
            {em.char}
          </span>
          <span aria-hidden="true" className="micro mt-0.5 leading-none text-muted">
            {em.key}
          </span>
        </button>
      ))}
    </div>
  );
}

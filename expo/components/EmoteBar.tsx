"use client";

/**
 * One-key reactions. Keys 1-8 fire globally while no text field is focused;
 * the buttons work everywhere (and are the only path on touch). The last
 * three slots are quest rewards — locked ones show which quest opens them.
 */

import { useEffect, useRef } from "react";
import { EMOTES, type EmoteKind } from "@/lib/types";
import { questForEmote } from "@/lib/data/quests";

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
  unlocked,
}: {
  onEmote: (kind: EmoteKind) => void;
  /** Emote kinds this player can fire (quests unlock the rest). */
  unlocked: EmoteKind[];
}) {
  const cbRef = useRef(onEmote);
  cbRef.current = onEmote;
  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isTyping(e.target)) return;
      const emote = EMOTES.find((x) => x.key === e.key);
      if (!emote || !unlockedRef.current.includes(emote.kind)) return;
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
      {EMOTES.map((em) => {
        const open = unlocked.includes(em.kind);
        if (!open) {
          const quest = questForEmote(em.kind);
          return (
            <button
              key={em.kind}
              type="button"
              disabled
              aria-label={`${em.label} — locked`}
              title={quest ? `Locked — finish "${quest.title}" (${quest.blurb})` : "Locked"}
              className="flex h-10 w-10 cursor-help flex-col items-center justify-center rounded-sm opacity-40"
            >
              <span aria-hidden="true" className="text-base leading-none grayscale">
                {em.char}
              </span>
              <span aria-hidden="true" className="micro mt-0.5 leading-none text-muted">
                ✕
              </span>
            </button>
          );
        }
        return (
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
        );
      })}
    </div>
  );
}

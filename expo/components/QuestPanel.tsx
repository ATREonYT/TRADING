"use client";

/**
 * Quest tracker: a compact pill (top-left) showing the next quest, expanding
 * to the full list with progress bars and reward lines. Replaces the old
 * onboarding checklist as the single "what should I do?" surface.
 */

import { useState } from "react";
import type { QuestState } from "@/lib/data/quests";

export default function QuestPanel({ quests }: { quests: QuestState[] }) {
  const [open, setOpen] = useState(false);
  const doneCount = quests.filter((q) => q.done).length;
  const next = quests.find((q) => !q.done);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="panel pointer-events-auto flex items-center gap-2 px-3 py-2 text-left shadow-card hover:bg-paper"
      >
        <span aria-hidden="true" className="text-accent">
          ⭑
        </span>
        <span className="micro text-muted">
          Quests {doneCount}/{quests.length}
        </span>
        {next && (
          <span className="hidden max-w-[220px] truncate text-xs text-ink sm:inline">
            {next.def.title} · {next.count}/{next.def.goal}
          </span>
        )}
      </button>
    );
  }

  return (
    <section
      aria-label="Quests"
      className="panel anim-in pointer-events-auto w-[300px] max-w-[calc(100vw-24px)] shadow-card"
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-expanded={true}
        className="flex w-full items-center justify-between px-3 py-2"
      >
        <span className="micro text-muted">
          Quests · {doneCount}/{quests.length} done
        </span>
        <span className="text-xs text-muted">close</span>
      </button>
      <ul className="max-h-[46vh] overflow-y-auto border-t border-line">
        {quests.map((q) => (
          <li key={q.def.id} className="border-b border-line/60 px-3 py-2 last:border-b-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className={`text-sm ${q.done ? "text-muted line-through" : "text-ink"}`}>
                {q.def.title}
              </span>
              <span className="micro shrink-0 text-muted">
                {q.count}/{q.def.goal}
              </span>
            </div>
            <p className="mt-0.5 text-xs leading-snug text-muted">{q.def.blurb}</p>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line">
              <div
                className={`h-full ${q.done ? "bg-verify" : "bg-accent"}`}
                style={{ width: `${Math.round((q.count / q.def.goal) * 100)}%` }}
              />
            </div>
            <p className={`mt-1 text-xs ${q.done ? "text-verify" : "text-muted"}`}>
              {q.done ? "✓ " : "reward: "}
              {q.def.rewardLabel}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

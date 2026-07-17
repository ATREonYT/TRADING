"use client";

/**
 * Small floating panel that follows the pointer's HoverTarget on the floor
 * canvas. Pointer-events-none; offset from the target and clamped to the
 * viewport so it never spills off-screen.
 */

import { useLayoutEffect, useRef, useState } from "react";
import type { HoverTarget, Startup } from "@/lib/types";
import RankBadge from "@/components/RankBadge";

const OFFSET = 16;
const PAD = 8;

export default function HoverCard({
  target,
  startups,
}: {
  target: HoverTarget | null;
  startups: Record<string, Startup>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!target) {
      setPos(null);
      return;
    }
    const el = ref.current;
    const w = el?.offsetWidth ?? 220;
    const h = el?.offsetHeight ?? 64;
    let left = target.x + OFFSET;
    let top = target.y + OFFSET;
    if (left + w + PAD > window.innerWidth) {
      left = Math.max(PAD, target.x - w - OFFSET);
    }
    if (top + h + PAD > window.innerHeight) {
      top = Math.max(PAD, target.y - h - OFFSET);
    }
    setPos({ left, top });
  }, [target]);

  if (!target) return null;

  let body: React.ReactNode = null;
  if (target.kind === "player") {
    body = (
      <>
        <div className="flex items-baseline gap-2">
          <p className="text-sm leading-tight text-ink">{target.name}</p>
          {target.title && (
            <span className="micro rounded-sm border border-gold/50 px-1 py-px text-gold-deep">
              {target.title}
            </span>
          )}
        </div>
        {target.status && (
          <p className="mt-0.5 text-xs leading-snug text-muted">{target.status}</p>
        )}
        <p className="micro mt-1 text-accent">click to DM</p>
      </>
    );
  } else if (target.kind === "npc") {
    const s = startups[target.startupId];
    body = (
      <>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm leading-tight text-ink">{target.name}</p>
          {s && <RankBadge revenue={s.verifiedRevenue} />}
        </div>
        {s && (
          <p className="mt-0.5 text-xs leading-snug text-muted">
            {s.name} — {s.oneLiner}
          </p>
        )}
      </>
    );
  } else {
    const s = target.booth.startup;
    body = s ? (
      <>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm leading-tight text-ink">{s.name}</p>
          <RankBadge revenue={s.verifiedRevenue} />
        </div>
        <p className="mt-0.5 text-xs leading-snug text-muted">{s.oneLiner}</p>
      </>
    ) : (
      <>
        <p className="text-sm leading-tight text-ink">Open stand</p>
        <p className="mt-0.5 text-xs leading-snug text-muted">
          Vacant. Claimable, if you have a booth.
        </p>
      </>
    );
  }

  return (
    <div
      ref={ref}
      role="tooltip"
      className="panel pointer-events-none fixed z-[60] w-56 max-w-[calc(100vw-16px)] px-3 py-2 shadow-card"
      style={{
        left: pos?.left ?? target.x + OFFSET,
        top: pos?.top ?? target.y + OFFSET,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {body}
    </div>
  );
}

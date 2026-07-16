"use client";

/**
 * The weekly event pill. Normally "Demo Night · 2d 4h"; during the window it
 * turns accent-tinted "DEMO NIGHT · live now". When mounted on the event's
 * own floor, onLiveHere fires (repeatedly while live — the caller dedupes).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { nextEvent, fmtCountdown, type EventInfo } from "@/lib/data/events";
import { floorById } from "@/lib/data/floors";

interface EventPillProps {
  /** Current floor id when rendered on a floor; omit in the lobby. */
  floorId?: string;
  /** Called on each tick while the event is live on `floorId`. */
  onLiveHere?: () => void;
}

export default function EventPill({ floorId, onLiveHere }: EventPillProps) {
  const [view, setView] = useState<{ ev: EventInfo; label: string } | null>(null);
  const liveRef = useRef(onLiveHere);
  liveRef.current = onLiveHere;
  const floorRef = useRef(floorId);
  floorRef.current = floorId;

  useEffect(() => {
    const tick = (): void => {
      const now = Date.now();
      const ev = nextEvent(now);
      const label = ev.live ? "live now" : fmtCountdown(ev.startMs - now);
      setView({ ev, label });
      if (ev.live && floorRef.current && ev.floorId === floorRef.current) {
        liveRef.current?.();
      }
    };
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!view) return null;

  if (view.ev.live) {
    const liveClass =
      "micro inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent-soft px-3 py-2 text-accent shadow-card";
    const dot = (
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent"
      />
    );
    // Already in the room — nothing to route to.
    if (floorId === view.ev.floorId) {
      return (
        <span title={view.ev.blurb} className={liveClass}>
          {dot}
          {view.ev.name} · live now
        </span>
      );
    }
    // Anywhere else, the pill's job is to get you there: name the hall, link it.
    const hall = floorById(view.ev.floorId);
    return (
      <Link
        href={`/floor/${view.ev.floorId}`}
        title={view.ev.blurb}
        className={`${liveClass} hover:bg-accent/15`}
      >
        {dot}
        {view.ev.name} · live now{hall ? ` · ${hall.name}` : ""}
      </Link>
    );
  }

  return (
    <span
      title={view.ev.blurb}
      className="panel inline-flex items-center gap-1.5 px-3 py-2 text-xs text-muted shadow-card"
    >
      {view.ev.name} · {view.label}
    </span>
  );
}

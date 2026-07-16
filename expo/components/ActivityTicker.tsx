"use client";

/**
 * One-line ambient ticker: cycles the floor's recent ActivityItems with a
 * quiet cross-fade. Renders nothing when there is nothing to say.
 */

import { useEffect, useRef, useState } from "react";
import type { ActivityItem } from "@/lib/types";

const CYCLE_MS = 4500;
const FADE_MS = 250;
const AGE_THRESHOLD_MS = 10 * 60_000; // fresher than this reads as "just now"

/** "12m ago" / "2h ago" / "3d ago" — null while the item still feels live. */
function fmtAge(ts: number): string | null {
  const age = Date.now() - ts;
  if (!Number.isFinite(age) || age < AGE_THRESHOLD_MS) return null;
  const m = Math.floor(age / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ActivityTicker({ items }: { items: ActivityItem[] }) {
  const [idx, setIdx] = useState(0);
  const [faded, setFaded] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = setInterval(() => {
      setFaded(true);
      fadeTimer.current = setTimeout(() => {
        setIdx((i) => i + 1);
        setFaded(false);
      }, FADE_MS);
    }, CYCLE_MS);
    return () => {
      clearInterval(timer);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [items.length]);

  if (items.length === 0) return null;
  const item = items[Math.abs(idx) % items.length];
  if (!item) return null;
  const age = fmtAge(item.ts);

  // Sentence case on purpose — this is one muted line, not a label that shouts.
  return (
    <div
      className={`max-w-[70vw] truncate rounded-md border border-line/70 bg-panel/85 px-3 py-1 text-[11px] text-muted transition-opacity duration-300 sm:max-w-md ${
        faded ? "opacity-0" : "opacity-100"
      }`}
    >
      {item.text}
      {age && <span className="opacity-70"> · {age}</span>}
    </div>
  );
}

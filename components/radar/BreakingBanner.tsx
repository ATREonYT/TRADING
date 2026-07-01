"use client";

import type { NewsItem } from "@/lib/radar/types";
import { Zap, External } from "@/components/icons";
import { relTime } from "./helpers";

// A scrolling ticker of the highest-impact breaking headlines. This is the
// "catch it the second it happens" surface at the top of the Radar.
export function BreakingBanner({ items }: { items: NewsItem[] }) {
  const breaking = items.filter((n) => n.breaking).slice(0, 8);
  if (breaking.length === 0) return null;

  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-down/40 bg-down/10 shadow-card">
      <div className="flex shrink-0 items-center gap-1.5 bg-down px-3 py-2 text-2xs font-bold uppercase tracking-wider text-white">
        <Zap size={13} />
        Breaking
      </div>
      <div className="group relative flex-1 overflow-hidden">
        <div className="flex animate-[ticker_38s_linear_infinite] whitespace-nowrap py-2 group-hover:[animation-play-state:paused]">
          {[...breaking, ...breaking].map((n, i) => (
            <a
              key={`${n.id}-${i}`}
              href={n.url}
              target="_blank"
              rel="noreferrer"
              className="mx-5 inline-flex items-center gap-2 text-sm text-ink hover:text-down"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  n.sentiment === "bearish" ? "bg-down" : n.sentiment === "bullish" ? "bg-up" : "bg-accent"
                }`}
              />
              <span className="font-medium">{n.title}</span>
              {n.symbols.length > 0 && (
                <span className="font-mono text-2xs text-accent">
                  {n.symbols.slice(0, 3).join(" ")}
                </span>
              )}
              <span className="text-2xs text-faint">· {relTime(n.publishedAt)}</span>
              <External size={11} className="text-faint" />
            </a>
          ))}
        </div>
      </div>
      <style>{`@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </div>
  );
}

"use client";

import type { Quote } from "@/lib/radar/types";
import { Sparkline } from "@/components/Sparkline";
import { ArrowUp, ArrowDown, Zap } from "@/components/icons";
import { usd, pct, dirClass } from "@/lib/format";
import { radarLink } from "@/lib/radar/symbolLink";

// Horizontal strip of the biggest movers — the "scan the whole market" pulse.
// Cards with unusual volume (a common precursor to a spike) get a flag.
export function MarketPulse({ quotes }: { quotes: Quote[] }) {
  const movers = quotes.slice(0, 16);
  if (movers.length === 0) return null;

  return (
    <section className="glossy rounded-2xl">
      <header className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-up" />
        </span>
        <h2 className="text-sm font-semibold text-ink">Market Pulse — Top Movers</h2>
        <span className="ml-auto text-2xs text-faint">tap a card for news &amp; analysis</span>
      </header>
      <div className="scroll-thin flex gap-2 overflow-x-auto p-3">
        {movers.map((q) => {
          const up = q.changePct >= 0;
          const spike = q.volumeRatio != null && q.volumeRatio >= 180;
          return (
            <a
              key={q.symbol}
              href={radarLink(q.symbol)}
              className={`card-hover w-40 shrink-0 rounded-xl border bg-base/50 p-2.5 ${
                spike ? "border-accent/50" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-ink">{q.symbol}</span>
                {spike && (
                  <span className="flex items-center gap-0.5 rounded bg-accent/15 px-1 py-0.5 text-2xs font-medium text-accent">
                    <Zap size={9} />
                    {(q.volumeRatio! / 100).toFixed(1)}×
                  </span>
                )}
              </div>
              <div className="mt-1 tnum font-mono text-sm text-ink">{usd(q.price)}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className={`tnum flex items-center gap-0.5 text-2xs font-medium ${dirClass(q.changePct)}`}>
                  {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                  {pct(q.changePct)}
                </span>
                <Sparkline data={q.spark ?? []} up={up} width={56} height={20} />
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

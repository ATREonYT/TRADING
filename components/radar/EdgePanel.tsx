"use client";

import type { Signal } from "@/lib/radar/types";
import { radarLink } from "@/lib/radar/symbolLink";
import { Zap, ArrowUp, ArrowDown } from "@/components/icons";
import { pct } from "@/lib/format";

interface Edge {
  symbol: string;
  name: string;
  kind: "divergence" | "coil" | "stack";
  label: string;
  detail: string;
  tone: "bullish" | "bearish" | "neutral";
  changePct: number;
}

// Edge Finder — scans every signal for the setups a headline feed won't
// surface: price/news divergences, volume coiling before a move, and stacked
// catalysts. This is Helix's differentiator: not "what moved", but "what's
// about to matter".
function findEdges(signals: Signal[]): Edge[] {
  const edges: Edge[] = [];
  for (const s of signals) {
    const { momentum, volume, sentiment } = s.breakdown;

    if (s.changePct <= -2 && sentiment >= 25) {
      edges.push({
        symbol: s.symbol,
        name: s.name,
        kind: "divergence",
        label: "Bullish divergence",
        detail: `Down ${Math.abs(s.changePct).toFixed(1)}% but news tone is +${sentiment}`,
        tone: "bullish",
        changePct: s.changePct,
      });
    } else if (s.changePct >= 2 && sentiment <= -25) {
      edges.push({
        symbol: s.symbol,
        name: s.name,
        kind: "divergence",
        label: "Bearish divergence",
        detail: `Up ${s.changePct.toFixed(1)}% but news tone is ${sentiment}`,
        tone: "bearish",
        changePct: s.changePct,
      });
    } else if (volume >= 40 && Math.abs(s.changePct) < 1.5) {
      edges.push({
        symbol: s.symbol,
        name: s.name,
        kind: "coil",
        label: "Coiled volume",
        detail: `Heavy volume, price flat (${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(1)}%) — pressure building`,
        tone: "neutral",
        changePct: s.changePct,
      });
    } else if (s.score >= 72 && s.headlines.length >= 2 && momentum > 0) {
      edges.push({
        symbol: s.symbol,
        name: s.name,
        kind: "stack",
        label: "Signal stack",
        detail: `Score ${s.score} with ${s.headlines.length} headlines and momentum aligned`,
        tone: "bullish",
        changePct: s.changePct,
      });
    }
  }
  // Divergences first — they're the rarest and most actionable.
  const order = { divergence: 0, coil: 1, stack: 2 };
  edges.sort((a, b) => order[a.kind] - order[b.kind]);
  return edges.slice(0, 8);
}

export function EdgePanel({ signals }: { signals: Signal[] }) {
  const edges = findEdges(signals);
  if (edges.length === 0) return null;

  return (
    <section className="glossy rounded-2xl">
      <header className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-accent/15 text-accent">
          <Zap size={13} />
        </span>
        <h2 className="text-sm font-semibold text-ink">Edge Finder</h2>
        <span className="text-2xs text-faint">setups the feed won&apos;t show — divergences, coils, stacks</span>
        <span className="ml-auto rounded-full bg-elevated px-2 py-0.5 text-2xs tabular-nums text-muted">{edges.length}</span>
      </header>
      <div className="scroll-thin flex gap-2 overflow-x-auto p-3">
        {edges.map((e) => (
          <a
            key={`${e.symbol}-${e.kind}`}
            href={radarLink(e.symbol)}
            className={`card-hover w-60 shrink-0 rounded-xl border p-3 ${
              e.tone === "bullish"
                ? "border-up/30 bg-up/[0.05]"
                : e.tone === "bearish"
                  ? "border-down/30 bg-down/[0.05]"
                  : "border-accent/30 bg-accent/[0.05]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-ink">{e.symbol}</span>
              <span
                className={`flex items-center gap-0.5 text-2xs font-semibold ${
                  e.changePct >= 0 ? "text-up" : "text-down"
                }`}
              >
                {e.changePct >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                {pct(e.changePct)}
              </span>
            </div>
            <div
              className={`mt-1 text-xs font-bold ${
                e.tone === "bullish" ? "text-up" : e.tone === "bearish" ? "text-down" : "text-accent"
              }`}
            >
              {e.label}
            </div>
            <p className="mt-0.5 text-2xs leading-snug text-muted">{e.detail}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

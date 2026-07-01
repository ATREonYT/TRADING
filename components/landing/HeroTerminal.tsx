"use client";

import { useEffect, useState } from "react";
import { AnimatedArea } from "./AnimatedArea";
import { HERO_PATH } from "@/lib/landingData";
import { num } from "@/lib/format";

// A faux trading terminal used as the hero visual. The price ticks after mount
// (client-only) to feel live without breaking SSR hydration.
export function HeroTerminal() {
  const [price, setPrice] = useState(132.41);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Deterministic gentle oscillation — no Math.random (keeps it smooth/premium).
    const id = setInterval(() => setTick((t) => t + 1), 1400);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const wobble = Math.sin(tick / 2) * 0.6 + Math.cos(tick / 3) * 0.25;
    setPrice(+(132.41 + wobble).toFixed(2));
  }, [tick]);

  return (
    <div className="relative animate-float">
      {/* glow */}
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-primary/20 blur-3xl animate-glow-breathe" />

      <div className="glass overflow-hidden rounded-2xl shadow-card">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-down/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-warn/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-up/80" />
          <span className="ml-2 font-mono text-2xs text-faint">helix://radar/NVDA</span>
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-up/10 px-2 py-0.5 text-2xs text-up">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-up" /> LIVE
          </span>
        </div>

        <div className="p-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-ink">NVDA</span>
                <span className="rounded bg-up/15 px-1.5 py-0.5 text-2xs font-semibold text-up ring-1 ring-up/30">
                  ▲ Earnings Beat
                </span>
              </div>
              <div className="text-2xs text-muted">NVIDIA Corp · NASDAQ</div>
            </div>
            <div className="text-right">
              <div className="tnum font-mono text-2xl font-bold text-ink transition-colors">${num(price)}</div>
              <div className="tnum font-mono text-xs font-semibold text-up">▲ +6.24%</div>
            </div>
          </div>

          <div className="mt-3">
            <AnimatedArea data={HERO_PATH} height={150} color="#26A69A" />
          </div>

          {/* mini catalyst readout */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { k: "Momentum", v: "+92", c: "text-up" },
              { k: "Volume", v: "3.2×", c: "text-accent" },
              { k: "News tone", v: "Bullish", c: "text-up" },
            ].map((s) => (
              <div key={s.k} className="rounded-lg border border-border/60 bg-base/40 px-2.5 py-2">
                <div className="text-2xs text-faint">{s.k}</div>
                <div className={`font-mono text-sm font-semibold ${s.c}`}>{s.v}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/[0.06] px-2.5 py-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-accent/20 text-accent">⚡</span>
            <p className="text-2xs leading-snug text-muted">
              <span className="font-semibold text-ink">Why it moves:</span> beat + raised guidance forces
              upward estimate revisions and short covering.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

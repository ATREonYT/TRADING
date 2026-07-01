"use client";

import { useEffect, useRef, useState } from "react";
import { CATALYST_EXAMPLE } from "@/lib/landingData";
import { AnimatedArea } from "./AnimatedArea";
import { HERO_PATH } from "@/lib/landingData";
import { Zap } from "@/components/icons";

// "Anatomy of a catalyst" — when scrolled into view, the analysis steps reveal
// one by one, mirroring how the engine decomposes a headline.
export function CatalystShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(-1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          io.disconnect();
          let i = 0;
          const id = setInterval(() => {
            setStep(i);
            i++;
            if (i > CATALYST_EXAMPLE.steps.length) clearInterval(id);
          }, 550);
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="catalysts" className="relative overflow-hidden border-y border-border bg-surface/40 py-20">
      <div ref={ref} className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 lg:grid-cols-2 lg:px-6">
        <div>
          <span className="text-2xs font-semibold uppercase tracking-widest text-accent">The engine</span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Anatomy of a catalyst
          </h2>
          <p className="mt-3 max-w-lg text-muted">
            Helix doesn't just tell you the tone of a story — it identifies the specific event that moves
            the price and explains the mechanism. Here's a live decomposition:
          </p>

          {/* the headline */}
          <div className="mt-6 rounded-xl border border-border bg-base/60 p-4">
            <div className="mb-1 text-2xs uppercase tracking-wide text-faint">Incoming headline</div>
            <p className="text-sm font-medium leading-snug text-ink">“{CATALYST_EXAMPLE.headline}”</p>
          </div>

          {/* revealed analysis */}
          <ul className="mt-4 space-y-2.5">
            {CATALYST_EXAMPLE.steps.map((s, i) => (
              <li
                key={s.label}
                className={`flex items-start gap-3 rounded-lg border p-3 transition-all duration-500 ${
                  step >= i
                    ? "translate-y-0 border-border bg-elevated/60 opacity-100"
                    : "translate-y-2 border-transparent opacity-0"
                }`}
              >
                <span
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-2xs font-bold ${
                    s.tone === "bull" ? "bg-up/15 text-up" : "bg-elevated text-muted"
                  }`}
                >
                  {i + 1}
                </span>
                <div>
                  <div className="text-2xs uppercase tracking-wide text-faint">{s.label}</div>
                  <div className={`text-sm font-medium ${s.tone === "bull" ? "text-up" : "text-ink"}`}>
                    {s.value}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* visual — the resulting move */}
        <div className="relative">
          <div className="glass rounded-2xl p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-ink">{CATALYST_EXAMPLE.symbol}</span>
                <span className="flex items-center gap-1 rounded bg-up/15 px-1.5 py-0.5 text-2xs font-semibold text-up ring-1 ring-up/30">
                  <Zap size={10} /> Earnings Beat ▲
                </span>
              </div>
              <span className="tnum font-mono text-sm font-semibold text-up">+6.2%</span>
            </div>
            <AnimatedArea data={HERO_PATH} height={190} color="#26A69A" />
            <p className="mt-3 text-2xs leading-relaxed text-muted">
              <span className="font-semibold text-ink">Why it moves:</span> {CATALYST_EXAMPLE.steps[3].value}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

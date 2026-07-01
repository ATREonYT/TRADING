"use client";

import { useMemo, useState } from "react";
import type { Signal } from "@/lib/radar/types";
import { Sparkline } from "@/components/Sparkline";
import { ArrowUp, ArrowDown, Zap, External } from "@/components/icons";
import { usd, pct, dirClass } from "@/lib/format";
import { leanBg, sentimentColor } from "./helpers";
import { Freedom24Button } from "./Freedom24Button";

type Filter = "all" | "buy" | "watch" | "equity" | "crypto";

export function SignalsPanel({ signals }: { signals: Signal[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    return signals.filter((s) => {
      if (filter === "buy") return s.lean === "buy";
      if (filter === "watch") return s.lean === "watch";
      if (filter === "equity") return s.kind === "equity";
      if (filter === "crypto") return s.kind === "crypto";
      return true;
    });
  }, [signals, filter]);

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-border bg-surface shadow-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Zap size={16} className="text-accent" />
        <h2 className="text-sm font-semibold text-ink">Market Scanner · Ideas</h2>
        <div className="ml-auto flex items-center gap-1">
          {(["all", "buy", "watch", "equity", "crypto"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-2.5 py-1 text-2xs font-medium capitalize transition-colors ${
                filter === f ? "bg-primary text-white" : "bg-elevated text-muted hover:text-ink"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <ol className="scroll-thin flex-1 divide-y divide-border/60 overflow-y-auto">
        {rows.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-faint">No ideas match this filter.</li>
        )}
        {rows.map((s) => {
          const isOpen = open === s.symbol;
          const up = s.changePct >= 0;
          return (
            <li key={s.symbol} className="px-3 py-2.5 hover:bg-elevated/30">
              <button
                onClick={() => setOpen(isOpen ? null : s.symbol)}
                className="flex w-full items-center gap-3 text-left"
                aria-expanded={isOpen}
              >
                <ScoreDial score={s.score} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-ink">{s.symbol}</span>
                    <span className={`rounded px-1.5 py-0.5 text-2xs font-bold uppercase ring-1 ${leanBg(s.lean)}`}>
                      {s.lean}
                    </span>
                    {s.kind === "crypto" && (
                      <span className="rounded bg-elevated px-1.5 py-0.5 text-2xs text-faint">crypto</span>
                    )}
                  </div>
                  <div className="truncate text-2xs text-muted">{s.name}</div>
                </div>
                <Sparkline data={s.spark ?? []} up={up} />
                <div className="w-24 shrink-0 text-right">
                  <div className="tnum font-mono text-sm text-ink">{usd(s.price)}</div>
                  <div className={`tnum flex items-center justify-end gap-0.5 text-2xs ${dirClass(s.changePct)}`}>
                    {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                    {pct(s.changePct)}
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="mt-2.5 animate-fade-up space-y-2.5 rounded-lg bg-base/60 p-3">
                  <div className="grid grid-cols-3 gap-2">
                    <Bar label="Momentum" value={s.breakdown.momentum} />
                    <Bar label="Volume" value={s.breakdown.volume} />
                    <Bar label="News" value={s.breakdown.sentiment} />
                  </div>
                  <ul className="space-y-1">
                    {s.drivers.map((d, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-muted">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                        {d}
                      </li>
                    ))}
                  </ul>
                  {s.headlines.length > 0 && (
                    <div className="space-y-1 border-t border-border/60 pt-2">
                      {s.headlines.map((h, i) => (
                        <a
                          key={i}
                          href={h.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-start gap-1.5 text-xs text-ink hover:text-primary"
                        >
                          <span className={`mt-0.5 shrink-0 ${sentimentColor(h.sentiment)}`}>•</span>
                          <span className="line-clamp-1">{h.title}</span>
                          <External size={11} className="mt-0.5 shrink-0 text-faint" />
                        </a>
                      ))}
                    </div>
                  )}
                  <Freedom24Button symbol={s.symbol} kind={s.kind} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ScoreDial({ score }: { score: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const color = score >= 66 ? "#26A69A" : score >= 45 ? "#F59E0B" : "#EF5350";
  return (
    <div className="relative grid h-10 w-10 shrink-0 place-items-center">
      <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#23304A" strokeWidth="4" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
        />
      </svg>
      <span className="absolute tnum font-mono text-2xs font-bold text-ink">{score}</span>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  const pos = value >= 0;
  const width = Math.min(50, Math.abs(value) / 2);
  return (
    <div>
      <div className="mb-0.5 text-2xs text-faint">{label}</div>
      <div className="relative h-1.5 rounded-full bg-border">
        <span className="absolute left-1/2 top-0 h-full w-px bg-faint/40" />
        <span
          className={`absolute top-0 h-full rounded-full ${pos ? "bg-up" : "bg-down"}`}
          style={{ left: pos ? "50%" : `${50 - width}%`, width: `${width}%` }}
        />
      </div>
    </div>
  );
}

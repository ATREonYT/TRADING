"use client";

import { SYMBOLS } from "@/lib/mockData";
import { num } from "@/lib/format";
import { Sparkline } from "./Sparkline";
import { Delta } from "./Delta";

export function Watchlist({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (ticker: string) => void;
}) {
  return (
    <aside
      aria-label="Watchlist"
      className="glossy flex h-full flex-col rounded-2xl"
    >
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Watchlist</h2>
        <span className="flex items-center gap-1.5 text-2xs text-muted">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-up" />
          Live
        </span>
      </div>
      <ul className="scroll-thin flex-1 overflow-y-auto p-1.5" role="listbox" aria-label="Symbols">
        {SYMBOLS.map((s) => {
          const active = s.ticker === selected;
          const up = s.changePct >= 0;
          return (
            <li key={s.ticker}>
              <button
                role="option"
                aria-selected={active}
                onClick={() => onSelect(s.ticker)}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  active ? "bg-elevated ring-1 ring-primary/40" : "hover:bg-elevated/60"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-semibold text-ink">{s.ticker}</span>
                  </div>
                  <div className="truncate text-2xs text-faint">{s.name}</div>
                </div>
                <Sparkline data={s.spark} up={up} />
                <div className="flex w-[72px] flex-col items-end">
                  <span className="tnum font-mono text-sm text-ink">{num(s.last)}</span>
                  <Delta value={s.changePct} />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

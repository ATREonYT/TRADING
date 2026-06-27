import { PORTFOLIO } from "@/lib/mockData";
import { usd, compactUsd, signedUsd } from "@/lib/format";
import { Delta } from "./Delta";

type Stat = {
  label: string;
  value: string;
  delta?: number;
  sub: string;
  accent?: boolean;
};

const stats: Stat[] = [
  {
    label: "Net Liquidity",
    value: usd(PORTFOLIO.equity),
    delta: PORTFOLIO.dayPnlPct,
    sub: "Cash " + compactUsd(PORTFOLIO.cash),
  },
  {
    label: "Day's P&L",
    value: signedUsd(PORTFOLIO.dayPnl),
    delta: PORTFOLIO.dayPnlPct,
    sub: "Since prior close",
    accent: true,
  },
  {
    label: "Open P&L",
    value: signedUsd(PORTFOLIO.openPnl),
    delta: PORTFOLIO.openPnlPct,
    sub: "Cost " + compactUsd(PORTFOLIO.cost),
  },
  {
    label: "Buying Power",
    value: usd(PORTFOLIO.buyingPower),
    sub: "Margin 2.0× available",
  },
];

export function StatCards() {
  return (
    <section aria-label="Portfolio summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className="animate-fade-up rounded-xl border border-border bg-surface p-4 shadow-card"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-medium uppercase tracking-wide text-faint">{s.label}</span>
            {s.delta !== undefined && <Delta value={s.delta} />}
          </div>
          <div
            className={`tnum mt-2 font-mono text-2xl font-semibold tracking-tight ${
              s.accent ? (PORTFOLIO.dayPnl >= 0 ? "text-up" : "text-down") : "text-ink"
            }`}
          >
            {s.value}
          </div>
          <div className="mt-1 text-xs text-muted">{s.sub}</div>
        </div>
      ))}
    </section>
  );
}

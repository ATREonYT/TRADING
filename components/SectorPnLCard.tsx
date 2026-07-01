import { SECTOR_PNL } from "@/lib/mockData";
import { signedUsd } from "@/lib/format";

const maxAbs = Math.max(...SECTOR_PNL.map((s) => Math.abs(s.pnl)), 1);

export function SectorPnLCard() {
  return (
    <section className="glossy rounded-2xl" aria-label="Open P&L by sector">
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Open P&L by Sector</h2>
        <p className="text-2xs text-faint">Unrealized, current positions</p>
      </div>
      <ul className="space-y-3 p-4">
        {SECTOR_PNL.map((s) => {
          const up = s.pnl >= 0;
          const w = (Math.abs(s.pnl) / maxAbs) * 100;
          return (
            <li key={s.sector}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted">{s.sector}</span>
                <span className={`tnum font-mono font-medium ${up ? "text-up" : "text-down"}`}>
                  {signedUsd(s.pnl)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-base">
                <div
                  className={`h-full rounded-full ${up ? "bg-up" : "bg-down"}`}
                  style={{ width: `${w}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

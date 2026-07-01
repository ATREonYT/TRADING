import { TAPE } from "@/lib/landingData";
import { num, pct } from "@/lib/format";

// Infinite scrolling price tape — the signature "live market" texture. The row
// is duplicated so the -50% marquee translate loops seamlessly.
export function TickerTape({ className = "" }: { className?: string }) {
  const row = [...TAPE, ...TAPE];
  return (
    <div className={`relative flex overflow-hidden border-y border-border bg-surface/60 ${className}`}>
      <div className="flex shrink-0 animate-marquee items-center whitespace-nowrap py-2" style={{ ["--marquee-duration" as string]: "55s" }}>
        {row.map((t, i) => {
          const up = t.changePct >= 0;
          return (
            <span key={i} className="mx-4 inline-flex items-center gap-2 font-mono text-xs">
              <span className="font-semibold text-ink">{t.symbol}</span>
              <span className="tnum text-muted">{num(t.price)}</span>
              <span className={`tnum ${up ? "text-up" : "text-down"}`}>
                {up ? "▲" : "▼"} {pct(t.changePct)}
              </span>
            </span>
          );
        })}
      </div>
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-base to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-base to-transparent" />
    </div>
  );
}

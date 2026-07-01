import { Reveal } from "./Reveal";
import { HEATMAP } from "@/lib/landingData";
import { pct } from "@/lib/format";
import { radarLink } from "@/lib/radar/symbolLink";

// Color a tile by its move — green for gainers, red for losers, intensity by size.
function tileColor(changePct: number): string {
  const mag = Math.min(1, Math.abs(changePct) / 8);
  const alpha = 0.12 + mag * 0.55;
  return changePct >= 0
    ? `rgba(38,166,154,${alpha.toFixed(2)})`
    : `rgba(239,83,80,${alpha.toFixed(2)})`;
}

const SPAN: Record<number, string> = {
  4: "col-span-2 row-span-2",
  3: "col-span-2 row-span-1",
  2: "col-span-1 row-span-2",
  1: "col-span-1 row-span-1",
};

export function MarketHeatmap() {
  return (
    <section id="markets" className="mx-auto max-w-[1200px] px-4 py-20 lg:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="text-2xs font-semibold uppercase tracking-widest text-primary">Live tape</span>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          The whole market, at a glance
        </h2>
        <p className="mt-3 text-muted">
          A real-time heatmap of what's moving — green runs hot, red runs cold, sized by weight.
        </p>
      </Reveal>

      <Reveal className="mt-10">
        <div className="grid auto-rows-[64px] grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
          {HEATMAP.map((t) => {
            const up = t.changePct >= 0;
            return (
              <a
                key={t.symbol}
                href={radarLink(t.symbol)}
                className={`card-hover flex flex-col justify-center rounded-lg border border-border/40 p-2 ${SPAN[t.weight]}`}
                style={{ backgroundColor: tileColor(t.changePct) }}
              >
                <span className="font-mono text-xs font-bold text-ink">{t.symbol}</span>
                <span className={`tnum font-mono text-2xs font-semibold ${up ? "text-up" : "text-down"}`}>
                  {pct(t.changePct)}
                </span>
              </a>
            );
          })}
        </div>
      </Reveal>
    </section>
  );
}

"use client";

import { useCountUp } from "./useCountUp";
import { Reveal } from "./Reveal";

interface Stat {
  end: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  label: string;
}

const STATS: Stat[] = [
  { end: 65, suffix: "+", label: "News sources scanned" },
  { end: 20, suffix: "+", label: "Catalyst types detected" },
  { end: 500, suffix: "+", label: "Instruments monitored" },
  { end: 24, suffix: "/7", label: "Always-on coverage" },
];

function StatItem({ s }: { s: Stat }) {
  const [ref, value] = useCountUp(s.end);
  const shown = s.decimals ? value.toFixed(s.decimals) : Math.round(value).toString();
  return (
    <div className="text-center">
      <div className="font-mono text-4xl font-bold text-ink sm:text-5xl">
        <span>{s.prefix}</span>
        <span ref={ref}>{shown}</span>
        <span className="text-gradient">{s.suffix}</span>
      </div>
      <div className="mt-1 text-2xs uppercase tracking-wide text-faint">{s.label}</div>
    </div>
  );
}

export function StatsBand() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-16 lg:px-6">
      <Reveal>
        <div className="glossy grid grid-cols-2 gap-8 rounded-2xl px-6 py-10 sm:grid-cols-4">
          {STATS.map((s) => (
            <StatItem key={s.label} s={s} />
          ))}
        </div>
      </Reveal>
    </section>
  );
}

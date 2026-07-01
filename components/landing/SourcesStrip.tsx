const SOURCES = [
  "Reuters", "Bloomberg", "Associated Press", "Financial Times", "WSJ", "CNBC",
  "MarketWatch", "Barron's", "The Economist", "BBC", "The Guardian", "NYT",
  "Forbes", "Fortune", "Business Insider", "Seeking Alpha", "Benzinga",
  "CoinDesk", "Cointelegraph", "The Block", "Al Jazeera", "Nikkei",
];

// Continuous marquee of aggregated outlets — signals breadth of coverage.
export function SourcesStrip() {
  const row = [...SOURCES, ...SOURCES];
  return (
    <section className="border-y border-border bg-surface/30 py-8">
      <p className="mb-5 text-center text-2xs font-semibold uppercase tracking-[0.2em] text-faint">
        Aggregating &amp; analysing 65+ outlets in real time
      </p>
      <div className="relative flex overflow-hidden">
        <div
          className="flex shrink-0 animate-marquee items-center gap-3 whitespace-nowrap"
          style={{ ["--marquee-duration" as string]: "50s" }}
        >
          {row.map((s, i) => (
            <span
              key={i}
              className="glass rounded-full px-4 py-1.5 font-mono text-xs font-medium text-muted"
            >
              {s}
            </span>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-base to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-base to-transparent" />
      </div>
    </section>
  );
}

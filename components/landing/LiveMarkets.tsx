import { SectionHeading } from "./SectionHeading";
import { Reveal } from "./Reveal";
import { MarketMovers } from "./MarketMovers";
import { SentimentGauge } from "./SentimentGauge";

// Organised "live markets" band: mood gauge + top movers, side by side.
export function LiveMarkets() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-20 lg:px-6">
      <SectionHeading
        eyebrow="Live markets"
        accent="text-up"
        title="The market's pulse, in one glance"
        subtitle="A real-time read on sentiment and the biggest movers — computed from live news and price data."
      />
      <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <Reveal>
          <SentimentGauge />
        </Reveal>
        <Reveal delay={100}>
          <MarketMovers />
        </Reveal>
      </div>
    </section>
  );
}

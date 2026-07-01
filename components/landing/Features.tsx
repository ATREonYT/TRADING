import { Reveal } from "./Reveal";
import { Zap, Newspaper, Candles, Bell, Radar, Layers } from "@/components/icons";

const FEATURES = [
  {
    icon: Zap,
    title: "Catalyst detection",
    body: "Every headline is classified by the real driver behind a move — earnings beats/misses, guidance changes, upgrades, M&A, approvals, legal risk — each with a plain-English 'why it moves'.",
    tint: "text-accent",
  },
  {
    icon: Newspaper,
    title: "65+ news sources",
    body: "Reuters, Bloomberg, AP, FT, WSJ, CNBC, MarketWatch, Barron's, plus crypto and macro desks — aggregated, de-duplicated, and sentiment-scored in real time.",
    tint: "text-primary",
  },
  {
    icon: Candles,
    title: "Full-market scanner",
    body: "Momentum, volume and news sentiment fused into one 0–100 conviction score across equities and crypto — ranked so the best setups float to the top.",
    tint: "text-up",
  },
  {
    icon: Bell,
    title: "Breaking alerts",
    body: "High-impact stories surface on a live breaking ticker the second they're detected, so you catch the move before it's priced in.",
    tint: "text-down",
  },
  {
    icon: Radar,
    title: "Volume-spike radar",
    body: "Unusual volume — often the first footprint of a spike — is flagged on every mover before the price fully reacts.",
    tint: "text-warn",
  },
  {
    icon: Layers,
    title: "Sentiment engine",
    body: "A transparent finance-tuned lexicon scores tone with no black box — you can always read exactly why something rates bullish or bearish.",
    tint: "text-primary",
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-[1200px] px-4 py-20 lg:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="text-2xs font-semibold uppercase tracking-widest text-primary">What it does</span>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          A trading terminal that reads the news for you
        </h2>
        <p className="mt-3 text-muted">
          Not just a feed — an engine that understands what actually causes price changes and puts it in front of you first.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 70}>
            <div className="card-hover group h-full rounded-2xl border border-border bg-surface/70 p-6">
              <span className={`mb-4 grid h-11 w-11 place-items-center rounded-xl bg-elevated ring-1 ring-border ${f.tint}`}>
                <f.icon size={20} />
              </span>
              <h3 className="text-base font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

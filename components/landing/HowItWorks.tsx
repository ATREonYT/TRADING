import { Reveal } from "./Reveal";

const STEPS = [
  {
    n: "01",
    title: "Scan everything",
    body: "Helix continuously pulls 65+ news feeds and scans hundreds of equities and crypto pairs for price and volume shifts.",
  },
  {
    n: "02",
    title: "Find the catalyst",
    body: "Each story is classified by the event driving it, scored for sentiment and impact, and linked to the tickers it affects.",
  },
  {
    n: "03",
    title: "Rank & alert",
    body: "Momentum, volume and news fuse into a conviction score. The highest-impact moves surface instantly on your radar.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-[1200px] px-4 py-20 lg:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="text-2xs font-semibold uppercase tracking-widest text-primary">How it works</span>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">From noise to signal in three steps</h2>
      </Reveal>

      <div className="relative mt-14 grid gap-6 md:grid-cols-3">
        {/* connector line */}
        <div className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 120}>
            <div className="relative rounded-2xl border border-border bg-surface/70 p-6">
              <div className="mb-4 grid h-16 w-16 place-items-center rounded-full border border-border bg-base font-mono text-xl font-bold text-primary shadow-glow">
                {s.n}
              </div>
              <h3 className="text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

import { HeroTerminal } from "./HeroTerminal";
import { Aurora } from "./Aurora";
import { Radar, Newspaper, ArrowUp } from "@/components/icons";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* animated backdrops */}
      <div className="hero-mesh absolute inset-0 -z-30 animate-gradient-pan" />
      <Aurora className="-z-20" />
      <div className="grid-overlay absolute inset-0 -z-10 opacity-50" />
      <div className="noise absolute inset-0 -z-10" />

      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 pb-16 pt-12 lg:grid-cols-[1.05fr_1fr] lg:px-6 lg:pb-24 lg:pt-20">
        {/* copy */}
        <div className="animate-rise">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-2xs text-muted">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-up" />
            Live market intelligence · 65+ news sources · real-time
          </div>

          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Trade the news
            <br />
            <span className="text-gradient">before it moves</span> the tape.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Helix scans the entire market and the world's financial news in real time, pinpoints the{" "}
            <span className="font-semibold text-ink">actual catalysts</span> that move prices — earnings
            beats, guidance changes, Fed decisions, upgrades, M&amp;A — and ranks what's spiking, the
            second it happens.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/radar"
              className="group flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.03]"
            >
              <Radar size={18} />
              Launch Radar
              <ArrowUp size={14} className="rotate-45 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-primary/50"
            >
              <Newspaper size={18} className="text-primary" />
              Open Dashboard
            </a>
          </div>

          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
            {[
              { v: "65+", k: "news sources" },
              { v: "24/7", k: "market scanning" },
              { v: "20+", k: "catalyst types" },
            ].map((s) => (
              <div key={s.k}>
                <dt className="font-mono text-2xl font-bold text-ink">{s.v}</dt>
                <dd className="text-2xs uppercase tracking-wide text-faint">{s.k}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* visual */}
        <div className="animate-rise [animation-delay:120ms]">
          <HeroTerminal />
        </div>
      </div>
    </section>
  );
}

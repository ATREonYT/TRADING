import { Reveal } from "./Reveal";
import { Aurora } from "./Aurora";
import { Radar, ArrowUp } from "@/components/icons";

export function CTASection() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-20 lg:px-6">
      <Reveal>
        <div className="glossy relative overflow-hidden rounded-3xl p-10 text-center sm:p-16">
          <div className="hero-mesh absolute inset-0 -z-10 animate-gradient-pan opacity-70" />
          <Aurora className="-z-10 opacity-70" />
          <div className="grid-overlay absolute inset-0 -z-10 opacity-40" />

          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Stop reading the news. Start <span className="text-gradient-green">trading the catalyst.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Open the radar and see what's moving markets right now — with the reasons behind every move.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/radar"
              className="group flex items-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.03]"
            >
              <Radar size={18} />
              Launch Radar — it's live
              <ArrowUp size={14} className="rotate-45 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="/dashboard"
              className="rounded-lg border border-border bg-surface/60 px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-primary/50"
            >
              Explore the dashboard
            </a>
          </div>
          <p className="mt-6 text-2xs text-faint">
            Not financial advice · Informational tool · Markets carry risk
          </p>
        </div>
      </Reveal>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { NewsItem, RadarPayload } from "@/lib/radar/types";
import { Reveal } from "./Reveal";
import { relTime, sentimentBg, directionArrow } from "@/components/radar/helpers";
import { Zap, External } from "@/components/icons";

// Pulls the real news API so the landing page shows genuine, current catalysts.
export function LiveNewsStrip() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/radar/news", { cache: "no-store" })
      .then((r) => r.json() as Promise<RadarPayload<NewsItem>>)
      .then((d) => {
        if (!active) return;
        const withCat = d.items.filter((n) => n.catalyst);
        setItems((withCat.length ? withCat : d.items).slice(0, 6));
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="border-y border-border bg-surface/40 py-20">
      <div className="mx-auto max-w-[1200px] px-4 lg:px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-2xs font-semibold uppercase tracking-widest text-accent">Right now</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Live catalysts on the wire</h2>
          </div>
          <a href="/radar" className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            See the full radar <External size={14} />
          </a>
        </Reveal>

        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {loading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-elevated/40" />
            ))}

          {!loading &&
            items.map((n, i) => (
              <Reveal key={n.id} delay={i * 60}>
                <a
                  href={n.url}
                  target="_blank"
                  rel="noreferrer"
                  className="card-hover block h-full rounded-xl border border-border bg-base/50 p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    {n.catalyst && (
                      <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-bold ring-1 ${sentimentBg(n.catalyst.direction)}`}>
                        <Zap size={10} /> {directionArrow(n.catalyst.direction)} {n.catalyst.label}
                      </span>
                    )}
                    {n.symbols.slice(0, 3).map((s) => (
                      <span key={s} className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-2xs text-primary">
                        {s}
                      </span>
                    ))}
                    <span className="ml-auto text-2xs text-faint">{relTime(n.publishedAt)}</span>
                  </div>
                  <p className="text-sm font-medium leading-snug text-ink">{n.title}</p>
                  <div className="mt-1.5 text-2xs text-faint">{n.source}</div>
                </a>
              </Reveal>
            ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { NewsItem, Quote, Signal } from "@/lib/radar/types";
import { useLive } from "./useLive";
import { BreakingBanner } from "./BreakingBanner";
import { MarketPulse } from "./MarketPulse";
import { NewsFeed } from "./NewsFeed";
import { SignalsPanel } from "./SignalsPanel";
import { Radar, Refresh, External } from "@/components/icons";
import { FREEDOM24_HOME } from "@/lib/radar/freedom24";

const NEWS_MS = 20000;
const MARKET_MS = 30000;

export function RadarView() {
  const news = useLive<NewsItem>("/api/radar/news", NEWS_MS);
  const markets = useLive<Quote>("/api/radar/markets", MARKET_MS, (q) => q.symbol);
  const signals = useLive<Signal>("/api/radar/signals", MARKET_MS, (s) => s.symbol);

  const degraded = news.degraded || markets.degraded || signals.degraded;
  const lastUpdated = Math.max(news.lastUpdated ?? 0, markets.lastUpdated ?? 0);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-4 lg:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-deep shadow-glow">
            <Radar size={18} className="text-white" />
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight text-ink">Radar</h1>
            <p className="text-2xs text-muted">Live world news · market scanner · trade ideas</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <a
            href={FREEDOM24_HOME}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-md bg-[#0FA958] px-2.5 py-1.5 text-2xs font-semibold text-white transition-opacity hover:opacity-90 sm:flex"
          >
            <span className="grid h-4 w-4 place-items-center rounded bg-white/15 font-mono text-[7px] font-bold leading-none">
              F24
            </span>
            Trade on Freedom24
            <External size={12} className="opacity-90" />
          </a>
          <LivePill loading={news.loading || markets.loading} lastUpdated={lastUpdated || null} />
          <button
            onClick={() => {
              news.refresh();
              markets.refresh();
              signals.refresh();
            }}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-2xs text-muted transition-colors hover:text-ink"
          >
            <Refresh size={13} />
            Refresh
          </button>
        </div>
      </div>

      {degraded && <DegradedNote notes={[...news.notes, ...markets.notes, ...signals.notes]} />}

      <BreakingBanner items={news.data} />
      <MarketPulse quotes={markets.data} />

      {/* Two-column: news + scanner */}
      <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-h-0 xl:h-[calc(100dvh-330px)]">
          <NewsFeed items={news.data} freshIds={news.freshIds} />
        </div>
        <div className="min-h-0 xl:h-[calc(100dvh-330px)]">
          <SignalsPanel signals={signals.data} />
        </div>
      </div>

      <Disclaimer />
    </div>
  );
}

function LivePill({ loading, lastUpdated }: { loading: boolean; lastUpdated: number | null }) {
  const [, force] = useState(0);
  // Tick the "updated Xs ago" label without extra network calls.
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  const secs = lastUpdated ? Math.round((Date.now() - lastUpdated) / 1000) : null;
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-2xs">
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full rounded-full bg-up/60 ${loading ? "animate-ping" : ""}`} />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-up" />
      </span>
      <span className="font-medium text-up">LIVE</span>
      {secs != null && <span className="text-faint">· {secs < 5 ? "just now" : `${secs}s ago`}</span>}
    </span>
  );
}

function DegradedNote({ notes }: { notes: string[] }) {
  const unique = Array.from(new Set(notes)).slice(0, 3);
  return (
    <div className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
      <span className="font-semibold">Demo mode — </span>
      live sources are unreachable in this environment, so sample data is shown. Deploy where outbound
      HTTPS is allowed to stream real news &amp; prices.
      {unique.length > 0 && <span className="text-warn/70"> ({unique.join("; ")})</span>}
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="rounded-lg border border-border bg-surface/50 px-3 py-2 text-2xs leading-relaxed text-faint">
      <span className="font-semibold text-muted">Not financial advice.</span> Radar is an automated
      information tool. Signals are computed from public price, volume and news data using transparent
      heuristics — they are not recommendations to buy or sell any security. &ldquo;Trade on
      Freedom24&rdquo; buttons open the instrument at Freedom24, an independent third-party broker;
      Helix does not execute orders. Markets are risky; do your own research and consider a licensed
      advisor before trading.
    </p>
  );
}

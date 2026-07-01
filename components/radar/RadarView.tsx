"use client";

import { useEffect, useMemo, useState } from "react";
import type { NewsItem, Quote, Signal } from "@/lib/radar/types";
import { useLive } from "./useLive";
import { BreakingBanner } from "./BreakingBanner";
import { MarketPulse } from "./MarketPulse";
import { NewsFeed } from "./NewsFeed";
import { SignalsPanel } from "./SignalsPanel";
import { Radar, Refresh, Zap, Newspaper, ArrowUp, ArrowDown } from "@/components/icons";
import { pct } from "@/lib/format";

const NEWS_MS = 20000;
const MARKET_MS = 30000;

export function RadarView() {
  const news = useLive<NewsItem>("/api/radar/news", NEWS_MS);
  const markets = useLive<Quote>("/api/radar/markets", MARKET_MS, (q) => q.symbol);
  const signals = useLive<Signal>("/api/radar/signals", MARKET_MS, (s) => s.symbol);

  const degraded = news.degraded || markets.degraded || signals.degraded;
  const lastUpdated = Math.max(news.lastUpdated ?? 0, markets.lastUpdated ?? 0);

  // Symbol focus from ?q= (set by clicking a ticker anywhere on the site).
  const [focus, setFocus] = useState<string>("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setFocus(q.toUpperCase());
  }, []);

  // ── KPI summary computed live from the feeds ─────────────────────────────
  const kpis = useMemo(() => {
    let bull = 0;
    let bear = 0;
    const catalysts = new Map<string, number>();
    for (const n of news.data) {
      if (n.sentiment === "bullish") bull++;
      else if (n.sentiment === "bearish") bear++;
      if (n.catalyst) catalysts.set(n.catalyst.label, (catalysts.get(n.catalyst.label) ?? 0) + 1);
    }
    const mood = bull + bear ? Math.round((bull / (bull + bear)) * 100) : 50;
    const breakingCount = news.data.filter((n) => n.breaking).length;
    const topMover = [...markets.data].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];
    const topCatalyst = [...catalysts.entries()].sort((a, b) => b[1] - a[1])[0];
    return { mood, breakingCount, topMover, topCatalyst };
  }, [news.data, markets.data]);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5 lg:px-6">
      {/* Header */}
      <div className="glossy flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3.5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-deep shadow-glow">
          <Radar size={20} className="text-white" />
        </span>
        <div>
          <h1 className="text-lg font-bold leading-tight tracking-tight text-ink">Radar</h1>
          <p className="text-2xs text-muted">Live world news · catalyst analysis · market scanner</p>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <LivePill loading={news.loading || markets.loading} lastUpdated={lastUpdated || null} />
          <button
            onClick={() => {
              news.refresh();
              markets.refresh();
              signals.refresh();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-elevated/60 px-3 py-1.5 text-2xs font-medium text-muted transition-colors hover:text-ink"
          >
            <Refresh size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI summary row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MoodCard mood={kpis.mood} />
        <KpiCard
          icon={<Zap size={15} />}
          tint="text-down"
          label="Breaking now"
          value={String(kpis.breakingCount)}
          sub="high-impact stories"
        />
        <KpiCard
          icon={kpis.topMover && kpis.topMover.changePct >= 0 ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
          tint={kpis.topMover && kpis.topMover.changePct >= 0 ? "text-up" : "text-down"}
          label="Top mover"
          value={kpis.topMover?.symbol ?? "—"}
          sub={kpis.topMover ? pct(kpis.topMover.changePct) : "loading"}
        />
        <KpiCard
          icon={<Newspaper size={15} />}
          tint="text-accent"
          label="Leading catalyst"
          value={kpis.topCatalyst?.[0] ?? "—"}
          sub={kpis.topCatalyst ? `${kpis.topCatalyst[1]} stories` : "scanning"}
        />
      </div>

      {degraded && <DegradedNote />}

      {focus && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs">
          <span className="text-muted">Focused on</span>
          <span className="rounded bg-primary/20 px-2 py-0.5 font-mono font-semibold text-primary">{focus}</span>
          <a href="/radar" className="ml-auto text-2xs text-muted underline-offset-2 hover:text-ink hover:underline">
            Clear
          </a>
        </div>
      )}

      <BreakingBanner items={news.data} />
      <MarketPulse quotes={markets.data} />

      {/* Two-column: news + scanner */}
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-h-0 xl:h-[calc(100dvh-430px)]">
          <NewsFeed items={news.data} freshIds={news.freshIds} initialQuery={focus} />
        </div>
        <div className="min-h-0 xl:h-[calc(100dvh-430px)]">
          <SignalsPanel signals={signals.data} focus={focus} />
        </div>
      </div>

      <Disclaimer />
    </div>
  );
}

function KpiCard({
  icon,
  tint,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="glossy rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-lg bg-elevated ring-1 ring-border ${tint}`}>
          {icon}
        </span>
        <span className="text-2xs font-medium uppercase tracking-wide text-faint">{label}</span>
      </div>
      <div className="mt-2 truncate font-mono text-lg font-bold text-ink">{value}</div>
      <div className="text-2xs text-muted">{sub}</div>
    </div>
  );
}

function MoodCard({ mood }: { mood: number }) {
  const label = mood >= 70 ? "Greed" : mood >= 55 ? "Bullish" : mood >= 45 ? "Neutral" : mood >= 30 ? "Bearish" : "Fear";
  const color = mood >= 55 ? "#26A69A" : mood >= 45 ? "#F59E0B" : "#EF5350";
  return (
    <div className="glossy rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <span className="text-2xs font-medium uppercase tracking-wide text-faint">Market mood</span>
        <span className="ml-auto font-mono text-sm font-bold" style={{ color }}>
          {label}
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="font-mono text-lg font-bold" style={{ color }}>
          {mood}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${mood}%`, background: color }}
          />
        </div>
      </div>
      <div className="mt-1 text-2xs text-muted">bullish share of headlines</div>
    </div>
  );
}

function LivePill({ loading, lastUpdated }: { loading: boolean; lastUpdated: number | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  const secs = lastUpdated ? Math.round((Date.now() - lastUpdated) / 1000) : null;
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-border bg-elevated/60 px-2.5 py-1.5 text-2xs">
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full rounded-full bg-up/60 ${loading ? "animate-ping" : ""}`} />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-up" />
      </span>
      <span className="font-semibold text-up">LIVE</span>
      {secs != null && <span className="text-faint">· {secs < 5 ? "just now" : `${secs}s ago`}</span>}
    </span>
  );
}

function DegradedNote() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-warn/20 text-2xs font-bold">i</span>
      <span>
        <span className="font-semibold">Demo mode</span> — live sources are unreachable in this
        environment, so sample data is shown. Deploy where outbound HTTPS is allowed to stream real
        news &amp; prices.
      </span>
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="rounded-lg border border-border bg-surface/50 px-3 py-2 text-2xs leading-relaxed text-faint">
      <span className="font-semibold text-muted">Not financial advice.</span> Radar is an automated
      information tool. Signals are computed from public price, volume and news data using transparent
      heuristics — they are not recommendations to buy or sell any security. Markets are risky; do
      your own research and consider a licensed advisor before trading.
    </p>
  );
}

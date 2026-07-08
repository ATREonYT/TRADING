"use client";

import { useCallback, useEffect, useState } from "react";
import type { NewsItem, Quote, Signal } from "@/lib/radar/types";
import type { Indicators, Projection, HiddenSignal } from "@/lib/radar/analytics";
import { AnimatedArea } from "@/components/landing/AnimatedArea";
import { CandleChart } from "./CandleChart";
import { ProjectionChart } from "./ProjectionChart";
import { TradeTicket } from "./TradeTicket";
import { relTime, sentimentBg, directionArrow, CATEGORY_LABEL, leanBg } from "@/components/radar/helpers";
import { Radar, Refresh, Zap, External, ArrowUp, ArrowDown, Newspaper } from "@/components/icons";
import { usd, num, pct, dirClass } from "@/lib/format";
import { stockHref } from "@/components/useSymbolSearch";
import type { SearchResult } from "@/lib/radar/search";

interface StockData {
  ok: boolean;
  degraded: boolean;
  symbol: string;
  name: string;
  kind: "equity" | "crypto";
  quote: Quote | null;
  signal: Signal | null;
  news: NewsItem[];
  indicators: Indicators | null;
  projection: Projection | null;
  hidden: HiddenSignal[];
  briefing: string;
  notes: string[];
}

export function StockView({ symbol, displayName }: { symbol: string; displayName?: string }) {
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openWhy, setOpenWhy] = useState<Set<string>>(new Set());
  const [listings, setListings] = useState<SearchResult[]>([]);

  const load = useCallback(async () => {
    try {
      const nameQ = displayName ? `&name=${encodeURIComponent(displayName)}` : "";
      const r = await fetch(`/api/radar/stock?symbol=${encodeURIComponent(symbol)}${nameQ}`, { cache: "no-store" });
      const j = (await r.json()) as StockData;
      setData(j);
    } catch {
      /* keep prior data */
    } finally {
      setLoading(false);
    }
  }, [symbol, displayName]);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) load();
    }, 30000);
    return () => clearInterval(id);
  }, [load]);

  // Other listings of the same company on different exchanges (HKEX/NYSE/...).
  useEffect(() => {
    const name = displayName ?? data?.name;
    if (!name || name === symbol) return;
    let active = true;
    fetch(`/api/radar/search?q=${encodeURIComponent(name)}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ items: SearchResult[] }>)
      .then((j) => {
        if (!active || !Array.isArray(j.items)) return;
        const others = j.items.filter(
          (it) => it.symbol !== symbol && it.kind !== "crypto" && it.exchange,
        );
        setListings(others.slice(0, 4));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, displayName, data?.name]);

  const toggleWhy = (id: string) =>
    setOpenWhy((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const q = data?.quote;
  const s = data?.signal;
  const up = (q?.changePct ?? 0) >= 0;

  // Sentiment tally + top catalysts across this stock's news.
  const news = data?.news ?? [];
  const bull = news.filter((n) => n.sentiment === "bullish").length;
  const bear = news.filter((n) => n.sentiment === "bearish").length;
  const catalystCounts = new Map<string, { label: string; dir: NewsItem["sentiment"]; n: number }>();
  for (const n of news) {
    if (!n.catalyst) continue;
    const cur = catalystCounts.get(n.catalyst.label) ?? { label: n.catalyst.label, dir: n.catalyst.direction, n: 0 };
    cur.n++;
    catalystCounts.set(n.catalyst.label, cur);
  }
  const topCatalysts = [...catalystCounts.values()].sort((a, b) => b.n - a.n).slice(0, 5);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-5 lg:px-6">
      {/* Breadcrumb / actions */}
      <div className="flex items-center gap-3">
        <a href="/radar" className="flex items-center gap-1.5 text-2xs text-muted transition-colors hover:text-ink">
          <Radar size={13} /> Radar
        </a>
        <span className="text-faint">/</span>
        <span className="font-mono text-2xs text-ink">{symbol}</span>
        <button
          onClick={load}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-border bg-elevated/60 px-3 py-1.5 text-2xs font-medium text-muted transition-colors hover:text-ink"
        >
          <Refresh size={13} /> Refresh
        </button>
      </div>

      {data?.degraded && (
        <div className="flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-warn/20 text-2xs font-bold">i</span>
          <span>
            <span className="font-semibold">Demo mode</span> — live sources are blocked in this environment.
            Deploy where outbound HTTPS is allowed to stream real {symbol} news &amp; prices.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="glossy rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-3">
            <span
              className={`grid h-12 w-12 place-items-center rounded-xl font-mono text-lg font-bold ring-1 ring-border ${
                data?.kind === "crypto" ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary"
              }`}
            >
              {symbol.replace(/-USD$/, "").slice(0, 4)}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-2xl font-bold text-ink">{symbol}</h1>
                {q?.exchange && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-2xs font-semibold text-primary ring-1 ring-primary/30">
                    {q.exchange}
                  </span>
                )}
                {data?.kind === "crypto" && (
                  <span className="rounded bg-elevated px-1.5 py-0.5 text-2xs text-faint">crypto</span>
                )}
              </div>
              <div className="text-sm text-muted">{displayName ?? data?.name ?? symbol}</div>
              {listings.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-2xs text-faint">Also listed:</span>
                  {listings.map((l) => (
                    <a
                      key={`${l.symbol}-${l.exchange}`}
                      href={stockHref(l)}
                      className="flex items-center gap-1 rounded-full border border-border bg-elevated/60 px-2 py-0.5 text-2xs font-medium text-muted transition-colors hover:border-primary/50 hover:text-ink"
                      title={`Switch to ${l.symbol} on ${l.exchange}`}
                    >
                      <span className="font-mono font-semibold text-ink">{l.symbol}</span>
                      {l.exchange}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {q && (
            <div>
              <div className="tnum font-mono text-3xl font-bold text-ink">{usd(q.price)}</div>
              <div className={`tnum flex items-center gap-1 text-sm font-semibold ${dirClass(q.changePct)}`}>
                {up ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                {pct(q.changePct)} today
              </div>
            </div>
          )}

          {s && (
            <div className="ml-auto flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xs uppercase tracking-wide text-faint">Conviction</div>
                <div className="font-mono text-2xl font-bold text-ink">{s.score}<span className="text-sm text-faint">/100</span></div>
              </div>
              <span className={`rounded-lg px-3 py-1.5 text-sm font-bold uppercase ring-1 ${leanBg(s.lean)}`}>
                {s.lean}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Helix Brief — auto-generated analyst summary */}
      {data?.briefing && (
        <div className="glossy rounded-2xl p-4">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/15 text-primary">
              <Radar size={13} />
            </span>
            <h2 className="text-sm font-semibold text-ink">Helix Brief</h2>
            <span className="ml-auto text-2xs text-faint">generated from live data</span>
          </div>
          <p className="text-sm leading-relaxed text-muted">{data.briefing}</p>
        </div>
      )}

      {/* Hidden signals — what others miss */}
      {(data?.hidden?.length ?? 0) > 0 && (
        <div className="glossy rounded-2xl p-4">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-accent/15 text-accent">
              <Zap size={13} />
            </span>
            <h2 className="text-sm font-semibold text-ink">Hidden signals</h2>
            <span className="ml-auto text-2xs text-faint">patterns the headline feed won&apos;t show</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {data!.hidden.map((h) => (
              <div
                key={h.key}
                className={`rounded-xl border p-3 ${
                  h.tone === "bullish"
                    ? "border-up/30 bg-up/[0.06]"
                    : h.tone === "bearish"
                      ? "border-down/30 bg-down/[0.06]"
                      : "border-accent/30 bg-accent/[0.06]"
                }`}
              >
                <div className={`mb-1 flex items-center gap-1.5 text-xs font-bold ${
                  h.tone === "bullish" ? "text-up" : h.tone === "bearish" ? "text-down" : "text-accent"
                }`}>
                  {directionArrow(h.tone)} {h.title}
                </div>
                <p className="text-2xs leading-relaxed text-muted">{h.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart + analytics */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Price chart — candles with volume + moving averages */}
        <div className="glossy rounded-2xl p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">
              Price action · {data?.kind === "crypto" ? "hourly" : "daily"} candles
            </h2>
            {q && <span className={`tnum text-2xs font-semibold ${dirClass(q.changePct)}`}>{pct(q.changePct)}</span>}
          </div>
          {q?.candles && q.candles.length > 5 ? (
            <CandleChart candles={q.candles} height={300} />
          ) : q && q.spark.length > 1 ? (
            <AnimatedArea data={q.spark} height={220} color={up ? "#26A69A" : "#EF5350"} />
          ) : (
            <div className="grid h-[220px] place-items-center text-sm text-faint">
              {loading ? "Loading…" : "No price data"}
            </div>
          )}
        </div>

        {/* Right rail: trade ticket + analytics */}
        <div className="flex min-w-0 flex-col gap-4">
        <TradeTicket symbol={symbol} name={data?.name ?? symbol} kind={data?.kind ?? "equity"} price={q?.price ?? null} />
        <div className="glossy flex flex-col gap-4 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink">Analytics</h2>
          {s ? (
            <>
              <div className="space-y-2.5">
                <Bar label="Momentum" value={s.breakdown.momentum} />
                <Bar label="Volume" value={s.breakdown.volume} />
                <Bar label="News sentiment" value={s.breakdown.sentiment} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Volume vs avg" value={q?.volumeRatio != null ? `${(q.volumeRatio / 100).toFixed(1)}×` : "—"} />
                <Stat label="Headlines" value={String(news.length)} />
                <Stat label="Bullish" value={String(bull)} tint="text-up" />
                <Stat label="Bearish" value={String(bear)} tint="text-down" />
              </div>
              {data?.indicators && (
                <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
                  <Stat
                    label="RSI (14)"
                    value={data.indicators.rsi14 != null ? String(data.indicators.rsi14) : "—"}
                    tint={
                      data.indicators.rsi14 != null && data.indicators.rsi14 >= 70
                        ? "text-down"
                        : data.indicators.rsi14 != null && data.indicators.rsi14 <= 30
                          ? "text-up"
                          : "text-ink"
                    }
                  />
                  <Stat
                    label="Trend"
                    value={data.indicators.trend}
                    tint={data.indicators.trend === "uptrend" ? "text-up" : data.indicators.trend === "downtrend" ? "text-down" : "text-muted"}
                  />
                  <Stat label="Volatility / bar" value={`${data.indicators.volatilityPct.toFixed(1)}%`} />
                  <Stat label="Range position" value={`${data.indicators.rangePos}%`} />
                  <Stat
                    label="Streak"
                    value={`${Math.abs(data.indicators.streak)} bar${Math.abs(data.indicators.streak) === 1 ? "" : "s"} ${data.indicators.streak >= 0 ? "up" : "down"}`}
                    tint={data.indicators.streak >= 0 ? "text-up" : "text-down"}
                  />
                  <Stat label="Momentum z" value={`${data.indicators.momentumZ > 0 ? "+" : ""}${data.indicators.momentumZ}`} />
                </div>
              )}
              {s.drivers.length > 0 && (
                <ul className="space-y-1 border-t border-border/60 pt-2">
                  {s.drivers.map((d, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-2xs text-muted">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                      {d}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="text-sm text-faint">{loading ? "Loading…" : "No analytics yet"}</div>
          )}
        </div>
        </div>
      </div>

      {/* Price scenario — the projection cone */}
      {data?.projection && q && (
        <div className="glossy rounded-2xl p-5">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink">Price scenario · next {data.projection.steps} bars</h2>
            <span
              className={`rounded px-2 py-0.5 text-2xs font-bold ring-1 ${
                data.projection.expectedMovePct >= 0 ? "bg-up/15 text-up ring-up/30" : "bg-down/15 text-down ring-down/30"
              }`}
            >
              {data.projection.expectedMovePct >= 0 ? "▲" : "▼"} {Math.abs(data.projection.expectedMovePct).toFixed(1)}% median path
            </span>
            <span className="ml-auto text-2xs text-faint">80% volatility cone · not a forecast guarantee</span>
          </div>

          <div className="mt-2 grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <ProjectionChart history={q.spark} projection={data.projection} />
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Prob. of upside" value={`${data.projection.upProbability}%`} tint={data.projection.upProbability >= 50 ? "text-up" : "text-down"} />
                <Stat label="Confidence" value={data.projection.confidence} tint="text-accent" />
                <Stat label="Cone high" value={usd(data.projection.upper[data.projection.steps])} tint="text-up" />
                <Stat label="Cone low" value={usd(data.projection.lower[data.projection.steps])} tint="text-down" />
              </div>
              <div>
                <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-faint">What drives this path</div>
                <ul className="space-y-1">
                  {data.projection.driftDrivers.map((d, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-2xs text-muted">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Catalysts */}
      {topCatalysts.length > 0 && (
        <div className="glossy rounded-2xl p-4">
          <div className="mb-2 flex items-center gap-2">
            <Zap size={15} className="text-accent" />
            <h2 className="text-sm font-semibold text-ink">Active catalysts for {symbol}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {topCatalysts.map((c) => (
              <span
                key={c.label}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${sentimentBg(c.dir)}`}
              >
                {directionArrow(c.dir)} {c.label}
                <span className="ml-1 rounded bg-black/20 px-1 text-2xs">{c.n}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* News */}
      <div className="glossy rounded-2xl">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <Newspaper size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-ink">Latest {symbol} news &amp; catalysts</h2>
          <span className="ml-auto rounded-full bg-elevated px-2 py-0.5 text-2xs text-muted">{news.length}</span>
        </div>
        <ol className="divide-y divide-border/60">
          {loading && news.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-faint">Loading news…</li>
          )}
          {!loading && news.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-faint">No recent stories found for {symbol}.</li>
          )}
          {news.map((n) => (
            <li key={n.id} className="px-4 py-3 transition-colors hover:bg-elevated/30">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                {n.breaking && (
                  <span className="rounded bg-down px-1.5 py-0.5 text-2xs font-bold uppercase text-white">Breaking</span>
                )}
                {n.catalyst && (
                  <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-bold ring-1 ${sentimentBg(n.catalyst.direction)}`}>
                    <Zap size={10} /> {directionArrow(n.catalyst.direction)} {n.catalyst.label}
                  </span>
                )}
                <span className="rounded bg-elevated px-1.5 py-0.5 text-2xs text-muted">{CATEGORY_LABEL[n.category]}</span>
                <span className="ml-auto text-2xs text-faint">{relTime(n.publishedAt)}</span>
              </div>
              <a
                href={n.url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start gap-1.5 text-sm font-medium leading-snug text-ink hover:text-primary"
              >
                <span>{n.title}</span>
                <External size={12} className="mt-0.5 shrink-0 text-faint group-hover:text-primary" />
              </a>
              {n.summary && <p className="mt-1 line-clamp-2 text-xs text-muted">{n.summary}</p>}
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-2xs text-faint">{n.source}</span>
                {n.catalyst && (
                  <button
                    onClick={() => toggleWhy(n.id)}
                    className="ml-auto flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-2xs font-medium text-accent hover:bg-accent/20"
                  >
                    Why it moves <span className={openWhy.has(n.id) ? "rotate-90" : ""}>›</span>
                  </button>
                )}
              </div>
              {n.catalyst && openWhy.has(n.id) && (
                <div className="mt-2 animate-fade-up rounded-lg border border-accent/20 bg-accent/[0.06] p-2.5">
                  <div className="mb-1 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-accent">
                    <Zap size={11} /> {n.catalyst.label} · typical impact {n.catalyst.strength}/100
                  </div>
                  <p className="text-xs leading-relaxed text-muted">{n.catalyst.why}</p>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>

      <p className="rounded-lg border border-border bg-surface/50 px-3 py-2 text-2xs leading-relaxed text-faint">
        <span className="font-semibold text-muted">Not financial advice.</span> Analytics are computed
        from public price, volume and news data using transparent heuristics — not a recommendation to
        buy or sell {symbol}.
      </p>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  const pos = value >= 0;
  const width = Math.min(50, Math.abs(value) / 2);
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-2xs">
        <span className="text-faint">{label}</span>
        <span className={`tnum ${pos ? "text-up" : "text-down"}`}>{value > 0 ? "+" : ""}{value}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-border">
        <span className="absolute left-1/2 top-0 h-full w-px bg-faint/40" />
        <span
          className={`absolute top-0 h-full rounded-full ${pos ? "bg-up" : "bg-down"}`}
          style={{ left: pos ? "50%" : `${50 - width}%`, width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, tint = "text-ink" }: { label: string; value: string; tint?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-base/40 px-2.5 py-2">
      <div className="text-2xs text-faint">{label}</div>
      <div className={`font-mono text-sm font-semibold ${tint}`}>{value}</div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, ColorType, type IChartApi } from "lightweight-charts";
import { candlesFor, SYMBOLS } from "@/lib/mockData";
import { num, pct } from "@/lib/format";
import { Delta } from "./Delta";
import { Radar } from "./icons";
import { radarLink } from "@/lib/radar/symbolLink";

const TIMEFRAMES = ["1D", "1W", "1M", "3M", "6M", "1Y"] as const;
type TF = (typeof TIMEFRAMES)[number];
const TF_BARS: Record<TF, number> = { "1D": 24, "1W": 35, "1M": 22, "3M": 66, "6M": 130, "1Y": 180 };

export function PriceChart({ ticker }: { ticker: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [tf, setTf] = useState<TF>("6M");
  const [hover, setHover] = useState<{ o: number; h: number; l: number; c: number } | null>(null);

  const sym = SYMBOLS.find((s) => s.ticker === ticker)!;
  const candles = useMemo(() => candlesFor(ticker, TF_BARS[tf]), [ticker, tf]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94A3B8",
        fontFamily: "var(--font-fira-code), monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(35,48,74,0.4)" },
        horzLines: { color: "rgba(35,48,74,0.4)" },
      },
      rightPriceScale: { borderColor: "#23304A" },
      timeScale: { borderColor: "#23304A", rightOffset: 4, fixLeftEdge: true },
      crosshair: {
        mode: 1,
        vertLine: { color: "#3B82F6", width: 1, style: 2, labelBackgroundColor: "#1E40AF" },
        horzLine: { color: "#3B82F6", width: 1, style: 2, labelBackgroundColor: "#1E40AF" },
      },
      width: el.clientWidth,
      height: 360,
    });
    chartRef.current = chart;

    // Bullish filled / bearish hollow-ish via border — colorblind-safe per skill guidance
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#26A69A",
      downColor: "#EF5350",
      borderUpColor: "#26A69A",
      borderDownColor: "#EF5350",
      wickUpColor: "#26A69A",
      wickDownColor: "#EF5350",
    });
    candleSeries.setData(candles as any);

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time as any,
        value: c.volume,
        color: c.close >= c.open ? "rgba(38,166,154,0.4)" : "rgba(239,83,80,0.4)",
      })),
    );

    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((p) => {
      const d = p.seriesData.get(candleSeries) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      if (d) setHover({ o: d.open, h: d.high, l: d.low, c: d.close });
      else setHover(null);
    });

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) chart.applyOptions({ width: e.contentRect.width });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [candles]);

  const last = candles[candles.length - 1];
  const first = candles[0];
  const periodChange = last && first ? ((last.close - first.open) / first.open) * 100 : 0;
  const ohlc = hover ?? (last ? { o: last.open, h: last.high, l: last.low, c: last.close } : null);

  return (
    <section className="glossy rounded-2xl" aria-label={`${ticker} price chart`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-mono text-lg font-semibold text-ink">{ticker}</h2>
          <span className="text-sm text-muted">{sym.name}</span>
          <span className="tnum font-mono text-lg font-semibold text-ink">{num(sym.last)}</span>
          <Delta value={sym.changePct} size="md" />
        </div>
        <div className="flex items-center gap-3">
          <a
            href={radarLink(ticker)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-elevated/60 px-2.5 py-1.5 text-2xs font-medium text-muted transition-colors hover:border-primary/50 hover:text-ink"
          >
            <Radar size={13} />
            News &amp; analysis
          </a>
          {ohlc && (
            <div className="hidden items-center gap-2 font-mono text-2xs text-muted md:flex tnum" aria-live="polite">
              <span>O <span className="text-ink">{num(ohlc.o)}</span></span>
              <span>H <span className="text-up">{num(ohlc.h)}</span></span>
              <span>L <span className="text-down">{num(ohlc.l)}</span></span>
              <span>C <span className="text-ink">{num(ohlc.c)}</span></span>
            </div>
          )}
          <div role="tablist" aria-label="Timeframe" className="flex rounded-md border border-border bg-base p-0.5">
            {TIMEFRAMES.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tf === t}
                onClick={() => setTf(t)}
                className={`rounded px-2.5 py-1 font-mono text-2xs font-medium transition-colors ${
                  tf === t ? "bg-primary text-white" : "text-muted hover:text-ink"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="px-2 py-2">
        <div className="flex items-center justify-between px-2 pb-1 text-2xs text-faint">
          <span>
            {tf} change{" "}
            <span className={periodChange >= 0 ? "text-up" : "text-down"}>{pct(periodChange)}</span>
          </span>
          <span>Candlestick · Volume</span>
        </div>
        <div ref={containerRef} className="w-full" role="img" aria-label={`${ticker} candlestick chart, ${tf} timeframe`} />
      </div>
    </section>
  );
}

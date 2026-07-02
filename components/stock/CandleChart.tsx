"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import type { Ohlcv } from "@/lib/radar/types";
import { num } from "@/lib/format";

const UP = "#26A69A";
const DOWN = "#EF5350";
const MA_FAST = "#22D3EE"; // cyan
const MA_SLOW = "#8B5CF6"; // violet

function sma(candles: Ohlcv[], n: number) {
  const out: { time: UTCTimestamp; value: number }[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= n) sum -= candles[i - n].close;
    if (i >= n - 1) out.push({ time: candles[i].time as UTCTimestamp, value: sum / n });
  }
  return out;
}

/**
 * Full analytical candlestick chart: OHLC candles, volume histogram, MA(5) and
 * MA(20) overlays, crosshair OHLC readout, and a last-price line.
 */
export function CandleChart({ candles, height = 320 }: { candles: Ohlcv[]; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [hover, setHover] = useState<Ohlcv | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || candles.length === 0) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#A0A3C4",
        fontFamily: "var(--font-fira-code), monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(39,35,82,0.45)" },
        horzLines: { color: "rgba(39,35,82,0.45)" },
      },
      rightPriceScale: { borderColor: "#272352" },
      timeScale: { borderColor: "#272352", rightOffset: 3, timeVisible: true },
      crosshair: {
        mode: 1,
        vertLine: { color: MA_SLOW, width: 1, style: 2, labelBackgroundColor: "#5B21B6" },
        horzLine: { color: MA_SLOW, width: 1, style: 2, labelBackgroundColor: "#5B21B6" },
      },
      width: el.clientWidth,
      height,
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    candleSeries.setData(
      candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })),
    );
    // Last price line comes with the series by default; keep it subtle.
    candleSeries.applyOptions({ priceLineColor: MA_FAST, priceLineStyle: 2 });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(38,166,154,0.4)" : "rgba(239,83,80,0.4)",
      })),
    );

    const maFast = chart.addLineSeries({
      color: MA_FAST, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    maFast.setData(sma(candles, 5));
    const maSlow = chart.addLineSeries({
      color: MA_SLOW, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    maSlow.setData(sma(candles, 20));

    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((p) => {
      const d = p.seriesData.get(candleSeries) as
        | { open: number; high: number; low: number; close: number; time: number }
        | undefined;
      if (!d) return setHover(null);
      const bar = candles.find((c) => c.time === (d as any).time);
      setHover(bar ?? { time: 0, open: d.open, high: d.high, low: d.low, close: d.close, volume: 0 });
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
  }, [candles, height]);

  const last = candles[candles.length - 1];
  const bar = hover ?? last;

  return (
    <div>
      {/* legend + OHLC readout */}
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 font-mono text-2xs">
        <span className="flex items-center gap-1 text-muted">
          <span className="h-0.5 w-4 rounded" style={{ background: MA_FAST }} /> MA5
        </span>
        <span className="flex items-center gap-1 text-muted">
          <span className="h-0.5 w-4 rounded" style={{ background: MA_SLOW }} /> MA20
        </span>
        {bar && (
          <span className="tnum ml-auto flex items-center gap-2 text-muted" aria-live="polite">
            <span>O <span className="text-ink">{num(bar.open)}</span></span>
            <span>H <span className="text-up">{num(bar.high)}</span></span>
            <span>L <span className="text-down">{num(bar.low)}</span></span>
            <span>C <span className={bar.close >= bar.open ? "text-up" : "text-down"}>{num(bar.close)}</span></span>
            {bar.volume > 0 && (
              <span className="hidden sm:inline">
                V <span className="text-ink">{Intl.NumberFormat("en-US", { notation: "compact" }).format(bar.volume)}</span>
              </span>
            )}
          </span>
        )}
      </div>
      <div ref={containerRef} className="w-full" role="img" aria-label="Candlestick chart with volume and moving averages" />
    </div>
  );
}

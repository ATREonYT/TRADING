"use client";

import { useId } from "react";

// Decorative candlestick chart (pure SVG) for marketing surfaces. Derives OHLC
// deterministically from a close path and animates the candles rising in.
export function MiniCandles({
  data,
  width = 520,
  height = 200,
  className = "",
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const bars = data.map((close, i) => {
    const open = i === 0 ? close * 0.995 : data[i - 1];
    const wick = (Math.abs(Math.sin(i * 2.3)) * 0.008 + 0.003) * close;
    return {
      open,
      close,
      high: Math.max(open, close) + wick,
      low: Math.min(open, close) - wick,
      up: close >= open,
    };
  });

  const min = Math.min(...bars.map((b) => b.low));
  const max = Math.max(...bars.map((b) => b.high));
  const range = max - min || 1;
  const pad = 6;
  const y = (v: number) => pad + (1 - (v - min) / range) * (height - pad * 2);
  const slot = (width - pad * 2) / bars.length;
  const bw = Math.max(3, slot * 0.55);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`w-full ${className}`} preserveAspectRatio="none" aria-hidden="true">
      {bars.map((b, i) => {
        const cx = pad + i * slot + slot / 2;
        const color = b.up ? "#26A69A" : "#EF5350";
        const top = y(Math.max(b.open, b.close));
        const bot = y(Math.min(b.open, b.close));
        return (
          <g key={i} style={{ animation: `rise-${uid} 0.5s ease-out ${i * 28}ms both` }}>
            <line x1={cx} x2={cx} y1={y(b.high)} y2={y(b.low)} stroke={color} strokeWidth="1.2" />
            <rect
              x={cx - bw / 2}
              y={top}
              width={bw}
              height={Math.max(1.5, bot - top)}
              rx="1"
              fill={color}
              fillOpacity={b.up ? 1 : 0.9}
            />
          </g>
        );
      })}
      <style>{`@keyframes rise-${uid} { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </svg>
  );
}

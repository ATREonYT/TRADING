"use client";

import { useEffect, useState } from "react";
import type { NewsItem, RadarPayload } from "@/lib/radar/types";

// A market-mood gauge computed live from the news feed: the share of directional
// headlines that are bullish, mapped to a 0–100 needle (Fear ↔ Greed style).
export function SentimentGauge() {
  const [score, setScore] = useState<number | null>(null);
  const [counts, setCounts] = useState({ bull: 0, bear: 0 });

  useEffect(() => {
    let active = true;
    fetch("/api/radar/news", { cache: "no-store" })
      .then((r) => r.json() as Promise<RadarPayload<NewsItem>>)
      .then((d) => {
        if (!active) return;
        let bull = 0;
        let bear = 0;
        for (const n of d.items) {
          if (n.sentiment === "bullish") bull++;
          else if (n.sentiment === "bearish") bear++;
        }
        const total = bull + bear;
        setCounts({ bull, bear });
        setScore(total ? Math.round((bull / total) * 100) : 50);
      })
      .catch(() => setScore(50));
    return () => {
      active = false;
    };
  }, []);

  const value = score ?? 50;
  const angle = -90 + (value / 100) * 180; // -90 (bearish) .. +90 (bullish)
  const label =
    value >= 70 ? "Greed" : value >= 55 ? "Bullish" : value >= 45 ? "Neutral" : value >= 30 ? "Bearish" : "Fear";
  const color = value >= 55 ? "#26A69A" : value >= 45 ? "#F59E0B" : "#EF5350";

  // Semicircle arc geometry
  const cx = 100;
  const cy = 100;
  const r = 78;

  return (
    <div className="glossy flex h-full flex-col items-center justify-center rounded-2xl p-6">
      <div className="mb-1 self-start text-2xs font-semibold uppercase tracking-widest text-accent">
        Market mood
      </div>
      <svg viewBox="0 0 200 118" className="w-full max-w-[280px]" role="img" aria-label={`Market sentiment: ${label}`}>
        <defs>
          <linearGradient id="gaugeArc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#EF5350" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#26A69A" />
          </linearGradient>
        </defs>
        {/* track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#272352"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* colored arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="url(#gaugeArc)"
          strokeWidth="14"
          strokeLinecap="round"
          style={{
            strokeDasharray: Math.PI * r,
            strokeDashoffset: Math.PI * r * (1 - value / 100),
            transition: "stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)",
          }}
        />
        {/* needle */}
        <g
          style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transition: "transform 1.4s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <line x1={cx} y1={cy} x2={cx} y2={cy - r + 10} stroke={color} strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r="6" fill={color} />
      </svg>
      <div className="-mt-2 text-center">
        <div className="font-mono text-3xl font-bold" style={{ color }}>
          {score === null ? "—" : value}
        </div>
        <div className="text-sm font-semibold" style={{ color }}>
          {label}
        </div>
        <div className="mt-1 text-2xs text-faint">
          {counts.bull} bullish · {counts.bear} bearish headlines
        </div>
      </div>
    </div>
  );
}

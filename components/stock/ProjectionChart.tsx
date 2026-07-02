"use client";

import { useId } from "react";
import type { Projection } from "@/lib/radar/analytics";

// History line flowing into a volatility cone: shaded 80% band, dashed median
// path. The visual signature of the "price scenario" feature.
export function ProjectionChart({
  history,
  projection,
  width = 640,
  height = 240,
}: {
  history: number[];
  projection: Projection;
  width?: number;
  height?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const hist = history.slice(-24);
  const { median, upper, lower } = projection;

  const all = [...hist, ...upper, ...lower];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const pad = 8;
  const n = hist.length + median.length - 1; // projection[0] == last history point
  const x = (i: number) => pad + (i / (n - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / range) * (height - pad * 2);

  const histPath = hist.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const projX = (t: number) => x(hist.length - 1 + t);

  const medianPath = median
    .map((v, t) => `${t === 0 ? "M" : "L"}${projX(t).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const conePath =
    upper.map((v, t) => `${t === 0 ? "M" : "L"}${projX(t).toFixed(1)},${y(v).toFixed(1)}`).join(" ") +
    " " +
    [...lower].reverse().map((v, i) => `L${projX(lower.length - 1 - i).toFixed(1)},${y(v).toFixed(1)}`).join(" ") +
    " Z";

  const up = projection.expectedMovePct >= 0;
  const color = up ? "#26A69A" : "#EF5350";
  const splitX = projX(0);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`cone-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* now divider */}
      <line x1={splitX} y1={pad} x2={splitX} y2={height - pad} stroke="#272352" strokeWidth="1" strokeDasharray="3 4" />

      {/* history */}
      <path d={histPath} fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* cone + median */}
      <path d={conePath} fill={`url(#cone-${uid})`} stroke={color} strokeOpacity="0.35" strokeWidth="1" />
      <path
        d={medianPath}
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeDasharray="6 5"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ strokeDashoffset: 400, animation: `proj-${uid} 1.4s cubic-bezier(0.22,1,0.36,1) forwards` }}
      />
      <circle cx={splitX} cy={y(median[0])} r="4" fill="#F8FAFC" />
      <circle cx={projX(median.length - 1)} cy={y(median[median.length - 1])} r="4" fill={color} />

      {/* band edge labels */}
      <text x={projX(upper.length - 1) - 4} y={y(upper[upper.length - 1]) - 6} textAnchor="end" fontSize="11" fill="#94A3B8" fontFamily="monospace">
        {upper[upper.length - 1].toFixed(2)}
      </text>
      <text x={projX(lower.length - 1) - 4} y={y(lower[lower.length - 1]) + 14} textAnchor="end" fontSize="11" fill="#94A3B8" fontFamily="monospace">
        {lower[lower.length - 1].toFixed(2)}
      </text>

      <style>{`@keyframes proj-${uid} { to { stroke-dashoffset: 0; } }`}</style>
    </svg>
  );
}

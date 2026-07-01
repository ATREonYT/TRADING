"use client";

import { useId } from "react";

/**
 * Premium animated area/line chart (pure SVG). The line "draws" itself on mount
 * via stroke-dashoffset and the fill fades in — no chart library.
 */
export function AnimatedArea({
  data,
  width = 520,
  height = 200,
  color = "#26A69A",
  className = "",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 6;
  const stepX = (width - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / range);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height - pad} L${pts[0][0].toFixed(1)},${height - pad} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`w-full ${className}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#fill-${uid})`} style={{ animation: `areaIn-${uid} 1.2s ease-out 0.3s both` }} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 2000,
          strokeDashoffset: 2000,
          animation: `draw-${uid} 1.6s cubic-bezier(0.22,1,0.36,1) forwards`,
        }}
      />
      <circle cx={last[0]} cy={last[1]} r={4} fill={color} style={{ animation: `areaIn-${uid} 0.4s ease 1.6s both` }} />
      <circle cx={last[0]} cy={last[1]} r={4} fill={color} className="animate-ping" style={{ transformOrigin: `${last[0]}px ${last[1]}px` }} />
      <style>{`
        @keyframes draw-${uid} { to { stroke-dashoffset: 0; } }
        @keyframes areaIn-${uid} { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </svg>
  );
}

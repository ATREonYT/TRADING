"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EQUITY_CURVE } from "@/lib/mockData";
import { compactUsd, usd, pct } from "@/lib/format";
import { Delta } from "./Delta";

const data = EQUITY_CURVE;
const start = data[0].value;
const end = data[data.length - 1].value;
const changePct = ((end - start) / start) * 100;

function fmtMonth(t: string) {
  return new Date(t + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

function CurveTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-overlay px-3 py-2 shadow-card">
      <div className="text-2xs text-muted">
        {new Date(p.time + "T00:00:00Z").toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
        })}
      </div>
      <div className="tnum font-mono text-sm font-semibold text-ink">{usd(p.value)}</div>
    </div>
  );
}

export function EquityCurveCard() {
  return (
    <section className="glossy rounded-2xl" aria-label="Equity curve">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Portfolio Value</h2>
          <p className="text-2xs text-faint">Last 120 sessions · NAV</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="tnum font-mono text-base font-semibold text-ink">{compactUsd(end)}</span>
          <Delta value={changePct} size="md" />
        </div>
      </div>
      <div className="h-[240px] px-2 py-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="navFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(35,48,74,0.5)" vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={fmtMonth}
              minTickGap={40}
              tick={{ fill: "#64748B", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#23304A" }}
            />
            <YAxis
              orientation="right"
              tickFormatter={(v) => compactUsd(v)}
              tick={{ fill: "#64748B", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={52}
              domain={["dataMin - 5000", "dataMax + 5000"]}
            />
            <Tooltip content={<CurveTooltip />} cursor={{ stroke: "#3B82F6", strokeDasharray: "3 3" }} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3B82F6"
              strokeWidth={2}
              fill="url(#navFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

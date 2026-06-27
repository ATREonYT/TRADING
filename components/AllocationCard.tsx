"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ALLOCATION } from "@/lib/mockData";
import { compactUsd, num } from "@/lib/format";

// Distinct hues (not red/green — those are reserved for P&L semantics)
const COLORS = ["#3B82F6", "#8B5CF6", "#06B6D4", "#F59E0B", "#EC4899", "#14B8A6"];

function AllocTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-overlay px-3 py-2 shadow-card">
      <div className="font-mono text-sm font-semibold text-ink">{p.name}</div>
      <div className="tnum text-2xs text-muted">
        {compactUsd(p.value)} · {num(p.weight, 1)}%
      </div>
    </div>
  );
}

export function AllocationCard() {
  return (
    <section className="rounded-xl border border-border bg-surface shadow-card" aria-label="Portfolio allocation">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Allocation</h2>
        <p className="text-2xs text-faint">By market value</p>
      </div>
      <div className="flex items-center gap-2 p-4">
        <div className="h-[150px] w-[150px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={ALLOCATION}
                dataKey="value"
                nameKey="name"
                innerRadius={44}
                outerRadius={70}
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
              >
                {ALLOCATION.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<AllocTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 space-y-1.5">
          {ALLOCATION.map((a, i) => (
            <li key={a.name} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: COLORS[i % COLORS.length] }}
                aria-hidden="true"
              />
              <span className="font-mono text-ink">{a.name}</span>
              <span className="tnum ml-auto text-muted">{num(a.weight, 1)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

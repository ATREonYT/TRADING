"use client";

import { useState } from "react";
import { POSITIONS, positionMetrics, type Position } from "@/lib/mockData";
import { usd, num, signedUsd, compactUsd } from "@/lib/format";
import { Sort } from "./icons";

type Row = Position & {
  marketValue: number;
  pnl: number;
  pnlPct: number;
};

const rows: Row[] = POSITIONS.map((p) => {
  const m = positionMetrics(p);
  return { ...p, marketValue: m.marketValue, pnl: m.pnl, pnlPct: m.pnlPct };
});

type Col = {
  key: keyof Row;
  label: string;
  align: "left" | "right";
  render: (r: Row) => React.ReactNode;
  numeric?: boolean;
};

const columns: Col[] = [
  { key: "ticker", label: "Symbol", align: "left", render: (r) => (
    <div>
      <div className="font-mono font-semibold text-ink">{r.ticker}</div>
      <div className="text-2xs text-faint">{r.name}</div>
    </div>
  )},
  { key: "qty", label: "Qty", align: "right", numeric: true, render: (r) => <span className="tnum">{r.qty}</span> },
  { key: "avgCost", label: "Avg Cost", align: "right", numeric: true, render: (r) => <span className="tnum">{num(r.avgCost)}</span> },
  { key: "last", label: "Last", align: "right", numeric: true, render: (r) => <span className="tnum text-ink">{num(r.last)}</span> },
  { key: "marketValue", label: "Mkt Value", align: "right", numeric: true, render: (r) => <span className="tnum">{compactUsd(r.marketValue)}</span> },
  { key: "weight", label: "Weight", align: "right", numeric: true, render: (r) => <span className="tnum text-muted">{num(r.weight, 1)}%</span> },
  { key: "pnl", label: "Open P&L", align: "right", numeric: true, render: (r) => (
    <div className="flex flex-col items-end">
      <span className={`tnum font-medium ${r.pnl >= 0 ? "text-up" : "text-down"}`}>{signedUsd(r.pnl)}</span>
      <span className={`tnum text-2xs ${r.pnl >= 0 ? "text-up/80" : "text-down/80"}`}>
        {r.pnlPct >= 0 ? "+" : ""}{num(r.pnlPct)}%
      </span>
    </div>
  )},
];

export function PositionsTable() {
  const [sortKey, setSortKey] = useState<keyof Row>("marketValue");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv));
    return dir === "asc" ? cmp : -cmp;
  });

  const onSort = (key: keyof Row) => {
    if (key === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setDir("desc"); }
  };

  const totals = rows.reduce(
    (a, r) => ({ mv: a.mv + r.marketValue, pnl: a.pnl + r.pnl }),
    { mv: 0, pnl: 0 },
  );

  return (
    <section className="rounded-xl border border-border bg-surface shadow-card" aria-label="Open positions">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Open Positions</h2>
        <span className="text-2xs text-faint">{rows.length} holdings</span>
      </div>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-2xs uppercase tracking-wide text-faint">
              {columns.map((c) => {
                const active = c.key === sortKey;
                return (
                  <th
                    key={String(c.key)}
                    scope="col"
                    aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
                    className={`px-4 py-2.5 font-medium ${c.align === "right" ? "text-right" : "text-left"}`}
                  >
                    <button
                      onClick={() => onSort(c.key)}
                      className={`inline-flex items-center gap-1 hover:text-ink ${
                        c.align === "right" ? "flex-row-reverse" : ""
                      } ${active ? "text-primary" : ""}`}
                    >
                      {c.label}
                      <Sort className={active ? "opacity-100" : "opacity-40"} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.ticker} className="border-b border-border/60 transition-colors hover:bg-elevated/40">
                {columns.map((c) => (
                  <td key={String(c.key)} className={`px-4 py-3 ${c.align === "right" ? "text-right" : "text-left"}`}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-sm font-medium">
              <td className="px-4 py-3 text-muted" colSpan={4}>Total</td>
              <td className="tnum px-4 py-3 text-right text-ink">{compactUsd(totals.mv)}</td>
              <td className="tnum px-4 py-3 text-right text-muted">100.0%</td>
              <td className={`tnum px-4 py-3 text-right ${totals.pnl >= 0 ? "text-up" : "text-down"}`}>
                {signedUsd(totals.pnl)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

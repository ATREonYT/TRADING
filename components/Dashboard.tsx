"use client";

import { useState } from "react";
import { Watchlist } from "./Watchlist";
import { StatCards } from "./StatCards";
import { PriceChart } from "./PriceChart";
import { EquityCurveCard } from "./EquityCurveCard";
import { AllocationCard } from "./AllocationCard";
import { SectorPnLCard } from "./SectorPnLCard";
import { PositionsTable } from "./PositionsTable";
import { Radar } from "./icons";

export function Dashboard() {
  const [selected, setSelected] = useState("NVDA");

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6">
      {/* Page header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Portfolio Dashboard</h1>
          <p className="text-2xs text-muted">
            Live price action, P&amp;L and positions · click any symbol to chart it
          </p>
        </div>
        <a
          href="/radar"
          className="flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.03]"
        >
          <Radar size={16} />
          Open Radar
        </a>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Left rail: watchlist */}
        <div className="lg:sticky lg:top-[72px] lg:h-[calc(100dvh-140px)]">
          <Watchlist selected={selected} onSelect={setSelected} />
        </div>

        {/* Main column */}
        <main className="flex min-w-0 flex-col gap-4">
          <StatCards />
          <PriceChart ticker={selected} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <EquityCurveCard />
            <AllocationCard />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <SectorPnLCard />
            <PositionsTable onSelect={setSelected} selected={selected} />
          </div>
        </main>
      </div>
    </div>
  );
}

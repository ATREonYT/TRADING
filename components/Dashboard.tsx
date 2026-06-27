"use client";

import { useState } from "react";
import { Watchlist } from "./Watchlist";
import { StatCards } from "./StatCards";
import { PriceChart } from "./PriceChart";
import { EquityCurveCard } from "./EquityCurveCard";
import { AllocationCard } from "./AllocationCard";
import { SectorPnLCard } from "./SectorPnLCard";
import { PositionsTable } from "./PositionsTable";

export function Dashboard() {
  const [selected, setSelected] = useState("NVDA");

  return (
    <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-6">
      {/* Left rail: watchlist */}
      <div className="lg:sticky lg:top-[72px] lg:h-[calc(100dvh-92px)]">
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
          <PositionsTable />
        </div>
      </main>
    </div>
  );
}

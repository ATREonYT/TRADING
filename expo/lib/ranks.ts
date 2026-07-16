/**
 * FounderFloor — revenue ranks.
 * Ranks are earned by verified monthly revenue (USD). RANKS is ascending by
 * minRevenue; rankFor() returns the highest rank a revenue figure qualifies for.
 */

import type { RankDef } from "@/lib/types";

export const RANKS: RankDef[] = [
  {
    id: 0,
    name: "Garage",
    minRevenue: 0,
    color: "#6F6A5E",
    blurb: "Building in the dark.",
  },
  {
    id: 1,
    name: "First Dollar",
    minRevenue: 1,
    color: "#9C6B30",
    blurb: "Someone paid. It counts.",
  },
  {
    id: 2,
    name: "Ramen Profitable",
    minRevenue: 1_000,
    color: "#2B8A3E",
    blurb: "Covers rent and noodles.",
  },
  {
    id: 3,
    name: "Default Alive",
    minRevenue: 10_000,
    color: "#1971C2",
    blurb: "Grows without asking permission.",
  },
  {
    id: 4,
    name: "Escape Velocity",
    minRevenue: 100_000,
    color: "#B08D2E",
    blurb: "The booth is a formality now.",
  },
];

/**
 * Highest rank whose minRevenue is <= revenue.
 * Negative or non-finite input safely resolves to the lowest rank.
 */
export function rankFor(revenue: number): RankDef {
  const rev = Number.isFinite(revenue) ? revenue : 0;
  let best = RANKS[0];
  for (const rank of RANKS) {
    if (rank.minRevenue <= rev) best = rank;
  }
  return best;
}

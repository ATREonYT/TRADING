// Deterministic showcase data for the marketing landing page. Fixed values (no
// Math.random) so server and client render identically — no hydration flicker.

export interface TapeItem {
  symbol: string;
  price: number;
  changePct: number;
}

export const TAPE: TapeItem[] = [
  { symbol: "NVDA", price: 132.41, changePct: 6.24 },
  { symbol: "AAPL", price: 229.14, changePct: 1.82 },
  { symbol: "MSFT", price: 441.6, changePct: 0.94 },
  { symbol: "TSLA", price: 214.52, changePct: -5.41 },
  { symbol: "AMD", price: 168.22, changePct: 4.11 },
  { symbol: "META", price: 578.3, changePct: 2.35 },
  { symbol: "AMZN", price: 201.7, changePct: 1.12 },
  { symbol: "GOOGL", price: 179.4, changePct: -0.68 },
  { symbol: "PLTR", price: 41.83, changePct: 8.91 },
  { symbol: "COIN", price: 248.9, changePct: 5.72 },
  { symbol: "BTC", price: 68420, changePct: 4.83 },
  { symbol: "ETH", price: 3585, changePct: 5.9 },
  { symbol: "SOL", price: 178.4, changePct: 9.34 },
  { symbol: "SMCI", price: 52.1, changePct: -3.22 },
  { symbol: "MU", price: 104.7, changePct: 3.06 },
  { symbol: "ARM", price: 148.9, changePct: 2.71 },
  { symbol: "AVGO", price: 172.5, changePct: 1.44 },
  { symbol: "NFLX", price: 702.3, changePct: -1.18 },
];

// Heatmap tiles — weighted-ish by "market cap" for tile sizing.
export interface HeatTile {
  symbol: string;
  changePct: number;
  weight: number; // 1 (small) .. 4 (large)
}

export const HEATMAP: HeatTile[] = [
  { symbol: "AAPL", changePct: 1.82, weight: 4 },
  { symbol: "NVDA", changePct: 6.24, weight: 4 },
  { symbol: "MSFT", changePct: 0.94, weight: 4 },
  { symbol: "AMZN", changePct: 1.12, weight: 3 },
  { symbol: "GOOGL", changePct: -0.68, weight: 3 },
  { symbol: "META", changePct: 2.35, weight: 3 },
  { symbol: "TSLA", changePct: -5.41, weight: 2 },
  { symbol: "AVGO", changePct: 1.44, weight: 2 },
  { symbol: "AMD", changePct: 4.11, weight: 2 },
  { symbol: "JPM", changePct: 0.51, weight: 2 },
  { symbol: "LLY", changePct: -1.02, weight: 2 },
  { symbol: "XOM", changePct: 2.9, weight: 2 },
  { symbol: "PLTR", changePct: 8.91, weight: 1 },
  { symbol: "COIN", changePct: 5.72, weight: 1 },
  { symbol: "NFLX", changePct: -1.18, weight: 1 },
  { symbol: "MU", changePct: 3.06, weight: 1 },
  { symbol: "SMCI", changePct: -3.22, weight: 1 },
  { symbol: "ARM", changePct: 2.71, weight: 1 },
  { symbol: "UBER", changePct: 1.63, weight: 1 },
  { symbol: "DIS", changePct: -0.44, weight: 1 },
  { symbol: "BA", changePct: -3.6, weight: 1 },
  { symbol: "WMT", changePct: 0.7, weight: 1 },
  { symbol: "CVX", changePct: 1.9, weight: 1 },
  { symbol: "ORCL", changePct: 2.2, weight: 1 },
];

// A smooth-ish price path for the hero terminal's animated chart.
export const HERO_PATH: number[] = [
  28, 30, 27, 33, 31, 38, 36, 42, 40, 47, 44, 51, 55, 52, 60, 58, 66, 63, 72, 70, 79, 84, 81, 90,
];

// The worked example the "Anatomy of a Catalyst" section animates through.
export const CATALYST_EXAMPLE = {
  headline: "Nvidia surges to record high as AI chip demand beats estimates and it raises guidance",
  symbol: "NVDA",
  steps: [
    { label: "Detected catalyst", value: "Earnings Beat + Guidance Raise", tone: "bull" as const },
    { label: "Direction", value: "Bullish ▲", tone: "bull" as const },
    { label: "Typical impact", value: "88 / 100", tone: "neutral" as const },
    { label: "Why it moves", value: "Beating forecasts and raising guidance forces upward estimate revisions and short covering — the strongest bullish setup.", tone: "neutral" as const },
  ],
};

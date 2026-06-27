// Deterministic mock market data (seeded PRNG → stable across SSR/CSR, no hydration drift)

export type Candle = {
  time: string; // yyyy-mm-dd
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Symbol = {
  ticker: string;
  name: string;
  sector: string;
  last: number;
  changePct: number;
  spark: number[];
};

export type Position = {
  ticker: string;
  name: string;
  qty: number;
  avgCost: number;
  last: number;
  weight: number; // % of portfolio
};

// --- seeded RNG (mulberry32) ---
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Build N business-day date strings ending at `end` (inclusive)
function businessDays(end: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(end + "T00:00:00Z");
  while (out.length < n) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      out.push(d.toISOString().slice(0, 10));
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
}

const END_DATE = "2026-06-26";

export function generateCandles(ticker: string, start: number, count = 180): Candle[] {
  const rand = rng(hashSeed(ticker));
  const dates = businessDays(END_DATE, count);
  const candles: Candle[] = [];
  let price = start;
  // gentle upward drift with volatility clusters
  let vol = start * 0.018;
  for (let i = 0; i < count; i++) {
    vol = Math.max(start * 0.008, vol * 0.92 + rand() * start * 0.004);
    const drift = (rand() - 0.46) * vol;
    const open = price;
    const close = Math.max(1, open + drift);
    const wick = vol * (0.5 + rand());
    const high = Math.max(open, close) + wick * rand();
    const low = Math.min(open, close) - wick * rand();
    const volume = Math.round((0.6 + rand() * 1.4) * 1_000_000 * (start / 100));
    candles.push({
      time: dates[i],
      open: round2(open),
      high: round2(high),
      low: round2(Math.max(1, low)),
      close: round2(close),
      volume,
    });
    price = close;
  }
  return candles;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function sparkline(ticker: string, base: number): number[] {
  return generateCandles(ticker, base, 32).map((c) => c.close);
}

export const BASE_PRICE: Record<string, number> = {
  NVDA: 128, AAPL: 214, MSFT: 448, TSLA: 246, AMZN: 198, META: 512, GOOGL: 178, AMD: 162,
};

export function candlesFor(ticker: string, count = 180): Candle[] {
  return generateCandles(ticker, BASE_PRICE[ticker] ?? 100, count);
}

export const SYMBOLS: Symbol[] = [
  { ticker: "NVDA", name: "NVIDIA Corp", sector: "Semiconductors", last: 0, changePct: 2.41, spark: [] },
  { ticker: "AAPL", name: "Apple Inc", sector: "Consumer Tech", last: 0, changePct: 0.83, spark: [] },
  { ticker: "MSFT", name: "Microsoft Corp", sector: "Software", last: 0, changePct: 1.12, spark: [] },
  { ticker: "TSLA", name: "Tesla Inc", sector: "Automotive", last: 0, changePct: -1.94, spark: [] },
  { ticker: "AMZN", name: "Amazon.com Inc", sector: "E-commerce", last: 0, changePct: 0.47, spark: [] },
  { ticker: "META", name: "Meta Platforms", sector: "Social Media", last: 0, changePct: -0.62, spark: [] },
  { ticker: "GOOGL", name: "Alphabet Inc", sector: "Software", last: 0, changePct: 1.78, spark: [] },
  { ticker: "AMD", name: "Adv. Micro Devices", sector: "Semiconductors", last: 0, changePct: 3.06, spark: [] },
].map((s) => {
  const candles = generateCandles(s.ticker, BASE_PRICE[s.ticker], 32);
  const last = candles[candles.length - 1].close;
  return { ...s, last, spark: candles.map((c) => c.close) };
});

export const POSITIONS: Position[] = [
  { ticker: "NVDA", name: "NVIDIA Corp", qty: 320, avgCost: 96.4 },
  { ticker: "MSFT", name: "Microsoft Corp", qty: 140, avgCost: 401.2 },
  { ticker: "AAPL", name: "Apple Inc", qty: 260, avgCost: 188.7 },
  { ticker: "AMZN", name: "Amazon.com Inc", qty: 210, avgCost: 171.5 },
  { ticker: "AMD", name: "Adv. Micro Devices", qty: 180, avgCost: 142.9 },
  { ticker: "GOOGL", name: "Alphabet Inc", qty: 150, avgCost: 159.3 },
].map((p) => {
  const sym = SYMBOLS.find((s) => s.ticker === p.ticker)!;
  return { ...p, last: sym.last, weight: 0 };
});

// compute portfolio weights
const totalMV = POSITIONS.reduce((a, p) => a + p.qty * p.last, 0);
POSITIONS.forEach((p) => (p.weight = (p.qty * p.last) / totalMV * 100));

export function positionMetrics(p: Position) {
  const marketValue = p.qty * p.last;
  const cost = p.qty * p.avgCost;
  const pnl = marketValue - cost;
  const pnlPct = (pnl / cost) * 100;
  return { marketValue, cost, pnl, pnlPct };
}

export const PORTFOLIO = (() => {
  const marketValue = POSITIONS.reduce((a, p) => a + positionMetrics(p).marketValue, 0);
  const cost = POSITIONS.reduce((a, p) => a + positionMetrics(p).cost, 0);
  const openPnl = marketValue - cost;
  const dayPnl = POSITIONS.reduce((a, p) => {
    const sym = SYMBOLS.find((s) => s.ticker === p.ticker)!;
    const prevClose = p.last / (1 + sym.changePct / 100);
    return a + p.qty * (p.last - prevClose);
  }, 0);
  return {
    equity: marketValue + 48250.0, // + cash
    cash: 48250.0,
    marketValue,
    cost,
    openPnl,
    openPnlPct: (openPnl / cost) * 100,
    dayPnl,
    dayPnlPct: (dayPnl / marketValue) * 100,
    buyingPower: 96500.0,
  };
})();

// Equity curve: 120 sessions of portfolio NAV
export const EQUITY_CURVE = (() => {
  const rand = rng(hashSeed("PORTFOLIO_NAV"));
  const dates = businessDays(END_DATE, 120);
  let nav = 392000;
  return dates.map((time) => {
    nav = nav * (1 + (rand() - 0.45) * 0.012);
    return { time, value: Math.round(nav) };
  });
})();

export const ALLOCATION = POSITIONS.map((p) => ({
  name: p.ticker,
  value: Math.round(positionMetrics(p).marketValue),
  weight: p.weight,
}));

export const SECTOR_PNL = (() => {
  const map = new Map<string, number>();
  POSITIONS.forEach((p) => {
    const sym = SYMBOLS.find((s) => s.ticker === p.ticker)!;
    const m = positionMetrics(p);
    map.set(sym.sector, (map.get(sym.sector) ?? 0) + m.pnl);
  });
  return Array.from(map.entries())
    .map(([sector, pnl]) => ({ sector, pnl: Math.round(pnl) }))
    .sort((a, b) => b.pnl - a.pnl);
})();

// Shared domain types

/** One OHLCV candle: [timestamp(ms), open, high, low, close, volume] (ccxt format) */
export type OHLCV = [number, number, number, number, number, number];

export interface Candle {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerLite {
  symbol: string;
  last: number;
  /** 24h percentage change */
  percentage: number;
  /** 24h quote (USDT) volume */
  quoteVolume: number;
}

/** A reason a signal fired, with the measured value vs threshold. */
export interface SignalReason {
  code: string;
  label: string;
  value: number;
  threshold: number;
}

export interface Signal {
  symbol: string;
  price: number;
  /** 0-100 composite strength */
  score: number;
  /** short-window price change % used for the trigger */
  windowChangePct: number;
  /** volume of trigger candle vs recent average */
  volumeSurge: number;
  /** 24h change for context */
  change24h: number;
  quoteVolume: number;
  rsi: number;
  consecutiveUp: number;
  brokeOut: boolean;
  /** Volume of the latest candle vs the one before it (acceleration). */
  volAccel: number;
  /** Top-of-book bid/ask volume ratio (>1 = more buyers). Undefined if not checked. */
  buyPressure?: number;
  /** Risk/scam heuristic: 0 (clean) .. 100 (likely trap). */
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  riskFlags: string[];
  reasons: SignalReason[];
  at: number;
}

export interface BookSnapshot {
  bestBid: number;
  bestAsk: number;
  bidVol: number;
  askVol: number;
  levels: number;
}

import type { Candle, OHLCV } from "./types.js";

export function toCandles(rows: OHLCV[]): Candle[] {
  return rows.map(([t, open, high, low, close, volume]) => ({ t, open, high, low, close, volume }));
}

/** Simple moving average of the last `period` values (excluding the final element if exclude=true). */
export function sma(values: number[], period: number): number {
  if (values.length < period || period <= 0) return NaN;
  const slice = values.slice(values.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** Percentage change between two prices. */
export function pctChange(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}

/**
 * Price change (%) over the trailing `window` candles.
 * Uses the close `window` candles ago vs the latest close.
 */
export function windowChangePct(candles: Candle[], window: number): number {
  if (candles.length < window + 1) return 0;
  const latest = candles[candles.length - 1]!.close;
  const past = candles[candles.length - 1 - window]!.close;
  return pctChange(past, latest);
}

/**
 * Volume surge: the latest candle's volume divided by the average volume of the
 * `lookback` candles immediately before it. Returns 1 when there is no surge.
 */
export function volumeSurge(candles: Candle[], lookback = 20): number {
  if (candles.length < lookback + 1) return 1;
  const latest = candles[candles.length - 1]!.volume;
  const prior = candles.slice(candles.length - 1 - lookback, candles.length - 1);
  const avg = prior.reduce((a, c) => a + c.volume, 0) / prior.length;
  if (avg <= 0) return latest > 0 ? Infinity : 1;
  return latest / avg;
}

/**
 * Volume acceleration: latest candle volume vs the previous candle's volume.
 * >1 means trading is speeding up right now (early pump tell). Returns 1 if flat.
 */
export function volumeAcceleration(candles: Candle[]): number {
  if (candles.length < 2) return 1;
  const last = candles[candles.length - 1]!.volume;
  const prev = candles[candles.length - 2]!.volume;
  if (prev <= 0) return last > 0 ? Infinity : 1;
  return last / prev;
}

/**
 * Order-book imbalance: bid volume / ask volume near top of book.
 * >1 means more resting buy interest than sell — buy-side pressure.
 */
export function orderBookImbalance(bidVol: number, askVol: number): number {
  if (askVol <= 0) return bidVol > 0 ? Infinity : 1;
  return bidVol / askVol;
}

/**
 * Window-consistent volume surge: average volume over the last `w` candles vs
 * the `w` candles before them. Lets a slow grind and a 1m spike each be judged
 * against their own timeframe. Returns 1 if there isn't enough history.
 */
export function volumeSurgeWindow(candles: Candle[], w: number): number {
  if (w < 1 || candles.length < 2 * w) return volumeSurge(candles, Math.min(20, candles.length - 1));
  const last = candles.slice(candles.length - w);
  const prev = candles.slice(candles.length - 2 * w, candles.length - w);
  const lastAvg = last.reduce((a, c) => a + c.volume, 0) / w;
  const prevAvg = prev.reduce((a, c) => a + c.volume, 0) / w;
  if (prevAvg <= 0) return lastAvg > 0 ? Infinity : 1;
  return lastAvg / prevAvg;
}

/** Count of consecutive bullish (close >= open) candles ending at the latest. */
export function consecutiveUp(candles: Candle[]): number {
  let n = 0;
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i]!.close >= candles[i]!.open) n++;
    else break;
  }
  return n;
}

/**
 * Breakout: latest close exceeds the highest high of the prior `lookback`
 * candles (i.e. a new local high), signalling expansion rather than chop.
 */
export function isBreakout(candles: Candle[], lookback = 30): boolean {
  if (candles.length < lookback + 1) return false;
  const latest = candles[candles.length - 1]!.close;
  const prior = candles.slice(candles.length - 1 - lookback, candles.length - 1);
  const priorHigh = Math.max(...prior.map((c) => c.high));
  return latest > priorHigh;
}

/** Count of consecutive bearish (close < open) candles ending at the latest. */
export function consecutiveDown(candles: Candle[]): number {
  let n = 0;
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i]!.close < candles[i]!.open) n++;
    else break;
  }
  return n;
}

/** Breakdown: latest close below the lowest low of the prior `lookback` candles. */
export function isBreakdown(candles: Candle[], lookback = 30): boolean {
  if (candles.length < lookback + 1) return false;
  const latest = candles[candles.length - 1]!.close;
  const prior = candles.slice(candles.length - 1 - lookback, candles.length - 1);
  const priorLow = Math.min(...prior.map((c) => c.low));
  return latest < priorLow;
}

/** Wilder's RSI over `period` candles. Returns 50 when insufficient data. */
export function rsi(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  // seed first average over the first `period` deltas
  const start = candles.length - period - 1;
  for (let i = start + 1; i <= start + period; i++) {
    const diff = candles[i]!.close - candles[i - 1]!.close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  // smooth across any remaining candles
  for (let i = start + period + 1; i < candles.length; i++) {
    const diff = candles[i]!.close - candles[i - 1]!.close;
    const g = diff >= 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100; // no movement → neutral
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

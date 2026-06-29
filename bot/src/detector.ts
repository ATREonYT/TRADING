import type { Candle, Signal, SignalReason, TickerLite } from "./types.js";
import type { Thresholds } from "./config.js";
import {
  consecutiveUp,
  isBreakout,
  rsi,
  volumeAcceleration,
  volumeSurge,
  windowChangePct,
} from "./indicators.js";

/** Linear 0..1 ramp of `x` between `min` and `max`. */
function ramp(x: number, min: number, max: number): number {
  if (max <= min) return x >= max ? 1 : 0;
  return Math.max(0, Math.min(1, (x - min) / (max - min)));
}

export interface EvalResult {
  signal: Signal | null;
  metrics: { change: number; surge: number; rsi: number; score: number; volAccel: number };
  /** Human-readable reason it did NOT fire, or null when it did. */
  reject: string | null;
}

const NO_METRICS = { change: 0, surge: 0, rsi: 0, score: 0, volAccel: 0 };

/**
 * Evaluate one symbol for a pump signal, returning full diagnostics.
 *
 * A signal requires BOTH a fast price move AND a volume surge over the window.
 * The composite score blends momentum, volume, breakout, and acceleration, then
 * penalises already-overbought names. Always reports why it did/didn't fire.
 */
export function evaluateDetailed(
  symbol: string,
  candles: Candle[],
  ticker: TickerLite,
  t: Thresholds,
): EvalResult {
  if (candles.length < t.windowMinutes + 2) {
    return { signal: null, metrics: NO_METRICS, reject: "insufficient candle history" };
  }
  if (ticker.quoteVolume < t.minQuoteVolume) {
    return {
      signal: null,
      metrics: NO_METRICS,
      reject: `illiquid ($${Math.round(ticker.quoteVolume).toLocaleString()} < $${t.minQuoteVolume.toLocaleString()})`,
    };
  }

  const price = candles[candles.length - 1]!.close;
  const change = windowChangePct(candles, t.windowMinutes);
  const surge = volumeSurge(candles, 20);
  const r = rsi(candles, 14);
  const conUp = consecutiveUp(candles);
  const brokeOut = isBreakout(candles, 30);
  const volAccel = volumeAcceleration(candles);

  // --- composite score (0-100) ---
  const sMomentum = ramp(change, t.minWindowChangePct, t.minWindowChangePct * 3);
  const sVolume = ramp(surge, t.minVolumeSurge, t.minVolumeSurge * 3.3);
  const sBreakout = brokeOut ? 1 : 0;
  const sAccel = ramp(conUp, 2, 6);
  const sVolAccel = ramp(volAccel, 1.2, 3);
  const overbought = ramp(r, 60, t.maxRsi);
  const raw =
    0.36 * sMomentum +
    0.32 * sVolume +
    0.14 * sBreakout +
    0.08 * sAccel +
    0.1 * sVolAccel -
    0.25 * overbought;
  const score = Math.round(Math.max(0, Math.min(1, raw)) * 100);

  const metrics = {
    change: round(change),
    surge: round(surge),
    rsi: round(r),
    score,
    volAccel: round(volAccel),
  };

  // Hard gates — report the first one that fails, with numbers.
  if (change < t.minWindowChangePct) {
    return { signal: null, metrics, reject: `move +${change.toFixed(2)}% < ${t.minWindowChangePct}%` };
  }
  if (surge < t.minVolumeSurge) {
    return { signal: null, metrics, reject: `volume ${surge.toFixed(1)}× < ${t.minVolumeSurge}×` };
  }
  if (r > t.maxRsi) {
    return { signal: null, metrics, reject: `RSI ${r.toFixed(0)} > ${t.maxRsi}` };
  }
  if (score < t.minScore) {
    return { signal: null, metrics, reject: `score ${score} < ${t.minScore}` };
  }

  const reasons: SignalReason[] = [
    {
      code: "momentum",
      label: `+${change.toFixed(2)}% in ${t.windowMinutes}m`,
      value: round(change),
      threshold: t.minWindowChangePct,
    },
    {
      code: "volume",
      label: `${surge.toFixed(1)}× avg volume`,
      value: round(surge),
      threshold: t.minVolumeSurge,
    },
  ];
  if (brokeOut) {
    reasons.push({ code: "breakout", label: "new 30m high", value: 1, threshold: 1 });
  }
  if (conUp >= 3) {
    reasons.push({ code: "acceleration", label: `${conUp} green candles`, value: conUp, threshold: 3 });
  }
  if (volAccel >= 1.5) {
    reasons.push({ code: "vol-accel", label: `volume accelerating ${volAccel.toFixed(1)}×`, value: round(volAccel), threshold: 1.5 });
  }

  const signal: Signal = {
    symbol,
    price,
    score,
    windowChangePct: round(change),
    volumeSurge: round(surge),
    change24h: round(ticker.percentage),
    quoteVolume: Math.round(ticker.quoteVolume),
    rsi: round(r),
    consecutiveUp: conUp,
    brokeOut,
    volAccel: round(volAccel),
    riskScore: 0,
    riskLevel: "low",
    riskFlags: [],
    reasons,
    at: Date.now(),
  };
  return { signal, metrics, reject: null };
}

/** Convenience wrapper: just the signal (or null). */
export function evaluate(
  symbol: string,
  candles: Candle[],
  ticker: TickerLite,
  t: Thresholds,
): Signal | null {
  return evaluateDetailed(symbol, candles, ticker, t).signal;
}

const round = (n: number) => Math.round(n * 100) / 100;

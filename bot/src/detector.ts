import type { Candle, Signal, SignalReason, TickerLite } from "./types.js";
import type { Thresholds } from "./config.js";
import {
  consecutiveUp,
  isBreakout,
  rsi,
  volumeAcceleration,
  volumeSurgeWindow,
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
  const r = rsi(candles, 14);
  const conUp = consecutiveUp(candles);
  const brokeOut = isBreakout(candles, 30);
  const volAccel = volumeAcceleration(candles);
  const overbought = ramp(r, 60, t.maxRsi);

  // Candidate windows (minutes). We evaluate each timeframe against its OWN
  // volume so quick spikes and slower grinds both qualify, then pick the best.
  const WINDOWS = [1, 2, 3, 5, 10, 15, 30, 60].filter((w) => candles.length >= w + 1);

  let best: { change: number; surge: number; win: number; score: number } | null = null;
  // Track the closest miss (highest score that failed) for diagnostics.
  let miss: { change: number; surge: number; win: number; score: number } | null = null;

  for (const w of WINDOWS) {
    const change = windowChangePct(candles, w);
    if (change <= 0) continue;
    const surge = volumeSurgeWindow(candles, w);

    const sMomentum = ramp(change, t.minWindowChangePct, t.minWindowChangePct * 3);
    const sVolume = ramp(surge, t.minVolumeSurge, t.minVolumeSurge * 3.3);
    const sBreakout = brokeOut ? 1 : 0;
    const sAccel = ramp(conUp, 2, 6);
    const sVolAccel = ramp(volAccel, 1.2, 3);
    const raw =
      0.36 * sMomentum + 0.32 * sVolume + 0.14 * sBreakout + 0.08 * sAccel + 0.1 * sVolAccel - 0.25 * overbought;
    const score = Math.round(Math.max(0, Math.min(1, raw)) * 100);
    const cand = { change, surge, win: w, score };

    const passes =
      change >= t.minWindowChangePct && surge >= t.minVolumeSurge && r <= t.maxRsi && score >= t.minScore;
    if (passes) {
      if (!best || score > best.score) best = cand;
    } else if (!miss || score > miss.score) {
      miss = cand;
    }
  }

  if (!best) {
    const m = miss ?? { change: 0, surge: 0, win: t.windowMinutes, score: 0 };
    const metrics = { change: round(m.change), surge: round(m.surge), rsi: round(r), score: m.score, volAccel: round(volAccel) };
    let reject: string;
    if (r > t.maxRsi) reject = `RSI ${r.toFixed(0)} > ${t.maxRsi}`;
    else if (m.change < t.minWindowChangePct) reject = `best move +${m.change.toFixed(2)}%/${m.win}m < ${t.minWindowChangePct}%`;
    else if (m.surge < t.minVolumeSurge) reject = `volume ${m.surge.toFixed(1)}× < ${t.minVolumeSurge}×`;
    else reject = `score ${m.score} < ${t.minScore}`;
    return { signal: null, metrics, reject };
  }

  const { change, surge, win, score } = best;
  const metrics = { change: round(change), surge: round(surge), rsi: round(r), score, volAccel: round(volAccel) };

  const reasons: SignalReason[] = [
    { code: "momentum", label: `+${change.toFixed(2)}% in ${win}m`, value: round(change), threshold: t.minWindowChangePct },
    { code: "volume", label: `${surge.toFixed(1)}× volume`, value: round(surge), threshold: t.minVolumeSurge },
  ];
  if (brokeOut) reasons.push({ code: "breakout", label: "new 30m high", value: 1, threshold: 1 });
  if (conUp >= 3) reasons.push({ code: "acceleration", label: `${conUp} green candles`, value: conUp, threshold: 3 });
  if (volAccel >= 1.5) reasons.push({ code: "vol-accel", label: `volume accelerating ${volAccel.toFixed(1)}×`, value: round(volAccel), threshold: 1.5 });

  const signal: Signal = {
    symbol,
    price,
    score,
    windowChangePct: round(change),
    windowSec: win * 60,
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

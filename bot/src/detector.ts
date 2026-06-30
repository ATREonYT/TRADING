import type { Candle, Signal, SignalReason, TickerLite } from "./types.js";
import type { Thresholds } from "./config.js";
import {
  consecutiveDown,
  consecutiveUp,
  isBreakdown,
  isBreakout,
  rsi,
  volumeAcceleration,
  volumeSurgeWindow,
  windowChangePct,
} from "./indicators.js";

export type Direction = "up" | "down";
export type DirectionMode = "pump" | "dump" | "both";

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
  mode: DirectionMode = "pump",
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
  const conDown = consecutiveDown(candles);
  const brokeUp = isBreakout(candles, 30);
  const brokeDown = isBreakdown(candles, 30);
  const volAccel = volumeAcceleration(candles);
  const dirs: Direction[] = mode === "both" ? ["up", "down"] : mode === "dump" ? ["down"] : ["up"];

  const WINDOWS = [1, 2, 3, 5, 10, 15, 30, 60].filter((w) => candles.length >= w + 1);

  type Cand = { changeSigned: number; mag: number; surge: number; win: number; score: number; dir: Direction };
  let best: Cand | null = null;
  let miss: Cand | null = null;

  for (const w of WINDOWS) {
    const changeSigned = windowChangePct(candles, w);
    const surge = volumeSurgeWindow(candles, w);
    for (const dir of dirs) {
      const mag = dir === "up" ? changeSigned : -changeSigned;
      if (mag <= 0) continue;

      const sMomentum = ramp(mag, t.minWindowChangePct, t.minWindowChangePct * 3);
      const sVolume = ramp(surge, t.minVolumeSurge, t.minVolumeSurge * 3.3);
      const sBreak = (dir === "up" ? brokeUp : brokeDown) ? 1 : 0;
      const sAccel = ramp(dir === "up" ? conUp : conDown, 2, 6);
      const sVolAccel = ramp(volAccel, 1.2, 3);
      // up: penalise overbought (late); down: penalise oversold (already crashed)
      const penalty = dir === "up" ? ramp(r, 60, t.maxRsi) : ramp(40 - r, 0, 40);
      const raw =
        0.36 * sMomentum + 0.32 * sVolume + 0.14 * sBreak + 0.08 * sAccel + 0.1 * sVolAccel - 0.25 * penalty;
      const score = Math.round(Math.max(0, Math.min(1, raw)) * 100);
      const cand: Cand = { changeSigned, mag, surge, win: w, score, dir };

      const rsiOk = dir === "up" ? r <= t.maxRsi : r >= 100 - t.maxRsi;
      const passes = mag >= t.minWindowChangePct && surge >= t.minVolumeSurge && rsiOk && score >= t.minScore;
      if (passes) {
        if (!best || score > best.score) best = cand;
      } else if (!miss || score > miss.score) {
        miss = cand;
      }
    }
  }

  if (!best) {
    const m = miss ?? { changeSigned: 0, mag: 0, surge: 0, win: t.windowMinutes, score: 0, dir: "up" as Direction };
    const metrics = { change: round(m.changeSigned), surge: round(m.surge), rsi: round(r), score: m.score, volAccel: round(volAccel) };
    let reject: string;
    if (m.mag < t.minWindowChangePct) reject = `best move ${m.changeSigned >= 0 ? "+" : ""}${m.changeSigned.toFixed(2)}%/${m.win}m`;
    else if (m.surge < t.minVolumeSurge) reject = `volume ${m.surge.toFixed(1)}× < ${t.minVolumeSurge}×`;
    else if (m.dir === "up" && r > t.maxRsi) reject = `RSI ${r.toFixed(0)} > ${t.maxRsi}`;
    else reject = `score ${m.score} < ${t.minScore}`;
    return { signal: null, metrics, reject };
  }

  const { changeSigned, mag, surge, win, score, dir } = best;
  const metrics = { change: round(changeSigned), surge: round(surge), rsi: round(r), score, volAccel: round(volAccel) };
  const conN = dir === "up" ? conUp : conDown;
  const broke = dir === "up" ? brokeUp : brokeDown;

  const reasons: SignalReason[] = [
    { code: "momentum", label: `${changeSigned >= 0 ? "+" : ""}${changeSigned.toFixed(2)}% in ${win}m`, value: round(mag), threshold: t.minWindowChangePct },
    { code: "volume", label: `${surge.toFixed(1)}× volume`, value: round(surge), threshold: t.minVolumeSurge },
  ];
  if (broke) reasons.push({ code: "breakout", label: dir === "up" ? "new 30m high" : "new 30m low", value: 1, threshold: 1 });
  if (conN >= 3) reasons.push({ code: "acceleration", label: `${conN} ${dir === "up" ? "green" : "red"} candles`, value: conN, threshold: 3 });
  if (volAccel >= 1.5) reasons.push({ code: "vol-accel", label: `volume accelerating ${volAccel.toFixed(1)}×`, value: round(volAccel), threshold: 1.5 });

  const signal: Signal = {
    symbol,
    price,
    direction: dir,
    score,
    windowChangePct: round(changeSigned),
    windowSec: win * 60,
    volumeSurge: round(surge),
    change24h: round(ticker.percentage),
    quoteVolume: Math.round(ticker.quoteVolume),
    rsi: round(r),
    consecutiveUp: conN,
    brokeOut: broke,
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
  mode: DirectionMode = "pump",
): Signal | null {
  return evaluateDetailed(symbol, candles, ticker, t, mode).signal;
}

const round = (n: number) => Math.round(n * 100) / 100;

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

/**
 * Evaluate one symbol for a pump signal.
 *
 * A signal requires BOTH a fast price move AND a volume surge over the window —
 * price alone is noise, volume alone is accumulation. The composite score blends
 * momentum, volume, breakout, and acceleration, then penalises already-overbought
 * names (high RSI = likely late to the move).
 *
 * Returns null when the candidate fails a hard gate or scores below `minScore`.
 */
export function evaluate(
  symbol: string,
  candles: Candle[],
  ticker: TickerLite,
  t: Thresholds,
): Signal | null {
  if (candles.length < t.windowMinutes + 2) return null;

  // Hard liquidity gate — never surface illiquid, easily-manipulated markets.
  if (ticker.quoteVolume < t.minQuoteVolume) return null;

  const price = candles[candles.length - 1]!.close;
  const change = windowChangePct(candles, t.windowMinutes);
  const surge = volumeSurge(candles, 20);
  const r = rsi(candles, 14);
  const conUp = consecutiveUp(candles);
  const brokeOut = isBreakout(candles, 30);
  const volAccel = volumeAcceleration(candles);

  // Hard gates: the two defining traits of a pump.
  if (change < t.minWindowChangePct) return null;
  if (surge < t.minVolumeSurge) return null;
  // Already overbought — likely chasing the top.
  if (r > t.maxRsi) return null;

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

  // --- composite score (0-100) ---
  // momentum: ramps from threshold up to 3× threshold
  const sMomentum = ramp(change, t.minWindowChangePct, t.minWindowChangePct * 3);
  // volume: ramps from threshold up to ~3.3× threshold
  const sVolume = ramp(surge, t.minVolumeSurge, t.minVolumeSurge * 3.3);
  const sBreakout = brokeOut ? 1 : 0;
  const sAccel = ramp(conUp, 2, 6);
  const sVolAccel = ramp(volAccel, 1.2, 3);
  // overbought penalty: 0 below 60 RSI, up to -1 weight near maxRsi
  const overbought = ramp(r, 60, t.maxRsi);

  const raw =
    0.36 * sMomentum +
    0.32 * sVolume +
    0.14 * sBreakout +
    0.08 * sAccel +
    0.1 * sVolAccel -
    0.25 * overbought;

  const score = Math.round(Math.max(0, Math.min(1, raw)) * 100);
  if (score < t.minScore) return null;

  return {
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
}

const round = (n: number) => Math.round(n * 100) / 100;

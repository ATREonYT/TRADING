import { test } from "node:test";
import assert from "node:assert/strict";
import type { Candle, TickerLite } from "../src/types.js";
import type { Thresholds } from "../src/config.js";
import { evaluate } from "../src/detector.js";

const T: Thresholds = {
  windowMinutes: 5,
  minWindowChangePct: 4,
  minVolumeSurge: 3,
  minQuoteVolume: 2_000_000,
  maxRsi: 100, // RSI gate disabled except where a test overrides it
  minScore: 55,
  maxRiskScore: 65,
  cooldownMinutes: 30,
};

const ticker = (over: Partial<TickerLite> = {}): TickerLite => ({
  symbol: "PUMP/USDT",
  last: 100,
  percentage: 18,
  quoteVolume: 5_000_000,
  ...over,
});

/** 50 oscillating candles (so RSI has both gains & losses) + a 5-candle pump. */
function buildSeries(stepPct: number, lastVol: number, baseVol = 100): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < 50; i++) {
    const close = i % 2 === 0 ? 100 : 99.7;
    const open = i % 2 === 0 ? 99.7 : 100;
    out.push({ t: i, open, close, high: Math.max(open, close) + 0.1, low: Math.min(open, close) - 0.1, volume: baseVol });
  }
  let price = 100;
  for (let i = 0; i < 5; i++) {
    const open = price;
    const close = price * (1 + stepPct / 100);
    out.push({
      t: 50 + i,
      open,
      close,
      high: close + 0.05,
      low: open - 0.05,
      volume: i === 4 ? lastVol : baseVol * 1.4,
    });
    price = close;
  }
  return out;
}

test("fires on a clear pump (price + volume + breakout)", () => {
  const candles = buildSeries(2.5, 1500); // ~+13% over 5m, 15× volume spike
  const sig = evaluate("PUMP/USDT", candles, ticker(), T);
  assert.ok(sig, "expected a signal");
  assert.ok(sig!.score >= T.minScore, `score ${sig!.score} >= ${T.minScore}`);
  assert.ok(sig!.windowChangePct >= 4);
  assert.ok(sig!.volumeSurge >= 3);
  assert.equal(sig!.brokeOut, true);
  const codes = sig!.reasons.map((r) => r.code);
  assert.ok(codes.includes("momentum") && codes.includes("volume"));
});

test("detects a dump (down move) in dump mode", () => {
  // mirror of the pump builder but downward
  const c: Candle[] = [];
  for (let i = 0; i < 50; i++) {
    const close = i % 2 === 0 ? 100 : 100.3;
    const open = i % 2 === 0 ? 100.3 : 100;
    c.push({ t: i, open, close, high: Math.max(open, close) + 0.1, low: Math.min(open, close) - 0.1, volume: 100 });
  }
  let price = 100;
  for (let i = 0; i < 5; i++) {
    const open = price;
    const close = price * 0.975; // -2.5% per candle
    c.push({ t: 50 + i, open, close, high: open + 0.05, low: close - 0.05, volume: i === 4 ? 1500 : 140 });
    price = close;
  }
  // pump-only mode should NOT fire on a dump
  assert.equal(evaluate("DUMP/USDT", c, ticker(), T, "pump"), null);
  // dump mode should fire, with a negative change and down direction
  const sig = evaluate("DUMP/USDT", c, ticker(), { ...T, maxRsi: 100 }, "dump");
  assert.ok(sig, "expected a dump signal");
  assert.equal(sig!.direction, "down");
  assert.ok(sig!.windowChangePct < 0, `change ${sig!.windowChangePct} should be negative`);
});

test("rejects illiquid markets below minQuoteVolume", () => {
  const candles = buildSeries(2.5, 1500);
  const sig = evaluate("MICRO/USDT", candles, ticker({ quoteVolume: 50_000 }), T);
  assert.equal(sig, null);
});

test("rejects when price move is below threshold", () => {
  const candles = buildSeries(0.4, 1500); // ~+2% only
  const sig = evaluate("SLOW/USDT", candles, ticker(), T);
  assert.equal(sig, null);
});

test("rejects when there is no volume surge", () => {
  const candles = buildSeries(2.5, 110); // big move, flat volume
  const sig = evaluate("QUIET/USDT", candles, ticker(), T);
  assert.equal(sig, null);
});

test("RSI gate rejects already-overbought moves", () => {
  const candles = buildSeries(2.5, 1500);
  const sig = evaluate("LATE/USDT", candles, ticker(), { ...T, maxRsi: 50 });
  assert.equal(sig, null);
});

test("catches a slow grind via a longer window (multi-timeframe)", () => {
  // 50 flat candles, then 16 candles grinding +0.4%/min with elevated volume.
  // A 3m window sees only ~+1.2% (below 4%), but the 15m window sees ~+6%.
  const candle = (close: number, open = close, volume = 100): Candle => ({
    t: 0, open, close, high: Math.max(open, close), low: Math.min(open, close), volume,
  });
  const c: Candle[] = [];
  for (let i = 0; i < 50; i++) c.push(candle(100, 100, 100));
  let price = 100;
  for (let i = 0; i < 16; i++) {
    const open = price;
    const close = price * 1.004;
    c.push({ t: 50 + i, open, close, high: close, low: open, volume: 300 });
    price = close;
  }
  const sig = evaluate("GRIND/USDT", c, ticker(), { ...T, minWindowChangePct: 4, minVolumeSurge: 1.5, minScore: 0 });
  assert.ok(sig, "slow grind should fire via a longer window");
  assert.ok(sig!.windowSec > 3 * 60, `winning window ${sig!.windowSec}s should exceed 3m`);
});

test("bigger move scores higher", () => {
  const small = evaluate("A/USDT", buildSeries(1.0, 600), ticker(), { ...T, minScore: 0 });
  const big = evaluate("B/USDT", buildSeries(3.0, 2000), ticker(), { ...T, minScore: 0 });
  assert.ok(small && big);
  assert.ok(big!.score >= small!.score, `big ${big!.score} >= small ${small!.score}`);
});

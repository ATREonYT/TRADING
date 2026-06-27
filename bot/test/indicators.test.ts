import { test } from "node:test";
import assert from "node:assert/strict";
import type { Candle } from "../src/types.js";
import {
  consecutiveUp,
  isBreakout,
  pctChange,
  rsi,
  sma,
  volumeSurge,
  windowChangePct,
} from "../src/indicators.js";

function candle(close: number, open = close, volume = 100, high?: number, low?: number): Candle {
  return {
    t: 0,
    open,
    close,
    high: high ?? Math.max(open, close),
    low: low ?? Math.min(open, close),
    volume,
  };
}

test("sma averages the last period", () => {
  assert.equal(sma([1, 2, 3, 4, 5], 5), 3);
  assert.equal(sma([10, 20, 30], 2), 25);
  assert.ok(Number.isNaN(sma([1], 5)));
});

test("pctChange", () => {
  assert.equal(pctChange(100, 110), 10);
  assert.equal(pctChange(100, 90), -10);
  assert.equal(pctChange(0, 5), 0);
});

test("windowChangePct uses close N candles ago", () => {
  const c = [candle(100), candle(101), candle(102), candle(103), candle(104), candle(110)];
  // window 5 => from candle[0].close(100) to last(110) = +10%
  assert.equal(windowChangePct(c, 5), 10);
});

test("volumeSurge compares latest to prior average", () => {
  const prior = Array.from({ length: 20 }, () => candle(100, 100, 100));
  const spike = candle(105, 100, 600);
  assert.equal(volumeSurge([...prior, spike], 20), 6);
});

test("volumeSurge returns 1 without enough data", () => {
  assert.equal(volumeSurge([candle(100)], 20), 1);
});

test("consecutiveUp counts trailing green candles", () => {
  const c = [candle(100, 105), candle(101, 100), candle(102, 101), candle(103, 102)];
  assert.equal(consecutiveUp(c), 3);
});

test("isBreakout detects a new local high", () => {
  const flat = Array.from({ length: 30 }, () => candle(100, 100, 100, 101, 99));
  assert.equal(isBreakout([...flat, candle(105, 100, 100, 106, 100)], 30), true);
  assert.equal(isBreakout([...flat, candle(100.5, 100, 100, 100.8, 100)], 30), false);
});

test("rsi is 100 when only gains, near 50 for flat", () => {
  const rising: Candle[] = [];
  for (let i = 0; i < 20; i++) rising.push(candle(100 + i));
  assert.equal(rsi(rising, 14), 100);

  const flat = Array.from({ length: 20 }, () => candle(100));
  const v = rsi(flat, 14);
  assert.ok(v >= 49 && v <= 51, `flat rsi ~50, got ${v}`);
});

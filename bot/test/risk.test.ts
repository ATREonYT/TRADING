import { test } from "node:test";
import assert from "node:assert/strict";
import type { BookSnapshot, Candle, TickerLite } from "../src/types.js";
import { assessRisk } from "../src/risk.js";

const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
  t: i,
  open: 1,
  close: 1,
  high: 1.01,
  low: 0.99,
  volume: 100,
}));

const ticker = (over: Partial<TickerLite> = {}): TickerLite => ({
  symbol: "X/USDT",
  last: 1,
  percentage: 10,
  quoteVolume: 5_000_000,
  ...over,
});

const goodBook: BookSnapshot = { bestBid: 0.999, bestAsk: 1.001, bidVol: 200_000, askVol: 180_000, levels: 20 };

test("liquid, tight-spread, normal move = low risk", () => {
  const r = assessRisk(candles, ticker(), goodBook, 5);
  assert.equal(r.level, "low");
  assert.ok(r.score < 35);
});

test("very low liquidity raises risk + flags it", () => {
  const r = assessRisk(candles, ticker({ quoteVolume: 80_000 }), goodBook, 5);
  assert.ok(r.score >= 30);
  assert.ok(r.flags.some((f) => /liquidity/.test(f)));
});

test("wide spread + shallow book = high risk", () => {
  const badBook: BookSnapshot = { bestBid: 0.95, bestAsk: 1.05, bidVol: 500, askVol: 500, levels: 5 };
  const r = assessRisk(candles, ticker({ quoteVolume: 120_000 }), badBook, 5);
  assert.equal(r.level, "high");
});

test("already parabolic on 24h is flagged as late", () => {
  const r = assessRisk(candles, ticker({ percentage: 120 }), goodBook, 5);
  assert.ok(r.flags.some((f) => /late|24h/.test(f)));
});

test("missing order book is not penalised (optional check)", () => {
  const withBook = assessRisk(candles, ticker(), goodBook, 5);
  const without = assessRisk(candles, ticker(), null, 5);
  assert.ok(without.score <= withBook.score + 1);
  assert.ok(!without.flags.some((f) => /unavailable/.test(f)));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Signal } from "../src/types.js";
import { SignalTracker } from "../src/tracker.js";

function signal(symbol: string, price: number, at: number): Signal {
  return {
    symbol, price, score: 70, windowChangePct: 5, windowSec: 180, volumeSurge: 4, change24h: 10,
    quoteVolume: 1_000_000, rsi: 65, consecutiveUp: 3, brokeOut: true, volAccel: 2,
    riskScore: 20, riskLevel: "low", riskFlags: [], reasons: [], at,
  };
}

test("tracks peak gain and closes after the horizon", () => {
  const t = new SignalTracker(10, 5); // 10m horizon, win = +5%
  const t0 = 1_000_000;
  t.track(signal("AAA/USDT", 100, t0), t0);

  // price rises to 110 (+10%) at 5m
  t.update(new Map([["AAA/USDT", 110]]), t0 + 5 * 60_000);
  // then falls back to 103 at 8m
  t.update(new Map([["AAA/USDT", 103]]), t0 + 8 * 60_000);

  // still open before horizon
  assert.equal(t.summary().closed, 0);
  assert.equal(t.openList(t0 + 8 * 60_000)[0]!.peakPct, 10);

  // past horizon -> closes
  t.update(new Map([["AAA/USDT", 103]]), t0 + 11 * 60_000);
  const s = t.summary();
  assert.equal(s.closed, 1);
  assert.equal(s.wins, 1); // peak +10% >= +5%
  assert.equal(s.winRate, 100);
  assert.equal(s.avgPeakPct, 10);
  assert.equal(s.avgFinalPct, 3);
});

test("a signal that never reaches the win threshold is not a win", () => {
  const t = new SignalTracker(5, 5);
  const t0 = 2_000_000;
  t.track(signal("BBB/USDT", 50, t0), t0);
  t.update(new Map([["BBB/USDT", 51]]), t0 + 6 * 60_000); // +2% peak, then closes
  const s = t.summary();
  assert.equal(s.closed, 1);
  assert.equal(s.wins, 0);
  assert.equal(s.winRate, 0);
});

test("does not double-track the same open symbol", () => {
  const t = new SignalTracker(60, 5);
  const t0 = 3_000_000;
  t.track(signal("CCC/USDT", 10, t0), t0);
  t.track(signal("CCC/USDT", 12, t0 + 1000), t0 + 1000);
  assert.equal(t.openList(t0 + 2000).length, 1);
  assert.equal(t.openList(t0 + 2000)[0]!.symbol, "CCC/USDT");
});

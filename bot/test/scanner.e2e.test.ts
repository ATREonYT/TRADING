import { test } from "node:test";
import assert from "node:assert/strict";
import type { Candle, Signal, TickerLite, BookSnapshot } from "../src/types.js";
import type { Market } from "../src/exchange.js";
import { Scanner } from "../src/scanner.js";
import { loadConfig } from "../src/config.js";

const PUMP = "PUMP/USDT";

/** 61 candles: calm oscillating base, then a sharp 4-candle pump, then a forming candle. */
function buildCandles(): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < 56; i++) {
    const close = i % 2 === 0 ? 1.0 : 0.997;
    const open = i % 2 === 0 ? 0.997 : 1.0;
    out.push({ t: i, open, close, high: Math.max(open, close) + 0.001, low: Math.min(open, close) - 0.001, volume: 100 });
  }
  let price = 1.0;
  for (let i = 56; i < 60; i++) {
    const open = price;
    const close = price * 1.02; // +2% per candle => ~+8% over 4
    out.push({ t: i, open, close, high: close + 0.002, low: open - 0.002, volume: 700 + i });
    price = close;
  }
  // forming (incomplete) candle — tiny partial volume; scanner must drop it
  out.push({ t: 60, open: price, close: price, high: price, low: price, volume: 5 });
  return out;
}

const candles = buildCandles();
const lastClosed = candles[59]!.close;

const goodBook: BookSnapshot = {
  bestBid: lastClosed * 0.9995,
  bestAsk: lastClosed * 1.0005,
  bidVol: 120_000,
  askVol: 110_000,
  levels: 20,
};

// Minimal Market stand-in (duck-typed) for offline end-to-end testing.
const mockMarket = {
  id: "mock",
  get loaded() {
    return true;
  },
  loadSymbols: async () => [PUMP],
  fetchTickers: async (): Promise<TickerLite[]> => [
    { symbol: PUMP, last: lastClosed, percentage: 14, quoteVolume: 5_000_000 },
  ],
  fetchCandles: async (): Promise<Candle[]> => candles,
  fetchBook: async (): Promise<BookSnapshot> => goodBook,
  fetchTicker: async () => null,
  hasSymbol: () => true,
  tradeUrl: () => "https://example.com/buy",
  dexScreenerUrl: () => "https://example.com/dex",
} as unknown as Market;

test("end-to-end: scanner emits and dispatches a signal for a clear pump", async () => {
  const cfg = loadConfig(); // uses loosened defaults (no env set)
  const sent: Signal[] = [];
  const scanner = new Scanner(cfg, (s) => sent.push(s), mockMarket);

  await scanner.init();
  assert.equal(scanner.stats.symbolsTracked, 1);

  const found = await scanner.scanOnce();

  assert.equal(found.length, 1, "expected exactly one signal");
  assert.equal(sent.length, 1, "onSignal should have been called");
  const sig = found[0]!;
  assert.equal(sig.symbol, PUMP);
  assert.ok(sig.windowChangePct >= cfg.thresholds.minWindowChangePct);
  assert.ok(sig.volumeSurge >= cfg.thresholds.minVolumeSurge, `surge ${sig.volumeSurge}`);
  assert.ok(sig.score >= cfg.thresholds.minScore);
  assert.equal(sig.riskLevel, "low");
  // tracker should now be following it
  assert.equal(scanner.tracker.openList(Date.now()).length, 1);
});

test("end-to-end: a calm market produces a near-miss diagnostic, no signal", async () => {
  const flat: Candle[] = Array.from({ length: 61 }, (_, i) => ({
    t: i, open: 1, close: 1.0005, high: 1.001, low: 0.999, volume: 100,
  }));
  const calmMarket = {
    ...mockMarket,
    fetchCandles: async () => flat,
    fetchTickers: async () => [{ symbol: PUMP, last: 1, percentage: 1, quoteVolume: 5_000_000 }],
  } as unknown as Market;

  const cfg = loadConfig();
  const scanner = new Scanner(cfg, () => {}, calmMarket);
  await scanner.init();
  const found = await scanner.scanOnce();

  assert.equal(found.length, 0);
  assert.ok(scanner.stats.lastNearMiss, "should record a near-miss");
  assert.match(scanner.stats.lastNearMiss!.reject, /move|volume|score|rsi/i);
});

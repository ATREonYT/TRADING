import { test } from "node:test";
import assert from "node:assert/strict";
import { Market } from "../src/exchange.js";

// Constructing a Market does not touch the network; URL building is pure.

test("spot trade URLs", () => {
  const m = new Market("mexc", "USDT", "spot");
  assert.equal(m.tradeUrl("PEPE/USDT"), "https://www.mexc.com/exchange/PEPE_USDT");
});

test("swap (futures) trade URLs strip the settle suffix", () => {
  const mexc = new Market("mexc", "USDT", "swap");
  assert.equal(mexc.tradeUrl("MANTA/USDT:USDT"), "https://futures.mexc.com/exchange/MANTA_USDT");

  const binance = new Market("binance", "USDT", "swap");
  assert.equal(binance.tradeUrl("BTC/USDT:USDT"), "https://www.binance.com/en/futures/BTCUSDT");

  const bybit = new Market("bybit", "USDT", "swap");
  assert.equal(bybit.tradeUrl("SOL/USDT:USDT"), "https://www.bybit.com/trade/usdt/SOLUSDT");
});

test("dex screener uses the base token", () => {
  const m = new Market("mexc", "USDT", "swap");
  assert.equal(m.dexScreenerUrl("MANTA/USDT:USDT"), "https://dexscreener.com/search?q=MANTA");
});

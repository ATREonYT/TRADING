import type { NewsItem, Quote } from "./types";
import { enrichArticles } from "./nlp";
import type { RawArticle } from "./rss";

// Deterministic fallback used when live sources are blocked (e.g. an offline or
// egress-restricted environment) so the UI is always demonstrable. Clearly
// flagged as `degraded` in every API response.

const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

const RAW: RawArticle[] = [
  { title: "Nvidia surges to record high as AI chip demand beats estimates", summary: "Shares of Nvidia jumped after the company reported blowout data-center revenue and raised guidance.", url: "#", source: "Demo · Markets", publishedAt: minsAgo(12) },
  { title: "Federal Reserve signals rate cut could come sooner on cooling inflation", summary: "Officials struck a dovish tone as CPI data came in below expectations, boosting risk assets.", url: "#", source: "Demo · Macro", publishedAt: minsAgo(40) },
  { title: "Bitcoin rallies past resistance as ETF inflows hit weekly record", summary: "Crypto markets climbed broadly with Ethereum and Solana following bitcoin higher.", url: "#", source: "Demo · Crypto", publishedAt: minsAgo(22) },
  { title: "Tesla tumbles after Q3 deliveries miss and margin warning", summary: "The EV maker cut its outlook, sending shares sharply lower in premarket trade.", url: "#", source: "Demo · Markets", publishedAt: minsAgo(65) },
  { title: "Oil jumps 4% as OPEC extends production cuts amid supply fears", summary: "Crude prices surged on tighter supply expectations and rising geopolitical tension.", url: "#", source: "Demo · Commodities", publishedAt: minsAgo(85) },
  { title: "Apple unveils new AI features, analysts upgrade on services growth", summary: "Several brokers raised price targets citing a strong upgrade cycle and buyback.", url: "#", source: "Demo · Tech", publishedAt: minsAgo(120) },
  { title: "Palantir soars on new government contract and raised guidance", summary: "The data firm reported record commercial bookings and beat on earnings.", url: "#", source: "Demo · Markets", publishedAt: minsAgo(30) },
  { title: "Coinbase gains as crypto trading volume spikes to yearly high", summary: "The exchange benefits from renewed retail interest and rising token prices.", url: "#", source: "Demo · Crypto", publishedAt: minsAgo(52) },
  { title: "Boeing falls on new production halt and regulatory probe", summary: "Shares slid after regulators opened an investigation into manufacturing quality.", url: "#", source: "Demo · Markets", publishedAt: minsAgo(140) },
  { title: "AMD climbs on strong data-center guidance and partnership win", summary: "The chipmaker raised its outlook, adding to a broad semiconductor rally.", url: "#", source: "Demo · Tech", publishedAt: minsAgo(18) },
];

// Deterministic wobble (layered sines) so demo charts and analytics behave
// like real, noisy price series — no Math.random, stable across SSR/CSR.
const sparkPath = (base: number, drift: number): number[] =>
  Array.from({ length: 30 }, (_, i) => {
    const trend = (drift * i) / 100 / 30;
    const noise =
      0.011 * Math.sin(i * 1.7 + base % 7) +
      0.006 * Math.sin(i * 0.6 + base % 3) +
      0.004 * Math.sin(i * 2.9);
    return +(base * (1 + trend + noise)).toFixed(2);
  });

const spark = sparkPath;

// Full OHLCV bars derived from the same close path: open = previous close,
// high/low from deterministic intrabar wicks, volume pulses with the wicks.
const demoCandles = (base: number, drift: number) => {
  const closes = sparkPath(base, drift);
  const now = Math.floor(Date.now() / 1000);
  return closes.map((close, i) => {
    const open = i === 0 ? close * 0.998 : closes[i - 1];
    const hi = Math.max(open, close);
    const lo = Math.min(open, close);
    const wick = Math.abs(Math.sin(i * 2.3 + base)) * 0.006 + 0.002;
    const volume = Math.round(1e6 * (1 + 0.6 * Math.abs(Math.sin(i * 1.3 + base % 5)) + (i > 24 ? 0.8 : 0)));
    return {
      time: now - (closes.length - 1 - i) * 86400,
      open: +open.toFixed(2),
      high: +(hi * (1 + wick)).toFixed(2),
      low: +(lo * (1 - wick)).toFixed(2),
      close,
      volume,
    };
  });
};

const DEMO_QUOTES: Quote[] = [
  { symbol: "NVDA", name: "Nvidia", kind: "equity", price: 132.4, changePct: 6.2, volumeRatio: 320, spark: spark(124, 6.2), candles: demoCandles(124, 6.2), currency: "USD", updatedAt: minsAgo(1) },
  { symbol: "PLTR", name: "Palantir", kind: "equity", price: 41.8, changePct: 8.9, volumeRatio: 410, spark: spark(38, 8.9), candles: demoCandles(38, 8.9), currency: "USD", updatedAt: minsAgo(1) },
  { symbol: "AMD", name: "AMD", kind: "equity", price: 168.2, changePct: 4.1, volumeRatio: 210, spark: spark(161, 4.1), candles: demoCandles(161, 4.1), currency: "USD", updatedAt: minsAgo(1) },
  { symbol: "AAPL", name: "Apple", kind: "equity", price: 229.1, changePct: 1.8, volumeRatio: 140, spark: spark(225, 1.8), candles: demoCandles(225, 1.8), currency: "USD", updatedAt: minsAgo(1) },
  { symbol: "TSLA", name: "Tesla", kind: "equity", price: 214.5, changePct: -5.4, volumeRatio: 280, spark: spark(226, -5.4), candles: demoCandles(226, -5.4), currency: "USD", updatedAt: minsAgo(1) },
  { symbol: "BA", name: "Boeing", kind: "equity", price: 172.3, changePct: -3.6, volumeRatio: 190, spark: spark(178, -3.6), candles: demoCandles(178, -3.6), currency: "USD", updatedAt: minsAgo(1) },
  { symbol: "COIN", name: "Coinbase", kind: "equity", price: 248.9, changePct: 5.7, volumeRatio: 260, spark: spark(235, 5.7), candles: demoCandles(235, 5.7), currency: "USD", updatedAt: minsAgo(1) },
  { symbol: "BTC-USD", name: "Bitcoin", kind: "crypto", price: 68420, changePct: 4.8, volumeRatio: 230, spark: spark(65300, 4.8), candles: demoCandles(65300, 4.8), currency: "USD", updatedAt: minsAgo(1) },
  { symbol: "ETH-USD", name: "Ethereum", kind: "crypto", price: 3585, changePct: 5.9, volumeRatio: 250, spark: spark(3385, 5.9), candles: demoCandles(3385, 5.9), currency: "USD", updatedAt: minsAgo(1) },
  { symbol: "SOL-USD", name: "Solana", kind: "crypto", price: 178.4, changePct: 9.3, volumeRatio: 340, spark: spark(163, 9.3), candles: demoCandles(163, 9.3), currency: "USD", updatedAt: minsAgo(1) },
];

export function demoNews(): NewsItem[] {
  return enrichArticles(RAW, () => "general");
}

export function demoQuotes(): Quote[] {
  return DEMO_QUOTES;
}

import { describe, it, expect } from "vitest";
import {
  computeIndicators,
  projectPrice,
  findHiddenSignals,
  buildBriefing,
} from "@/lib/radar/analytics";
import type { NewsItem, Quote } from "@/lib/radar/types";

// Deterministic wobbly series: trend + layered sines (no randomness).
const series = (base: number, driftPctTotal: number, n = 30): number[] =>
  Array.from({ length: n }, (_, i) => {
    const trend = (driftPctTotal / 100) * (i / (n - 1));
    const noise = 0.008 * Math.sin(i * 1.7) + 0.004 * Math.sin(i * 0.6 + 2);
    return +(base * (1 + trend + noise)).toFixed(4);
  });

const quote = (over: Partial<Quote> = {}): Quote => ({
  symbol: "TEST",
  name: "Test Corp",
  kind: "equity",
  price: 100,
  changePct: 0,
  volumeRatio: 100,
  spark: series(100, 0),
  currency: "USD",
  updatedAt: new Date().toISOString(),
  ...over,
});

const newsItem = (over: Partial<NewsItem> = {}): NewsItem => ({
  id: "n1",
  title: "Test Corp does something notable in the market today",
  summary: "",
  url: "https://example.com",
  source: "Test",
  publishedAt: new Date().toISOString(),
  category: "equities",
  sentimentScore: 0,
  sentiment: "neutral",
  impact: 50,
  symbols: ["TEST"],
  catalyst: null,
  breaking: false,
  ...over,
});

describe("computeIndicators", () => {
  it("returns null on insufficient data", () => {
    expect(computeIndicators([1, 2, 3])).toBeNull();
  });

  it("flags a strong uptrend with high RSI and top-of-range position", () => {
    const ind = computeIndicators(series(100, 12))!;
    expect(ind.trend).toBe("uptrend");
    expect(ind.rsi14!).toBeGreaterThan(60);
    expect(ind.rangePos).toBeGreaterThan(80);
  });

  it("flags a downtrend symmetrically", () => {
    const ind = computeIndicators(series(100, -12))!;
    expect(ind.trend).toBe("downtrend");
    expect(ind.rsi14!).toBeLessThan(40);
    expect(ind.rangePos).toBeLessThan(20);
  });

  it("measures volatility of a noisy flat series as roughly its noise scale", () => {
    const ind = computeIndicators(series(100, 0))!;
    expect(ind.trend).toBe("sideways");
    expect(ind.volatilityPct).toBeGreaterThan(0.1);
    expect(ind.volatilityPct).toBeLessThan(3);
  });
});

describe("projectPrice", () => {
  const bull = { momentum: 60, volume: 40, sentiment: 60 };
  const bear = { momentum: -60, volume: 40, sentiment: -60 };

  it("keeps the cone ordered: lower < median < upper", () => {
    const p = projectPrice(series(100, 5), 100, bull, 50)!;
    for (let t = 1; t <= p.steps; t++) {
      expect(p.lower[t]).toBeLessThan(p.median[t]);
      expect(p.median[t]).toBeLessThan(p.upper[t]);
    }
    expect(p.median[0]).toBe(100);
  });

  it("drifts with the inputs: bullish blend up, bearish blend down", () => {
    const up = projectPrice(series(100, 5), 100, bull, 80)!;
    const down = projectPrice(series(100, -5), 100, bear, -80)!;
    expect(up.expectedMovePct).toBeGreaterThan(0);
    expect(up.upProbability).toBeGreaterThan(55);
    expect(down.expectedMovePct).toBeLessThan(0);
    expect(down.upProbability).toBeLessThan(45);
  });

  it("keeps probability inside honest bounds", () => {
    const p = projectPrice(series(100, 20), 100, { momentum: 100, volume: 100, sentiment: 100 }, 100)!;
    expect(p.upProbability).toBeLessThanOrEqual(92);
    expect(p.upProbability).toBeGreaterThanOrEqual(8);
  });

  it("agreeing drivers raise confidence", () => {
    const p = projectPrice(series(100, 8), 100, bull, 80)!;
    expect(["medium", "high"]).toContain(p.confidence);
    expect(p.driftDrivers.length).toBeGreaterThan(0);
  });

  // Calibration: on a synthetic random walk with the same volatility the
  // engine estimates from, the 80% cone should contain the outcome ~80% of
  // the time. This is the mathematical honesty check for the projection.
  it("80% cone covers ~80% of synthetic outcomes", () => {
    // mulberry32 — deterministic PRNG, seeded.
    const rng = (seed: number) => {
      let a = seed >>> 0;
      return () => {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
    const rand = rng(1234);
    const gauss = () => {
      // Box–Muller
      const u = Math.max(rand(), 1e-12);
      const v = rand();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };

    const VOL = 0.015;
    let inCone = 0;
    const TRIALS = 600;
    for (let trial = 0; trial < TRIALS; trial++) {
      // history: 30-bar zero-drift walk
      const hist = [100];
      for (let i = 1; i < 30; i++) hist.push(hist[i - 1] * Math.exp(VOL * gauss()));
      const price = hist[hist.length - 1];
      const p = projectPrice(hist, price, { momentum: 0, volume: 0, sentiment: 0 }, 0);
      if (!p) continue;
      // future: continue the same process 7 bars
      let future = price;
      for (let t = 0; t < 7; t++) future *= Math.exp(VOL * gauss());
      if (future >= p.lower[7] && future <= p.upper[7]) inCone++;
    }
    const coverage = (inCone / TRIALS) * 100;
    // Sampling noise on 600 trials + 29-return vol estimation → allow 72–88.
    expect(coverage).toBeGreaterThan(72);
    expect(coverage).toBeLessThan(88);
  });
});

describe("findHiddenSignals", () => {
  it("spots a bullish price/news divergence", () => {
    const news = [
      newsItem({ id: "a", sentiment: "bullish" }),
      newsItem({ id: "b", sentiment: "bullish" }),
    ];
    const sigs = findHiddenSignals(quote({ changePct: -3 }), news, computeIndicators(series(100, -3)));
    expect(sigs.map((s) => s.key)).toContain("bull-divergence");
  });

  it("spots a coiled spring (volume without movement)", () => {
    const sigs = findHiddenSignals(quote({ changePct: 0.4, volumeRatio: 250 }), [], null);
    expect(sigs.map((s) => s.key)).toContain("coil");
  });

  it("spots an unpriced fresh catalyst", () => {
    const news = [newsItem({ impact: 80, sentiment: "bullish", publishedAt: new Date().toISOString() })];
    const sigs = findHiddenSignals(quote({ changePct: 0.2 }), news, null);
    expect(sigs.map((s) => s.key)).toContain("news-lag");
  });

  it("spots stacked catalysts in the same direction", () => {
    const news = [
      newsItem({ id: "a", catalyst: { type: "earnings_beat", label: "Earnings Beat", direction: "bullish", strength: 88, why: "x" } }),
      newsItem({ id: "b", catalyst: { type: "guidance_raise", label: "Guidance Raise", direction: "bullish", strength: 84, why: "x" } }),
    ];
    const sigs = findHiddenSignals(quote(), news, null);
    expect(sigs.map((s) => s.key)).toContain("stack-bullish");
  });

  it("stays quiet when nothing is anomalous", () => {
    const sigs = findHiddenSignals(quote({ changePct: 0.3, volumeRatio: 105 }), [], computeIndicators(series(100, 0.5)));
    expect(sigs).toHaveLength(0);
  });
});

describe("buildBriefing", () => {
  it("assembles a readable paragraph containing the key numbers", () => {
    const q = quote({ changePct: -5.4, volumeRatio: 280 });
    const ind = computeIndicators(q.spark);
    const proj = projectPrice(q.spark, q.price, { momentum: -32, volume: 90, sentiment: -100 }, -86);
    const text = buildBriefing("Tesla", q, null, ind, proj, []);
    expect(text).toContain("Tesla is down 5.4%");
    expect(text).toContain("2.8× average volume");
    expect(text).toMatch(/scenario range/);
  });
});

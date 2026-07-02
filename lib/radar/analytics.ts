import type { NewsItem, Quote, Signal } from "./types";

// Deep-analysis engine: classic technical indicators, statistical anomaly
// detection, hidden-signal discovery (the things a headline feed won't show),
// and a volatility-scaled price projection. Everything is deterministic and
// transparent — every number can be traced back to a formula, never a black box.

// ── Technical indicators ─────────────────────────────────────────────────────

export interface Indicators {
  rsi14: number | null;          // 0..100
  trend: "uptrend" | "downtrend" | "sideways";
  trendStrengthPct: number;      // fast-vs-slow SMA gap, %
  volatilityPct: number;         // stddev of per-bar returns, %
  momentumZ: number;             // latest return vs its own history, z-score
  rangePos: number;              // 0..100 — where price sits in the recent range
  streak: number;                // consecutive up (+) or down (−) bars
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const std = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function returns(spark: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < spark.length; i++) {
    if (spark[i - 1] > 0) out.push(spark[i] / spark[i - 1] - 1);
  }
  return out;
}

export function computeIndicators(spark: number[]): Indicators | null {
  if (!spark || spark.length < 10) return null;
  const rets = returns(spark);

  // RSI(14) — Wilder's smoothing over available bars.
  let rsi14: number | null = null;
  if (rets.length >= 14) {
    const window = rets.slice(-14);
    const gains = mean(window.map((r) => Math.max(0, r)));
    const losses = mean(window.map((r) => Math.max(0, -r)));
    rsi14 = losses === 0 ? 100 : Math.round(100 - 100 / (1 + gains / losses));
  }

  // Trend from fast (last 5) vs slow (last 20) moving averages.
  const fast = mean(spark.slice(-5));
  const slow = mean(spark.slice(-20));
  const gapPct = slow ? ((fast - slow) / slow) * 100 : 0;
  const trend = gapPct > 0.6 ? "uptrend" : gapPct < -0.6 ? "downtrend" : "sideways";

  const volatilityPct = std(rets) * 100;
  const lastRet = rets[rets.length - 1] ?? 0;
  const momentumZ = std(rets) ? clamp((lastRet - mean(rets)) / std(rets), -4, 4) : 0;

  const lo = Math.min(...spark);
  const hi = Math.max(...spark);
  const rangePos = hi > lo ? Math.round(((spark[spark.length - 1] - lo) / (hi - lo)) * 100) : 50;

  let streak = 0;
  for (let i = rets.length - 1; i >= 0; i--) {
    if (streak === 0) streak = rets[i] > 0 ? 1 : rets[i] < 0 ? -1 : 0;
    else if (streak > 0 && rets[i] > 0) streak++;
    else if (streak < 0 && rets[i] < 0) streak--;
    else break;
  }

  return {
    rsi14,
    trend,
    trendStrengthPct: +gapPct.toFixed(2),
    volatilityPct: +volatilityPct.toFixed(2),
    momentumZ: +momentumZ.toFixed(2),
    rangePos,
    streak,
  };
}

// ── Price projection ─────────────────────────────────────────────────────────
//
// A drift + volatility cone (the same construction quant desks use for quick
// scenario ranges): drift comes from a transparent blend of trend, momentum
// and news pressure; the cone width is the observed volatility scaled by √t.
// This is a *scenario range*, not a promise — the honest way to "get as close
// to predicting price as you can" without lying about certainty.

export interface Projection {
  steps: number;                 // number of projected bars
  median: number[];              // most-likely path (index 0 = current price)
  upper: number[];               // ~80th percentile path
  lower: number[];               // ~20th percentile path
  expectedMovePct: number;       // median end vs current, %
  upProbability: number;         // 0..100
  confidence: "low" | "medium" | "high";
  driftDrivers: string[];        // plain-English inputs to the drift
}

export function projectPrice(
  spark: number[],
  price: number,
  breakdown: { momentum: number; volume: number; sentiment: number },
  catalystPush: number, // −100..100: strongest catalyst direction × strength
  steps = 7,
): Projection | null {
  const ind = computeIndicators(spark);
  if (!ind || price <= 0) return null;

  const vol = Math.max(ind.volatilityPct / 100, 0.004); // floor: 0.4%/bar

  // Drift blend, each term in −1..1 — weights sum to 1 and are documented.
  const trendTerm = clamp(ind.trendStrengthPct / 3, -1, 1);        // 35%
  const momTerm = clamp(breakdown.momentum / 100, -1, 1);          // 25%
  const newsTerm = clamp(breakdown.sentiment / 100, -1, 1);        // 25%
  const catTerm = clamp(catalystPush / 100, -1, 1);                // 15%
  let k = 0.35 * trendTerm + 0.25 * momTerm + 0.25 * newsTerm + 0.15 * catTerm;

  // Mean-reversion guard: stretched RSI bleeds the drift toward zero.
  if (ind.rsi14 != null) {
    if (ind.rsi14 > 74 && k > 0) k *= 0.45;
    if (ind.rsi14 < 26 && k < 0) k *= 0.45;
  }

  const driftPerStep = k * vol * 0.9; // drift can't plausibly outrun volatility
  const z80 = 0.8416; // 80th percentile of the normal distribution

  const median = [price];
  const upper = [price];
  const lower = [price];
  for (let t = 1; t <= steps; t++) {
    median.push(price * Math.exp(driftPerStep * t));
    upper.push(price * Math.exp(driftPerStep * t + z80 * vol * Math.sqrt(t)));
    lower.push(price * Math.exp(driftPerStep * t - z80 * vol * Math.sqrt(t)));
  }

  const expectedMovePct = (median[steps] / price - 1) * 100;
  // P(end > now) under the same lognormal assumption.
  const zEnd = (driftPerStep * steps) / (vol * Math.sqrt(steps));
  const upProbability = Math.round(clamp(50 + 34 * Math.tanh(zEnd * 0.9), 8, 92));

  const agreeing =
    [trendTerm, momTerm, newsTerm, catTerm].filter((t) => Math.sign(t) === Math.sign(k) && Math.abs(t) > 0.15).length;
  const confidence = agreeing >= 3 ? "high" : agreeing === 2 ? "medium" : "low";

  const driftDrivers: string[] = [];
  if (Math.abs(trendTerm) > 0.15)
    driftDrivers.push(`${ind.trend} (fast MA ${ind.trendStrengthPct > 0 ? "above" : "below"} slow by ${Math.abs(ind.trendStrengthPct).toFixed(1)}%)`);
  if (Math.abs(momTerm) > 0.15) driftDrivers.push(`${momTerm > 0 ? "positive" : "negative"} momentum (${breakdown.momentum > 0 ? "+" : ""}${breakdown.momentum})`);
  if (Math.abs(newsTerm) > 0.15) driftDrivers.push(`news tone ${newsTerm > 0 ? "bullish" : "bearish"} (${breakdown.sentiment > 0 ? "+" : ""}${breakdown.sentiment})`);
  if (Math.abs(catTerm) > 0.15) driftDrivers.push(`active ${catTerm > 0 ? "bullish" : "bearish"} catalyst`);
  if (ind.rsi14 != null && (ind.rsi14 > 74 || ind.rsi14 < 26))
    driftDrivers.push(`RSI ${ind.rsi14} — stretched, drift damped for mean reversion`);
  if (driftDrivers.length === 0) driftDrivers.push("no dominant driver — range likely to hold");

  return {
    steps,
    median: median.map((v) => +v.toFixed(4)),
    upper: upper.map((v) => +v.toFixed(4)),
    lower: lower.map((v) => +v.toFixed(4)),
    expectedMovePct: +expectedMovePct.toFixed(2),
    upProbability,
    confidence,
    driftDrivers,
  };
}

// ── Hidden signals — the things you usually don't see ────────────────────────

export interface HiddenSignal {
  key: string;
  title: string;
  detail: string;
  tone: "bullish" | "bearish" | "neutral";
  severity: number; // 0..100 for ordering
}

export function findHiddenSignals(
  quote: Quote,
  news: NewsItem[],
  ind: Indicators | null,
): HiddenSignal[] {
  const out: HiddenSignal[] = [];
  const change = quote.changePct;
  const volX = quote.volumeRatio != null ? quote.volumeRatio / 100 : null;

  const dirNews = news.filter((n) => n.sentiment !== "neutral");
  const bull = dirNews.filter((n) => n.sentiment === "bullish").length;
  const bear = dirNews.length - bull;
  const newsLean = dirNews.length ? (bull - bear) / dirNews.length : 0; // −1..1

  // 1) Price/news divergence — the market hasn't voted with the story yet.
  if (change <= -2 && newsLean > 0.4 && dirNews.length >= 2) {
    out.push({
      key: "bull-divergence",
      title: "Bullish divergence",
      detail: `Price is down ${Math.abs(change).toFixed(1)}% while ${bull}/${dirNews.length} directional headlines are bullish — news flow and tape disagree; reversals often start here.`,
      tone: "bullish",
      severity: 80,
    });
  }
  if (change >= 2 && newsLean < -0.4 && dirNews.length >= 2) {
    out.push({
      key: "bear-divergence",
      title: "Bearish divergence",
      detail: `Price is up ${change.toFixed(1)}% while ${bear}/${dirNews.length} directional headlines are bearish — the rally is fighting the news flow.`,
      tone: "bearish",
      severity: 80,
    });
  }

  // 2) Coiled spring — volume arrives before the move does.
  if (volX != null && volX >= 1.7 && Math.abs(change) < 1.5) {
    out.push({
      key: "coil",
      title: "Coiled spring",
      detail: `Volume is running ${volX.toFixed(1)}× average while price has barely moved (${change >= 0 ? "+" : ""}${change.toFixed(1)}%) — positioning is building before a direction is picked.`,
      tone: "neutral",
      severity: 75,
    });
  }

  // 3) News lag — a fresh, high-impact story the tape hasn't priced.
  const freshHot = news.find((n) => {
    const ageMin = (Date.now() - Date.parse(n.publishedAt)) / 60000;
    return ageMin < 60 && n.impact >= 65 && n.sentiment !== "neutral";
  });
  if (freshHot && Math.abs(change) < 1.2) {
    out.push({
      key: "news-lag",
      title: "Unpriced catalyst",
      detail: `"${freshHot.title.slice(0, 90)}" is <1h old with impact ${freshHot.impact}/100, yet price has moved only ${change >= 0 ? "+" : ""}${change.toFixed(1)}% — the market may not have digested it.`,
      tone: freshHot.sentiment,
      severity: 85,
    });
  }

  // 4) Catalyst stacking — multiple independent drivers, same direction.
  const catDirs = new Map<string, Set<string>>();
  for (const n of news) {
    if (!n.catalyst || n.catalyst.direction === "neutral") continue;
    const set = catDirs.get(n.catalyst.direction) ?? new Set();
    set.add(n.catalyst.type);
    catDirs.set(n.catalyst.direction, set);
  }
  for (const [dir, types] of catDirs) {
    if (types.size >= 2) {
      out.push({
        key: `stack-${dir}`,
        title: "Catalyst stack",
        detail: `${types.size} independent ${dir} catalyst types are active at once (${[...types].join(", ")}) — stacked drivers produce outsized moves.`,
        tone: dir as "bullish" | "bearish",
        severity: 78,
      });
    }
  }

  // 5) Stretch — RSI extremes flag exhaustion either way.
  if (ind?.rsi14 != null) {
    if (ind.rsi14 >= 78)
      out.push({
        key: "overbought",
        title: "Overextended",
        detail: `RSI ${ind.rsi14} with a ${ind.streak}-bar up streak — momentum is stretched; chasing here has poor odds.`,
        tone: "bearish",
        severity: 60,
      });
    if (ind.rsi14 <= 22)
      out.push({
        key: "oversold",
        title: "Washed out",
        detail: `RSI ${ind.rsi14} after a ${Math.abs(ind.streak)}-bar slide — sellers may be exhausted; snap-backs start from here.`,
        tone: "bullish",
        severity: 60,
      });
  }

  // 6) Range edges — quietly sitting at a boundary.
  if (ind) {
    if (ind.rangePos >= 96)
      out.push({
        key: "breakout-watch",
        title: "At range highs",
        detail: `Price sits at the ${ind.rangePos}th percentile of its recent range — a close above starts breakout mechanics (stops + momentum buyers).`,
        tone: "bullish",
        severity: 55,
      });
    if (ind.rangePos <= 4)
      out.push({
        key: "breakdown-watch",
        title: "At range lows",
        detail: `Price sits at the ${ind.rangePos}th percentile of its recent range — support is being tested for the breakdown.`,
        tone: "bearish",
        severity: 55,
      });
  }

  out.sort((a, b) => b.severity - a.severity);
  return out;
}

// ── Auto-briefing ────────────────────────────────────────────────────────────

/** A deterministic analyst-style paragraph assembled from the numbers. */
export function buildBriefing(
  name: string,
  quote: Quote,
  signal: Signal | null,
  ind: Indicators | null,
  proj: Projection | null,
  hidden: HiddenSignal[],
): string {
  const parts: string[] = [];
  const dir = quote.changePct >= 0 ? "up" : "down";
  parts.push(
    `${name} is ${dir} ${Math.abs(quote.changePct).toFixed(1)}% ${
      quote.volumeRatio != null ? `on ${(quote.volumeRatio / 100).toFixed(1)}× average volume` : ""
    }`.trim() + ".",
  );
  if (ind) {
    parts.push(
      `The tape shows a ${ind.trend}${ind.rsi14 != null ? ` with RSI at ${ind.rsi14}` : ""}, price in the ${ind.rangePos}th percentile of its recent range, and per-bar volatility near ${ind.volatilityPct.toFixed(1)}%.`,
    );
  }
  if (signal && signal.headlines.length > 0) {
    parts.push(
      `News flow is ${signal.breakdown.sentiment > 15 ? "bullish" : signal.breakdown.sentiment < -15 ? "bearish" : "mixed"} across ${signal.headlines.length} tracked headline${signal.headlines.length > 1 ? "s" : ""}.`,
    );
  }
  if (hidden.length > 0) {
    parts.push(`Under the surface: ${hidden[0].title.toLowerCase()} — ${hidden[0].detail.split("—")[1]?.trim() ?? hidden[0].detail}`);
  }
  if (proj) {
    parts.push(
      `The volatility cone puts the ${proj.steps}-bar scenario range at ${proj.lower[proj.steps].toFixed(2)}–${proj.upper[proj.steps].toFixed(2)} with a ${proj.upProbability}% skew ${proj.upProbability >= 50 ? "up" : "down"} (${proj.confidence} confidence).`,
    );
  }
  return parts.join(" ");
}

import type { NewsItem, Quote, Signal } from "./types";

// Fuse market structure (momentum + volume) with news sentiment into a single,
// explainable conviction score. This is a heuristic scanner, NOT investment
// advice — every signal ships with the reasons behind it so a human decides.

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function momentumScore(changePct: number): number {
  // Reward strong moves, but cap so a single outlier can't dominate.
  return clamp(Math.round(changePct * 6), -100, 100);
}

function volumeScore(volumeRatio: number | null): number {
  if (volumeRatio == null) return 0;
  // 100% = average volume -> 0. 300% (3x) -> strong signal.
  return clamp(Math.round((volumeRatio - 100) / 2), -20, 100);
}

function newsScore(items: NewsItem[]): { score: number; count: number } {
  if (!items.length) return { score: 0, count: 0 };
  // Impact-weighted average sentiment.
  let wSum = 0;
  let w = 0;
  for (const n of items) {
    const weight = 1 + n.impact / 50;
    wSum += n.sentimentScore * weight;
    w += weight;
  }
  return { score: clamp(Math.round(wSum / w), -100, 100), count: items.length };
}

export function buildSignals(quotes: Quote[], news: NewsItem[]): Signal[] {
  // Index news by symbol for O(1) lookup.
  const bySymbol = new Map<string, NewsItem[]>();
  for (const n of news) {
    for (const s of n.symbols) {
      const arr = bySymbol.get(s) ?? [];
      arr.push(n);
      bySymbol.set(s, arr);
    }
  }

  const signals: Signal[] = quotes.map((q) => {
    const linked = (bySymbol.get(q.symbol) ?? []).sort((a, b) => b.impact - a.impact);
    const mom = momentumScore(q.changePct);
    const vol = volumeScore(q.volumeRatio);
    const { score: sent, count } = newsScore(linked);

    // Composite: momentum is the spine, volume confirms conviction, news is the
    // catalyst multiplier. Map the -100..100 blend onto a 0..100 score.
    const blend = 0.45 * mom + 0.25 * vol + 0.3 * sent;
    const score = clamp(Math.round(50 + blend / 2), 0, 100);

    const drivers: string[] = [];
    if (q.changePct >= 3) drivers.push(`Up ${q.changePct.toFixed(1)}% — strong momentum`);
    else if (q.changePct <= -3) drivers.push(`Down ${Math.abs(q.changePct).toFixed(1)}% — under pressure`);
    else drivers.push(`${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(1)}% on the session`);

    if (q.volumeRatio != null && q.volumeRatio >= 180)
      drivers.push(`Volume ${(q.volumeRatio / 100).toFixed(1)}× average — unusual activity`);
    if (count > 0)
      drivers.push(
        `${count} headline${count > 1 ? "s" : ""}, ${
          sent > 15 ? "bullish" : sent < -15 ? "bearish" : "mixed"
        } tone`,
      );

    const lean: Signal["lean"] =
      score >= 66 && q.changePct > 0 ? "buy" : score <= 38 ? "avoid" : "watch";

    return {
      symbol: q.symbol,
      name: q.name,
      kind: q.kind,
      lean,
      score,
      price: q.price,
      changePct: q.changePct,
      spark: q.spark,
      drivers,
      headlines: linked.slice(0, 3).map((n) => ({
        title: n.title,
        url: n.url,
        sentiment: n.sentiment,
      })),
      breakdown: { momentum: mom, volume: vol, sentiment: sent },
      updatedAt: q.updatedAt,
    };
  });

  // Surface the highest-conviction ideas first.
  signals.sort((a, b) => b.score - a.score);
  return signals;
}

/** Names that are moving hard right now — the "could spike" watch. */
export function spikeCandidates(quotes: Quote[], news: NewsItem[]): Signal[] {
  return buildSignals(quotes, news).filter(
    (s) =>
      Math.abs(s.changePct) >= 4 ||
      (s.breakdown.volume >= 40 && s.changePct > 0) ||
      s.headlines.some((h) => h.sentiment !== "neutral"),
  );
}

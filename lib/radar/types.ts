// Shared types for the Radar market-intelligence engine.

export type Sentiment = "bullish" | "bearish" | "neutral";

export interface Catalyst {
  type: string;
  label: string;
  direction: Sentiment;
  strength: number;
  why: string;
}

export type NewsCategory =
  | "equities"
  | "crypto"
  | "macro"
  | "geopolitics"
  | "commodities"
  | "tech"
  | "general";

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  /** ISO timestamp */
  publishedAt: string;
  category: NewsCategory;
  /** -100 (very bearish) .. +100 (very bullish) */
  sentimentScore: number;
  sentiment: Sentiment;
  /** 0..100 — how market-moving this headline is likely to be */
  impact: number;
  /** Tickers / symbols the story is about, e.g. ["NVDA", "BTC-USD"] */
  symbols: string[];
  /** The dominant price-moving catalyst detected in the headline, if any */
  catalyst: Catalyst | null;
  /** True when flagged as breaking / high urgency */
  breaking: boolean;
}

export interface Quote {
  symbol: string;
  name: string;
  kind: "equity" | "crypto";
  price: number;
  changePct: number;
  /** Percentage of average volume, e.g. 240 = 2.4x normal */
  volumeRatio: number | null;
  /** Recent close prices, oldest -> newest, for a sparkline */
  spark: number[];
  currency: string;
  updatedAt: string;
}

export interface Signal {
  symbol: string;
  name: string;
  kind: "equity" | "crypto";
  /** buy | watch | avoid — never advice, just a computed lean */
  lean: "buy" | "watch" | "avoid";
  /** 0..100 composite conviction score */
  score: number;
  price: number;
  changePct: number;
  /** Recent closes for a sparkline */
  spark: number[];
  /** Human-readable reasons that drove the score */
  drivers: string[];
  /** Linked news headlines */
  headlines: { title: string; url: string; sentiment: Sentiment }[];
  /** momentum / volume / sentiment sub-scores, each -100..100 */
  breakdown: { momentum: number; volume: number; sentiment: number };
  updatedAt: string;
}

export interface RadarPayload<T> {
  ok: boolean;
  /** True when live sources were unreachable and demo data is shown */
  degraded: boolean;
  generatedAt: string;
  count: number;
  items: T[];
  /** Optional diagnostic notes (source failures, etc.) */
  notes?: string[];
}

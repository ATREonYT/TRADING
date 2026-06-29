import type { Signal } from "./types.js";

export interface PaperTrade {
  symbol: string;
  entryPrice: number;
  entryAt: number;
  entryScore: number;
  entryRisk: "low" | "medium" | "high";
  peakPrice: number;
  troughPrice: number;
  lastPrice: number;
  closedAt?: number;
}

export interface PerfSummary {
  closed: number;
  open: number;
  wins: number;
  winRate: number; // %
  avgPeakPct: number;
  avgFinalPct: number;
  avgDrawdownPct: number;
  best?: { symbol: string; pct: number };
  worst?: { symbol: string; pct: number };
}

const pct = (from: number, to: number) => (from > 0 ? ((to - from) / from) * 100 : 0);

/**
 * Paper-trades every signal: records a hypothetical entry at alert time, then
 * follows the price for `horizonMin` minutes to measure peak gain, final result,
 * and max drawdown. Lets you judge whether the signals actually work. In-memory
 * only — resets on restart.
 */
export class SignalTracker {
  private openTrades = new Map<string, PaperTrade>();
  private history: PaperTrade[] = [];

  constructor(private horizonMin: number, private winPct: number) {}

  /** Begin tracking a signal (ignored if that symbol is already open). */
  track(signal: Signal, now: number): void {
    if (this.openTrades.has(signal.symbol)) return;
    this.openTrades.set(signal.symbol, {
      symbol: signal.symbol,
      entryPrice: signal.price,
      entryAt: now,
      entryScore: signal.score,
      entryRisk: signal.riskLevel,
      peakPrice: signal.price,
      troughPrice: signal.price,
      lastPrice: signal.price,
    });
  }

  /** Update open trades with the latest prices; close any past the horizon. */
  update(priceBySymbol: Map<string, number>, now: number): void {
    const horizonMs = this.horizonMin * 60_000;
    for (const [symbol, trade] of this.openTrades) {
      const price = priceBySymbol.get(symbol);
      if (price && price > 0) {
        trade.lastPrice = price;
        if (price > trade.peakPrice) trade.peakPrice = price;
        if (price < trade.troughPrice) trade.troughPrice = price;
      }
      if (now - trade.entryAt >= horizonMs) {
        trade.closedAt = now;
        this.history.push(trade);
        this.openTrades.delete(symbol);
      }
    }
  }

  openList(now: number): Array<{ symbol: string; curPct: number; peakPct: number; ageMin: number; entryScore: number }> {
    return [...this.openTrades.values()]
      .map((t) => ({
        symbol: t.symbol,
        curPct: round2(pct(t.entryPrice, t.lastPrice)),
        peakPct: round2(pct(t.entryPrice, t.peakPrice)),
        ageMin: Math.floor((now - t.entryAt) / 60_000),
        entryScore: t.entryScore,
      }))
      .sort((a, b) => b.peakPct - a.peakPct);
  }

  summary(): PerfSummary {
    const h = this.history;
    const peaks = h.map((t) => pct(t.entryPrice, t.peakPrice));
    const finals = h.map((t) => pct(t.entryPrice, t.lastPrice));
    const draws = h.map((t) => pct(t.entryPrice, t.troughPrice));
    const wins = peaks.filter((p) => p >= this.winPct).length;

    let best: PerfSummary["best"];
    let worst: PerfSummary["worst"];
    h.forEach((t) => {
      const fp = pct(t.entryPrice, t.lastPrice);
      if (!best || fp > best.pct) best = { symbol: t.symbol, pct: round2(fp) };
      if (!worst || fp < worst.pct) worst = { symbol: t.symbol, pct: round2(fp) };
    });

    return {
      closed: h.length,
      open: this.openTrades.size,
      wins,
      winRate: h.length ? round2((wins / h.length) * 100) : 0,
      avgPeakPct: round2(avg(peaks)),
      avgFinalPct: round2(avg(finals)),
      avgDrawdownPct: round2(avg(draws)),
      best,
      worst,
    };
  }
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

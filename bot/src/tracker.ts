import type { Signal } from "./types.js";

export type Outcome = "win" | "loss" | "flat";

export interface PaperTrade {
  symbol: string;
  direction: "up" | "down";
  entryPrice: number;
  entryAt: number;
  entryScore: number;
  entryRisk: "low" | "medium" | "high";
  peakPrice: number;
  troughPrice: number;
  lastPrice: number;
  /** Resolved as soon as target or stop is hit; "flat" if neither by horizon. */
  outcome?: Outcome;
  closedAt?: number;
}

export interface PerfSummary {
  closed: number;
  open: number;
  wins: number;
  losses: number;
  flats: number;
  winRate: number; // % = wins / closed (honest: target hit before stop)
  targetPct: number;
  stopPct: number;
  avgPeakPct: number;
  avgFinalPct: number;
  avgDrawdownPct: number;
  best?: { symbol: string; pct: number };
  worst?: { symbol: string; pct: number };
}

const pct = (from: number, to: number) => (from > 0 ? ((to - from) / from) * 100 : 0);

/**
 * Paper-trades every signal with an HONEST, unbiased outcome rule: a trade is a
 * WIN only if price reaches +targetPct *before* hitting -stopPct (in the signal's
 * direction); a LOSS if the stop is hit first; "flat" if neither lands by the
 * horizon. This avoids the optimistic bias of counting the best price ever
 * touched. In-memory only — resets on restart.
 */
export class SignalTracker {
  private openTrades = new Map<string, PaperTrade>();
  private history: PaperTrade[] = [];

  constructor(
    private horizonMin: number,
    private targetPct: number,
    private stopPct: number = targetPct,
  ) {}

  /** Begin tracking a signal (ignored if that symbol is already open). */
  track(signal: Signal, now: number): void {
    if (this.openTrades.has(signal.symbol)) return;
    this.openTrades.set(signal.symbol, {
      symbol: signal.symbol,
      direction: signal.direction,
      entryPrice: signal.price,
      entryAt: now,
      entryScore: signal.score,
      entryRisk: signal.riskLevel,
      peakPrice: signal.price,
      troughPrice: signal.price,
      lastPrice: signal.price,
    });
  }

  /** Update open trades; resolve win/loss the moment target or stop is hit. */
  update(priceBySymbol: Map<string, number>, now: number): void {
    const horizonMs = this.horizonMin * 60_000;
    for (const [symbol, trade] of this.openTrades) {
      const price = priceBySymbol.get(symbol);
      if (price && price > 0) {
        trade.lastPrice = price;
        if (price > trade.peakPrice) trade.peakPrice = price;
        if (price < trade.troughPrice) trade.troughPrice = price;
        // Direction-aware favourable move at this sample.
        const fav = trade.direction === "up" ? pct(trade.entryPrice, price) : -pct(trade.entryPrice, price);
        if (!trade.outcome) {
          if (fav >= this.targetPct) trade.outcome = "win";
          else if (fav <= -this.stopPct) trade.outcome = "loss";
        }
      }
      if (now - trade.entryAt >= horizonMs) {
        if (!trade.outcome) trade.outcome = "flat"; // never reached target or stop
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
        curPct: round2(favFinal(t)),
        peakPct: round2(favPeak(t)),
        ageMin: Math.floor((now - t.entryAt) / 60_000),
        entryScore: t.entryScore,
      }))
      .sort((a, b) => b.peakPct - a.peakPct);
  }

  summary(): PerfSummary {
    const h = this.history;
    // All percentages are "in the signal's favour" (up = price rises, down = price falls).
    const peaks = h.map(favPeak);
    const finals = h.map(favFinal);
    const draws = h.map(drawdown);

    const wins = h.filter((t) => t.outcome === "win").length;
    const losses = h.filter((t) => t.outcome === "loss").length;
    const flats = h.filter((t) => t.outcome === "flat").length;

    let best: PerfSummary["best"];
    let worst: PerfSummary["worst"];
    h.forEach((t) => {
      const fp = favFinal(t);
      if (!best || fp > best.pct) best = { symbol: t.symbol, pct: round2(fp) };
      if (!worst || fp < worst.pct) worst = { symbol: t.symbol, pct: round2(fp) };
    });

    return {
      closed: h.length,
      open: this.openTrades.size,
      wins,
      losses,
      flats,
      winRate: h.length ? round2((wins / h.length) * 100) : 0,
      targetPct: this.targetPct,
      stopPct: this.stopPct,
      avgPeakPct: round2(avg(peaks)),
      avgFinalPct: round2(avg(finals)),
      avgDrawdownPct: round2(avg(draws)),
      best,
      worst,
    };
  }
}

// Favourable / adverse moves relative to the trade's direction.
const favPeak = (t: PaperTrade) =>
  t.direction === "up" ? pct(t.entryPrice, t.peakPrice) : -pct(t.entryPrice, t.troughPrice);
const favFinal = (t: PaperTrade) =>
  t.direction === "up" ? pct(t.entryPrice, t.lastPrice) : -pct(t.entryPrice, t.lastPrice);
const drawdown = (t: PaperTrade) =>
  t.direction === "up" ? pct(t.entryPrice, t.troughPrice) : -pct(t.entryPrice, t.peakPrice);

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

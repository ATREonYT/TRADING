import type { BookSnapshot, Candle, TickerLite } from "./types.js";

export interface RiskResult {
  score: number; // 0 clean .. 100 likely trap
  level: "low" | "medium" | "high";
  flags: string[];
}

/**
 * Heuristic scam/trap check from market microstructure (no on-chain data).
 *
 * For CEX-listed spot coins the realistic risks are pump-and-dump and
 * illiquidity, not honeypot contracts. We score those: thin liquidity, wide
 * spreads, shallow books, already-parabolic moves, and one-sided (spoofed)
 * walls. Higher score = more likely a trap. This is a filter, not a guarantee.
 */
export function assessRisk(
  candles: Candle[],
  ticker: TickerLite,
  book: BookSnapshot | null,
  windowChangePct: number,
): RiskResult {
  let score = 0;
  const flags: string[] = [];
  const price = candles[candles.length - 1]?.close ?? ticker.last;

  // 1) Liquidity — the single biggest tell for manipulable coins.
  if (ticker.quoteVolume < 250_000) {
    score += 30;
    flags.push("very low liquidity");
  } else if (ticker.quoteVolume < 1_000_000) {
    score += 16;
    flags.push("low liquidity");
  } else if (ticker.quoteVolume < 3_000_000) {
    score += 6;
  }

  // 2) Spread + book depth (needs order book).
  if (book && book.bestBid > 0 && book.bestAsk > 0) {
    const mid = (book.bestBid + book.bestAsk) / 2;
    const spreadPct = ((book.bestAsk - book.bestBid) / mid) * 100;
    if (spreadPct > 1.5) {
      score += 25;
      flags.push(`wide spread ${spreadPct.toFixed(1)}%`);
    } else if (spreadPct > 0.6) {
      score += 12;
      flags.push(`elevated spread ${spreadPct.toFixed(1)}%`);
    } else if (spreadPct > 0.3) {
      score += 5;
    }

    const depthUsd = (book.bidVol + book.askVol) * price;
    if (depthUsd < 20_000) {
      score += 20;
      flags.push("shallow order book");
    } else if (depthUsd < 100_000) {
      score += 10;
      flags.push("thin order book");
    }

    // One-sided wall — possible spoofing.
    const imb = book.askVol > 0 ? book.bidVol / book.askVol : 99;
    if (imb > 10 || imb < 0.1) {
      score += 8;
      flags.push("one-sided book (possible spoof)");
    }
  }
  // No order book is fine — it's an optional check; we don't penalise its absence.

  // 3) Already parabolic — buying here is often buying the dump.
  if (ticker.percentage > 80) {
    score += 22;
    flags.push(`already +${ticker.percentage.toFixed(0)}% on 24h (late)`);
  } else if (ticker.percentage > 40) {
    score += 10;
    flags.push(`up ${ticker.percentage.toFixed(0)}% on 24h`);
  }

  // 4) Vertical candle — the trigger move itself is too violent (blow-off).
  if (windowChangePct > 30) {
    score += 12;
    flags.push("vertical move (blow-off risk)");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level: RiskResult["level"] = score < 35 ? "low" : score < 65 ? "medium" : "high";
  return { score, level, flags };
}

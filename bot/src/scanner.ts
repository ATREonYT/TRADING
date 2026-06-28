import type { Config } from "./config.js";
import type { Signal, TickerLite } from "./types.js";
import { Market } from "./exchange.js";
import { evaluate } from "./detector.js";
import { orderBookImbalance } from "./indicators.js";
import { log } from "./logger.js";

export interface ScanStats {
  startedAt: number;
  lastScanAt: number;
  lastScanMs: number;
  scans: number;
  symbolsTracked: number;
  deepScanned: number;
  signalsTotal: number;
  errors: number;
  lastError?: string;
}

/**
 * Orchestrates one scan cycle and maintains per-symbol cooldown state.
 * Emits de-duplicated signals via the `onSignal` callback.
 */
export class Scanner {
  readonly market: Market;
  private cooldownUntil = new Map<string, number>();
  private lastTickers: TickerLite[] = [];
  stats: ScanStats;

  constructor(private cfg: Config, private onSignal: (s: Signal) => void) {
    this.market = new Market(cfg.exchange, cfg.quote);
    this.stats = {
      startedAt: Date.now(),
      lastScanAt: 0,
      lastScanMs: 0,
      scans: 0,
      symbolsTracked: 0,
      deepScanned: 0,
      signalsTotal: 0,
      errors: 0,
    };
  }

  async init(): Promise<void> {
    const symbols = await this.market.loadSymbols();
    this.stats.symbolsTracked = symbols.length;
  }

  /** Current top movers from the most recent ticker snapshot. */
  topMovers(n = 10): TickerLite[] {
    return [...this.lastTickers]
      .filter((t) => t.quoteVolume >= this.cfg.thresholds.minQuoteVolume)
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, n);
  }

  private inCooldown(symbol: string, now: number): boolean {
    const until = this.cooldownUntil.get(symbol);
    return until !== undefined && until > now;
  }

  /** Run a single scan cycle. Returns the signals found this cycle. */
  async scanOnce(): Promise<Signal[]> {
    const t0 = Date.now();
    const found: Signal[] = [];
    try {
      const tickers = await this.market.fetchTickers();
      this.lastTickers = tickers;

      // Prefilter: liquid markets with positive short-term momentum, ranked by
      // 24h change as a cheap proxy, then deep-scan the top N with klines.
      const candidates = tickers
        .filter((t) => t.quoteVolume >= this.cfg.thresholds.minQuoteVolume && t.percentage > 0)
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, this.cfg.maxDeepScan);

      const now = Date.now();
      let deep = 0;
      for (const ticker of candidates) {
        if (this.inCooldown(ticker.symbol, now)) continue;
        try {
          const candles = await this.market.fetchCandles(ticker.symbol, 60);
          deep++;
          const signal = evaluate(ticker.symbol, candles, ticker, this.cfg.thresholds);
          if (signal) {
            // Confirm buy-side pressure in the live order book before alerting.
            if (this.cfg.checkOrderBook) {
              const book = await this.market.fetchBook(ticker.symbol, 20);
              if (book) {
                const imb = orderBookImbalance(book.bidVol, book.askVol);
                signal.buyPressure = Math.round(imb * 100) / 100;
                if (imb >= 1.2) {
                  signal.reasons.push({
                    code: "buy-pressure",
                    label: `order book ${imb.toFixed(1)}× buy-heavy`,
                    value: signal.buyPressure,
                    threshold: 1.2,
                  });
                  signal.score = Math.min(100, signal.score + 6);
                } else if (imb < 0.6) {
                  // heavy sell wall — likely fading; skip this one
                  continue;
                }
              }
            }
            this.cooldownUntil.set(
              ticker.symbol,
              now + this.cfg.thresholds.cooldownMinutes * 60_000,
            );
            found.push(signal);
          }
        } catch (err) {
          // one bad symbol shouldn't kill the cycle
          log.warn(`fetchCandles ${ticker.symbol}:`, (err as Error).message);
        }
      }

      this.stats.deepScanned = deep;
      this.stats.symbolsTracked = tickers.length;
      found.sort((a, b) => b.score - a.score);
      for (const s of found) {
        this.stats.signalsTotal++;
        this.onSignal(s);
      }
    } catch (err) {
      this.stats.errors++;
      this.stats.lastError = (err as Error).message;
      log.error("scan cycle failed:", (err as Error).message);
    } finally {
      this.stats.scans++;
      this.stats.lastScanAt = Date.now();
      this.stats.lastScanMs = Date.now() - t0;
    }
    return found;
  }
}

import type { Config } from "./config.js";
import type { Signal, TickerLite } from "./types.js";
import { Market } from "./exchange.js";
import { evaluateDetailed } from "./detector.js";
import { orderBookImbalance, rsi, volumeSurge, windowChangePct } from "./indicators.js";
import { assessRisk, type RiskResult } from "./risk.js";
import { SignalTracker } from "./tracker.js";
import { log } from "./logger.js";

export interface NearMiss {
  symbol: string;
  change: number;
  surge: number;
  rsi: number;
  score: number;
  reject: string;
}

export interface ScanStats {
  startedAt: number;
  lastScanAt: number;
  lastScanMs: number;
  scans: number;
  symbolsTracked: number;
  /** Markets that passed the liquidity filter this cycle. */
  liquidCount: number;
  deepScanned: number;
  signalsTotal: number;
  /** Closest candidate that did NOT fire last cycle (diagnostics). */
  lastNearMiss?: NearMiss;
  errors: number;
  lastError?: string;
}

/**
 * Orchestrates one scan cycle and maintains per-symbol cooldown state.
 * Emits de-duplicated signals via the `onSignal` callback.
 */
export class Scanner {
  readonly market: Market;
  readonly tracker: SignalTracker;
  private cooldownUntil = new Map<string, number>();
  private lastTickers: TickerLite[] = [];
  private cursor = 0; // rotating scan position over the liquid universe
  stats: ScanStats;

  constructor(private cfg: Config, private onSignal: (s: Signal) => void, market?: Market) {
    this.market = market ?? new Market(cfg.exchange, cfg.quote);
    this.tracker = new SignalTracker(cfg.trackHorizonMinutes, cfg.winThresholdPct);
    this.stats = {
      startedAt: Date.now(),
      lastScanAt: 0,
      lastScanMs: 0,
      scans: 0,
      symbolsTracked: 0,
      liquidCount: 0,
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

  /** Normalise user input ("pepe", "PEPE/USDT") to a full symbol on this exchange. */
  resolveSymbol(input: string): string {
    let s = input.trim().toUpperCase();
    if (!s.includes("/")) s = `${s}/${this.cfg.quote}`;
    return s;
  }

  /** On-demand analysis of one symbol for the /risk command. */
  async analyze(input: string): Promise<{
    symbol: string;
    ticker: TickerLite;
    risk: RiskResult;
    windowChangePct: number;
    volumeSurge: number;
    rsi: number;
    buyPressure?: number;
  } | { error: string }> {
    const symbol = this.resolveSymbol(input);
    if (this.market.loaded && !this.market.hasSymbol(symbol)) {
      return { error: `${symbol} isn't a ${this.cfg.quote} spot market on ${this.market.id}.` };
    }
    const ticker =
      this.lastTickers.find((t) => t.symbol === symbol) ?? (await this.market.fetchTicker(symbol));
    if (!ticker) return { error: `Couldn't fetch ${symbol}.` };

    const candles = await this.market.fetchCandles(symbol, 60);
    const book = await this.market.fetchBook(symbol, 20);
    const change = windowChangePct(candles, this.cfg.thresholds.windowMinutes);
    const risk = assessRisk(candles, ticker, book, change);
    return {
      symbol,
      ticker,
      risk,
      windowChangePct: Math.round(change * 100) / 100,
      volumeSurge: Math.round(volumeSurge(candles, 20) * 100) / 100,
      rsi: Math.round(rsi(candles, 14) * 100) / 100,
      buyPressure: book ? Math.round(orderBookImbalance(book.bidVol, book.askVol) * 100) / 100 : undefined,
    };
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

      // Update paper-trade outcomes with the fresh prices (cheap — no extra calls).
      const priceMap = new Map(tickers.map((t) => [t.symbol, t.last]));
      this.tracker.update(priceMap, Date.now());

      const liquid = tickers.filter((t) => t.quoteVolume >= this.cfg.thresholds.minQuoteVolume);
      this.stats.liquidCount = liquid.length;

      // Coverage strategy: every cycle we scan (a) the strongest 24h movers, and
      // (b) a ROTATING batch over the full liquid universe — so across a couple of
      // minutes EVERY coin is checked, while fast movers are never missed.
      const movers = [...liquid]
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, this.cfg.moversPerScan);

      const batch: TickerLite[] = [];
      const n = liquid.length;
      if (n > 0) {
        for (let i = 0; i < this.cfg.maxDeepScan && i < n; i++) {
          batch.push(liquid[(this.cursor + i) % n]!);
        }
        this.cursor = (this.cursor + Math.min(this.cfg.maxDeepScan, n)) % n;
      }

      const seen = new Set<string>();
      const candidates: TickerLite[] = [];
      for (const t of [...movers, ...batch]) {
        if (!seen.has(t.symbol)) {
          seen.add(t.symbol);
          candidates.push(t);
        }
      }

      const now = Date.now();
      let deep = 0;
      let nearMiss: NearMiss | undefined;
      for (const ticker of candidates) {
        if (this.inCooldown(ticker.symbol, now)) continue;
        try {
          const raw = await this.market.fetchCandles(ticker.symbol, 61);
          // Drop the still-forming current 1m candle — its partial volume would
          // otherwise sink volumeSurge below threshold and suppress every signal.
          const candles = raw.length > 1 ? raw.slice(0, -1) : raw;
          deep++;
          const result = evaluateDetailed(ticker.symbol, candles, ticker, this.cfg.thresholds);
          // Track the closest near-miss for diagnostics.
          if (!result.signal && result.reject && (!nearMiss || result.metrics.score > nearMiss.score)) {
            nearMiss = {
              symbol: ticker.symbol,
              change: result.metrics.change,
              surge: result.metrics.surge,
              rsi: result.metrics.rsi,
              score: result.metrics.score,
              reject: result.reject,
            };
          }
          const signal = result.signal;
          if (signal) {
            // Fetch the live order book once — feeds buy-pressure AND risk check.
            const book = this.cfg.checkOrderBook
              ? await this.market.fetchBook(ticker.symbol, 20)
              : null;

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
              } else if (imb < 0.4) {
                // very heavy sell wall — likely fading; skip this one
                continue;
              }
            }

            // Thorough scam/trap check before alerting.
            const risk = assessRisk(candles, ticker, book, signal.windowChangePct);
            signal.riskScore = risk.score;
            signal.riskLevel = risk.level;
            signal.riskFlags = risk.flags;
            if (risk.score > this.cfg.thresholds.maxRiskScore) {
              // likely a trap — don't alert
              continue;
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
      this.stats.lastNearMiss = found.length ? undefined : nearMiss;
      found.sort((a, b) => b.score - a.score);
      for (const s of found) {
        this.stats.signalsTotal++;
        this.tracker.track(s, s.at);
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

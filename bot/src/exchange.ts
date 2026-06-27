import ccxt, { type Exchange } from "ccxt";
import type { Candle, OHLCV, TickerLite } from "./types.js";
import { toCandles } from "./indicators.js";
import { log } from "./logger.js";

export class Market {
  private ex: Exchange;
  private symbols: string[] = [];

  constructor(exchangeId: string, private quote: string) {
    const factory = (ccxt as unknown as Record<string, new (cfg: object) => Exchange>)[exchangeId];
    if (!factory) {
      throw new Error(`Unknown exchange "${exchangeId}". See https://docs.ccxt.com for supported ids.`);
    }
    this.ex = new factory({ enableRateLimit: true, options: { defaultType: "spot" } });
  }

  get id() {
    return this.ex.id;
  }

  /** Load spot markets quoted in the configured currency, active only. */
  async loadSymbols(): Promise<string[]> {
    const markets = await this.ex.loadMarkets();
    this.symbols = Object.values(markets)
      .filter((m: any) => m && m.active !== false && m.spot && m.quote === this.quote)
      .map((m: any) => m.symbol as string);
    log.info(`Loaded ${this.symbols.length} ${this.quote} spot markets on ${this.ex.id}`);
    return this.symbols;
  }

  /** Fetch all tickers once and normalise to a lightweight shape. */
  async fetchTickers(): Promise<TickerLite[]> {
    const raw = await this.ex.fetchTickers(this.symbols.length ? this.symbols : undefined);
    const out: TickerLite[] = [];
    for (const [symbol, ti] of Object.entries(raw)) {
      const t = ti as any;
      if (this.quote && !symbol.endsWith(`/${this.quote}`)) continue;
      const last = Number(t.last ?? t.close ?? 0);
      if (!last) continue;
      out.push({
        symbol,
        last,
        percentage: Number(t.percentage ?? 0),
        quoteVolume: Number(t.quoteVolume ?? (t.baseVolume ?? 0) * last),
      });
    }
    return out;
  }

  /** Fetch recent 1m candles for one symbol. */
  async fetchCandles(symbol: string, limit = 60): Promise<Candle[]> {
    const rows = (await this.ex.fetchOHLCV(symbol, "1m", undefined, limit)) as OHLCV[];
    return toCandles(rows);
  }

  chartUrl(symbol: string): string {
    const pair = symbol.replace("/", "");
    if (this.ex.id === "binance") return `https://www.binance.com/en/trade/${symbol.replace("/", "_")}`;
    return `https://www.tradingview.com/chart/?symbol=${this.ex.id.toUpperCase()}:${pair}`;
  }
}

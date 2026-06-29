import ccxt, { type Exchange } from "ccxt";
import type { BookSnapshot, Candle, OHLCV, TickerLite } from "./types.js";
import { toCandles } from "./indicators.js";
import { log } from "./logger.js";

export class Market {
  private ex: Exchange;
  private symbols: string[] = [];

  private symbolSet = new Set<string>();

  constructor(
    exchangeId: string,
    private quote: string,
    private marketType: "spot" | "swap" = "spot",
  ) {
    const factory = (ccxt as unknown as Record<string, new (cfg: object) => Exchange>)[exchangeId];
    if (!factory) {
      throw new Error(`Unknown exchange "${exchangeId}". See https://docs.ccxt.com for supported ids.`);
    }
    this.ex = new factory({ enableRateLimit: true, options: { defaultType: marketType } });
  }

  get id() {
    return this.ex.id;
  }

  /** Load markets of the configured type (spot or linear-USDT swap), active only. */
  async loadSymbols(): Promise<string[]> {
    const markets = await this.ex.loadMarkets();
    const all = Object.values(markets) as any[];

    let matched: any[];
    if (this.marketType === "swap") {
      // Linear USDT-margined perpetuals: symbols look like "BTC/USDT:USDT".
      matched = all.filter(
        (m) =>
          m &&
          m.active !== false &&
          (m.swap === true || m.type === "swap") &&
          m.linear !== false &&
          (m.settle === this.quote || m.quote === this.quote),
      );
    } else {
      matched = all.filter((m) => m && m.active !== false && (m.spot === true || m.type === "spot") && m.quote === this.quote);
      // Fallback for exchanges that don't flag spot consistently.
      if (matched.length === 0) {
        matched = all.filter(
          (m) => m && m.active !== false && !m.contract && typeof m.symbol === "string" && m.symbol.endsWith(`/${this.quote}`),
        );
      }
    }

    this.symbols = matched.map((m) => m.symbol as string);
    this.symbolSet = new Set(this.symbols);

    log.info(`Loaded ${this.symbols.length} ${this.quote} ${this.marketType} markets on ${this.ex.id} (of ${all.length} total)`);
    if (this.symbols.length === 0) {
      throw new Error(
        `0 ${this.quote} ${this.marketType} markets matched on ${this.ex.id} (loaded ${all.length}). Check MARKET_TYPE/QUOTE_CURRENCY or try another EXCHANGE.`,
      );
    }
    return this.symbols;
  }

  /** Fetch all tickers once and normalise to a lightweight shape. */
  async fetchTickers(): Promise<TickerLite[]> {
    const raw = await this.ex.fetchTickers(this.symbols.length ? this.symbols : undefined);
    const out: TickerLite[] = [];
    for (const [symbol, ti] of Object.entries(raw)) {
      const t = ti as any;
      if (this.symbolSet.size && !this.symbolSet.has(symbol)) continue;
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

  /** Fetch a single ticker on demand (for /risk lookups). */
  async fetchTicker(symbol: string): Promise<TickerLite | null> {
    try {
      const t = (await this.ex.fetchTicker(symbol)) as any;
      const last = Number(t.last ?? t.close ?? 0);
      if (!last) return null;
      return {
        symbol,
        last,
        percentage: Number(t.percentage ?? 0),
        quoteVolume: Number(t.quoteVolume ?? (t.baseVolume ?? 0) * last),
      };
    } catch {
      return null;
    }
  }

  /** Does this symbol exist on the exchange? */
  hasSymbol(symbol: string): boolean {
    return this.symbols.includes(symbol);
  }

  /** Whether markets have been loaded yet. */
  get loaded(): boolean {
    return this.symbols.length > 0;
  }

  /** Fetch recent 1m candles for one symbol. */
  async fetchCandles(symbol: string, limit = 60): Promise<Candle[]> {
    const rows = (await this.ex.fetchOHLCV(symbol, "1m", undefined, limit)) as OHLCV[];
    return toCandles(rows);
  }

  /** Order-book snapshot for buy-pressure + risk analysis. */
  async fetchBook(symbol: string, depth = 20): Promise<BookSnapshot | null> {
    try {
      const ob = await this.ex.fetchOrderBook(symbol, depth);
      const bids = ob.bids ?? [];
      const asks = ob.asks ?? [];
      const bidVol = bids.reduce((a, b) => a + (Number(b[1]) || 0), 0);
      const askVol = asks.reduce((a, b) => a + (Number(b[1]) || 0), 0);
      return {
        bestBid: Number(bids[0]?.[0]) || 0,
        bestAsk: Number(asks[0]?.[0]) || 0,
        bidVol,
        askVol,
        levels: Math.min(bids.length, asks.length),
      };
    } catch {
      return null;
    }
  }

  /** Direct trade page on the exchange (spot or futures) for this symbol. */
  tradeUrl(symbol: string): string {
    // perp symbols are "BASE/USDT:USDT" — strip the settle suffix
    const base = symbol.split("/")[0] ?? symbol;
    const quote = (symbol.split("/")[1] ?? "USDT").split(":")[0] ?? "USDT";
    if (this.marketType === "swap") {
      switch (this.ex.id) {
        case "binance":
          return `https://www.binance.com/en/futures/${base}${quote}`;
        case "bybit":
          return `https://www.bybit.com/trade/usdt/${base}${quote}`;
        case "kucoin":
          return `https://www.kucoin.com/futures/trade/${base}${quote}M`;
        case "okx":
          return `https://www.okx.com/trade-swap/${base.toLowerCase()}-${quote.toLowerCase()}-swap`;
        case "mexc":
          return `https://futures.mexc.com/exchange/${base}_${quote}`;
        case "gateio":
          return `https://www.gate.io/futures/USDT/${base}_${quote}`;
        default:
          return `https://www.tradingview.com/chart/?symbol=${this.ex.id.toUpperCase()}:${base}${quote}.P`;
      }
    }
    switch (this.ex.id) {
      case "binance":
        return `https://www.binance.com/en/trade/${base}_${quote}`;
      case "bybit":
        return `https://www.bybit.com/en/trade/spot/${base}/${quote}`;
      case "kucoin":
        return `https://www.kucoin.com/trade/${base}-${quote}`;
      case "okx":
        return `https://www.okx.com/trade-spot/${base.toLowerCase()}-${quote.toLowerCase()}`;
      case "mexc":
        return `https://www.mexc.com/exchange/${base}_${quote}`;
      case "gateio":
        return `https://www.gate.io/trade/${base}_${quote}`;
      default:
        return `https://www.tradingview.com/chart/?symbol=${this.ex.id.toUpperCase()}:${base}${quote}`;
    }
  }

  /** Dex Screener search for the base token (works for most listed coins). */
  dexScreenerUrl(symbol: string): string {
    const base = symbol.split("/")[0] ?? symbol;
    return `https://dexscreener.com/search?q=${encodeURIComponent(base)}`;
  }

  /** Back-compat alias. */
  chartUrl(symbol: string): string {
    return this.tradeUrl(symbol);
  }
}

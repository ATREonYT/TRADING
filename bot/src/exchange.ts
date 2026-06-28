import ccxt, { type Exchange } from "ccxt";
import type { BookSnapshot, Candle, OHLCV, TickerLite } from "./types.js";
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
    const all = Object.values(markets) as any[];
    const isSpot = (m: any) => m.spot === true || m.type === "spot";
    this.symbols = all
      .filter((m) => m && m.active !== false && isSpot(m) && m.quote === this.quote)
      .map((m) => m.symbol as string);

    // Fallback: some exchanges don't flag spot consistently — match by symbol suffix.
    if (this.symbols.length === 0) {
      this.symbols = all
        .filter((m) => m && m.active !== false && !m.contract && typeof m.symbol === "string" && m.symbol.endsWith(`/${this.quote}`))
        .map((m) => m.symbol as string);
    }

    log.info(`Loaded ${this.symbols.length} ${this.quote} spot markets on ${this.ex.id} (of ${all.length} total)`);
    if (this.symbols.length === 0) {
      throw new Error(
        `0 ${this.quote} spot markets matched on ${this.ex.id} (loaded ${all.length} markets). Check QUOTE_CURRENCY or try EXCHANGE=kucoin.`,
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

  /** Direct trade/buy page on the exchange for this symbol. */
  tradeUrl(symbol: string): string {
    const base = symbol.split("/")[0] ?? symbol;
    const quote = symbol.split("/")[1] ?? "USDT";
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

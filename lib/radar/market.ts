import type { Quote } from "./types";
import { CRYPTO_UNIVERSE, EQUITY_UNIVERSE } from "./sources";

// Live market data from public, keyless endpoints:
//  - Equities: Yahoo Finance chart API (price history + volume)
//  - Crypto:   Binance klines (OHLCV)
// Both are fetched server-side with per-request timeouts and a concurrency cap.

const CRYPTO_NAMES: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", BNB: "BNB", XRP: "XRP",
  DOGE: "Dogecoin", ADA: "Cardano", AVAX: "Avalanche", LINK: "Chainlink",
  MATIC: "Polygon", DOT: "Polkadot", LTC: "Litecoin", TRX: "TRON",
  SHIB: "Shiba Inu", NEAR: "NEAR", APT: "Aptos", ARB: "Arbitrum", OP: "Optimism",
  INJ: "Injective", SUI: "Sui", TIA: "Celestia", SEI: "Sei", RNDR: "Render",
  FET: "Fetch.ai",
};

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

/** Map with a bounded number of in-flight promises. */
async function pooled<I, O>(items: I[], limit: number, fn: (i: I) => Promise<O>): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      try {
        out[cur] = await fn(items[cur]);
      } catch {
        out[cur] = undefined as unknown as O;
      }
    }
  });
  await Promise.all(workers);
  return out.filter((x) => x !== undefined);
}

const UA = { "User-Agent": "Mozilla/5.0 (compatible; HelixRadar/1.0)" };
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

// ---- Equities (Yahoo Finance) ------------------------------------------------

async function equityQuote(symbol: string): Promise<Quote | undefined> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`;
  const json = await withTimeout(
    async (signal) => {
      const r = await fetch(url, { signal, headers: UA, cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    8000,
  );
  const result = json?.chart?.result?.[0];
  if (!result) return undefined;
  const meta = result.meta ?? {};
  const closes: number[] = (result.indicators?.quote?.[0]?.close ?? []).filter(
    (v: number | null): v is number => typeof v === "number",
  );
  const vols: number[] = (result.indicators?.quote?.[0]?.volume ?? []).filter(
    (v: number | null): v is number => typeof v === "number",
  );
  const price = meta.regularMarketPrice ?? closes[closes.length - 1];
  const prev = meta.chartPreviousClose ?? closes[closes.length - 2] ?? price;
  if (typeof price !== "number") return undefined;

  const lastVol = vols[vols.length - 1] ?? 0;
  const baseVol = avg(vols.slice(-21, -1)); // ~20 sessions before today
  return {
    symbol,
    name: meta.shortName ?? symbol,
    kind: "equity",
    price,
    changePct: prev ? ((price - prev) / prev) * 100 : 0,
    volumeRatio: baseVol ? (lastVol / baseVol) * 100 : null,
    spark: closes.slice(-30),
    currency: meta.currency ?? "USD",
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchEquityQuotes(
  symbols: string[] = EQUITY_UNIVERSE,
): Promise<Quote[]> {
  return pooled(symbols, 6, equityQuote).then((q) => q.filter(Boolean) as Quote[]);
}

// ---- Crypto (Binance) --------------------------------------------------------

async function cryptoQuote(pair: string): Promise<Quote | undefined> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1h&limit=48`;
  const rows: [number, string, string, string, string, string][] = await withTimeout(
    async (signal) => {
      const r = await fetch(url, { signal, headers: UA, cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    8000,
  );
  if (!Array.isArray(rows) || rows.length < 25) return undefined;
  const closes = rows.map((k) => Number(k[4]));
  const vols = rows.map((k) => Number(k[5]));
  const price = closes[closes.length - 1];
  const prev24 = closes[closes.length - 25]; // 24h ago
  const base = pair.replace(/USDT$/, "");
  const recentVol = avg(vols.slice(-6));
  const baseVol = avg(vols.slice(-30, -6));
  return {
    symbol: `${base}-USD`,
    name: CRYPTO_NAMES[base] ?? base,
    kind: "crypto",
    price,
    changePct: prev24 ? ((price - prev24) / prev24) * 100 : 0,
    volumeRatio: baseVol ? (recentVol / baseVol) * 100 : null,
    spark: closes.slice(-30),
    currency: "USD",
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchCryptoQuotes(
  pairs: string[] = CRYPTO_UNIVERSE,
): Promise<Quote[]> {
  return pooled(pairs, 8, cryptoQuote).then((q) => q.filter(Boolean) as Quote[]);
}

export async function fetchAllQuotes(): Promise<{ quotes: Quote[]; failed: boolean }> {
  const [eq, cx] = await Promise.allSettled([fetchEquityQuotes(), fetchCryptoQuotes()]);
  const quotes: Quote[] = [];
  if (eq.status === "fulfilled") quotes.push(...eq.value);
  if (cx.status === "fulfilled") quotes.push(...cx.value);
  return { quotes, failed: quotes.length === 0 };
}

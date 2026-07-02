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

// Yahoo rate-limits datacenter IPs on query1 at times; query2 is a mirror.
async function yahooChart(symbol: string): Promise<any> {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`;
  let lastErr: Error = new Error("yahoo unreachable");
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      return await withTimeout(async (signal) => {
        const r = await fetch(`https://${host}${path}`, { signal, headers: UA, cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }, 8000);
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr;
}

async function equityQuote(symbol: string): Promise<Quote | undefined> {
  const json = await yahooChart(symbol);
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
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=1h&limit=48`;
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

// OKX fallback for hosts where Binance geo-blocks (HTTP 451 on many cloud IPs).
// Same OHLCV shape, different envelope: data rows are newest-first strings.
async function okxQuote(pair: string): Promise<Quote | undefined> {
  const base = pair.replace(/USDT$/, "");
  const url = `https://www.okx.com/api/v5/market/candles?instId=${encodeURIComponent(`${base}-USDT`)}&bar=1H&limit=48`;
  const json = await withTimeout(
    async (signal) => {
      const r = await fetch(url, { signal, headers: UA, cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    8000,
  );
  const rows: string[][] = json?.data;
  if (!Array.isArray(rows) || rows.length < 25) return undefined;
  const asc = [...rows].reverse();
  const closes = asc.map((k) => Number(k[4]));
  const vols = asc.map((k) => Number(k[5]));
  const price = closes[closes.length - 1];
  const prev24 = closes[closes.length - 25];
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
  const binance = (await pooled(pairs, 8, cryptoQuote)).filter(Boolean) as Quote[];
  if (binance.length > 0) return binance;
  // Whole-batch fallback: if Binance yielded nothing (geo-block/outage), try OKX.
  return (await pooled(pairs, 8, okxQuote)).filter(Boolean) as Quote[];
}

export async function fetchAllQuotes(): Promise<{ quotes: Quote[]; failed: boolean }> {
  const [eq, cx] = await Promise.allSettled([fetchEquityQuotes(), fetchCryptoQuotes()]);
  const quotes: Quote[] = [];
  if (eq.status === "fulfilled") quotes.push(...eq.value);
  if (cx.status === "fulfilled") quotes.push(...cx.value);
  return { quotes, failed: quotes.length === 0 };
}

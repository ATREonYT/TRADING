// Global symbol search across every exchange Yahoo Finance covers (NYSE,
// NASDAQ, HKEX, LSE, Tokyo, Frankfurt, …). Matches company names as well as
// tickers, and returns each listing separately so the user can pick the
// exchange (e.g. Alibaba → BABA on NYSE and 9988.HK on HKEX).

import { isValidSymbol } from "./validate";
import { searchCatalog } from "../symbolCatalog";

export interface SearchResult {
  symbol: string;
  name: string;
  /** Human-readable exchange, e.g. "NYSE", "Hong Kong", "London" */
  exchange: string;
  kind: "equity" | "crypto" | "etf" | "fund";
}

const KIND_MAP: Record<string, SearchResult["kind"]> = {
  EQUITY: "equity",
  ETF: "etf",
  MUTUALFUND: "fund",
  CRYPTOCURRENCY: "crypto",
};

/** Map Yahoo's search payload into clean results (pure — unit tested). */
export function mapYahooSearch(json: any, limit = 10): SearchResult[] {
  const quotes: any[] = Array.isArray(json?.quotes) ? json.quotes : [];
  const out: SearchResult[] = [];
  for (const q of quotes) {
    const kind = KIND_MAP[q?.quoteType as string];
    if (!kind) continue; // skip indices, futures, options, forex
    const symbol = String(q.symbol ?? "").toUpperCase();
    if (!isValidSymbol(symbol)) continue; // drops ^GSPC, EURUSD=X, hostile junk
    const name = String(q.shortname ?? q.longname ?? symbol).slice(0, 80);
    const exchange = String(q.exchDisp ?? q.exchange ?? "").slice(0, 40);
    out.push({ symbol, name, exchange, kind });
    if (out.length >= limit) break;
  }
  return out;
}

// Tiny TTL cache so fast typers don't hammer Yahoo (server-side, per query).
const cache = new Map<string, { at: number; items: SearchResult[] }>();
const CACHE_MS = 60_000;

export async function searchSymbols(query: string, limit = 10): Promise<{ items: SearchResult[]; degraded: boolean }> {
  const q = query.trim().slice(0, 60);
  if (!q) return { items: [], degraded: false };

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { items: hit.items.slice(0, limit), degraded: false };

  const path = `/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=${limit + 6}&newsCount=0&listsCount=0`;
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`https://${host}${path}`, {
        signal: ctrl.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; HelixRadar/1.0)" },
        cache: "no-store",
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const items = mapYahooSearch(await res.json(), limit);
      if (items.length > 0) cache.set(key, { at: Date.now(), items });
      return { items, degraded: false };
    } catch {
      /* try next host */
    }
  }

  // Offline / blocked: fall back to the built-in catalog (name search works).
  const items: SearchResult[] = searchCatalog(q, limit).map((e) => ({
    symbol: e.symbol,
    name: e.name,
    exchange: e.kind === "crypto" ? "Crypto" : "US",
    kind: e.kind,
  }));
  return { items, degraded: true };
}

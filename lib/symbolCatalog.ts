// A curated catalog of well-known instruments powering the ⌘K command palette
// and quick search. Kept static so search works instantly with no network.

export interface CatalogEntry {
  symbol: string;
  name: string;
  kind: "equity" | "crypto";
}

export const SYMBOL_CATALOG: CatalogEntry[] = [
  // Mega-cap tech
  { symbol: "NVDA", name: "NVIDIA", kind: "equity" },
  { symbol: "AAPL", name: "Apple", kind: "equity" },
  { symbol: "MSFT", name: "Microsoft", kind: "equity" },
  { symbol: "AMZN", name: "Amazon", kind: "equity" },
  { symbol: "GOOGL", name: "Alphabet", kind: "equity" },
  { symbol: "META", name: "Meta Platforms", kind: "equity" },
  { symbol: "TSLA", name: "Tesla", kind: "equity" },
  // Semis
  { symbol: "AMD", name: "Advanced Micro Devices", kind: "equity" },
  { symbol: "AVGO", name: "Broadcom", kind: "equity" },
  { symbol: "MU", name: "Micron", kind: "equity" },
  { symbol: "INTC", name: "Intel", kind: "equity" },
  { symbol: "QCOM", name: "Qualcomm", kind: "equity" },
  { symbol: "ARM", name: "Arm Holdings", kind: "equity" },
  { symbol: "SMCI", name: "Super Micro", kind: "equity" },
  { symbol: "TSM", name: "TSMC", kind: "equity" },
  { symbol: "ASML", name: "ASML", kind: "equity" },
  // Software / growth
  { symbol: "PLTR", name: "Palantir", kind: "equity" },
  { symbol: "CRM", name: "Salesforce", kind: "equity" },
  { symbol: "ORCL", name: "Oracle", kind: "equity" },
  { symbol: "SNOW", name: "Snowflake", kind: "equity" },
  { symbol: "NFLX", name: "Netflix", kind: "equity" },
  { symbol: "SHOP", name: "Shopify", kind: "equity" },
  { symbol: "UBER", name: "Uber", kind: "equity" },
  { symbol: "ABNB", name: "Airbnb", kind: "equity" },
  // Finance / crypto-adjacent
  { symbol: "JPM", name: "JPMorgan", kind: "equity" },
  { symbol: "BAC", name: "Bank of America", kind: "equity" },
  { symbol: "COIN", name: "Coinbase", kind: "equity" },
  { symbol: "MSTR", name: "MicroStrategy", kind: "equity" },
  { symbol: "SOFI", name: "SoFi", kind: "equity" },
  { symbol: "PYPL", name: "PayPal", kind: "equity" },
  // Other majors
  { symbol: "XOM", name: "ExxonMobil", kind: "equity" },
  { symbol: "CVX", name: "Chevron", kind: "equity" },
  { symbol: "LLY", name: "Eli Lilly", kind: "equity" },
  { symbol: "UNH", name: "UnitedHealth", kind: "equity" },
  { symbol: "WMT", name: "Walmart", kind: "equity" },
  { symbol: "COST", name: "Costco", kind: "equity" },
  { symbol: "DIS", name: "Disney", kind: "equity" },
  { symbol: "BA", name: "Boeing", kind: "equity" },
  // Crypto
  { symbol: "BTC-USD", name: "Bitcoin", kind: "crypto" },
  { symbol: "ETH-USD", name: "Ethereum", kind: "crypto" },
  { symbol: "SOL-USD", name: "Solana", kind: "crypto" },
  { symbol: "BNB-USD", name: "BNB", kind: "crypto" },
  { symbol: "XRP-USD", name: "XRP", kind: "crypto" },
  { symbol: "DOGE-USD", name: "Dogecoin", kind: "crypto" },
  { symbol: "ADA-USD", name: "Cardano", kind: "crypto" },
  { symbol: "AVAX-USD", name: "Avalanche", kind: "crypto" },
  { symbol: "LINK-USD", name: "Chainlink", kind: "crypto" },
  { symbol: "MATIC-USD", name: "Polygon", kind: "crypto" },
];

/** Look up a catalog entry by symbol, tolerant of the -USD crypto suffix. */
export function lookupSymbol(symbol: string): CatalogEntry {
  const up = symbol.toUpperCase();
  const found =
    SYMBOL_CATALOG.find((e) => e.symbol === up) ??
    SYMBOL_CATALOG.find((e) => e.symbol.replace(/-USD$/, "") === up.replace(/-USD$/, ""));
  if (found) return found;
  const isCrypto = /-USD$/.test(up);
  return { symbol: up, name: up.replace(/-USD$/, ""), kind: isCrypto ? "crypto" : "equity" };
}

/** Simple case-insensitive subsequence/substring match, ranked. */
export function searchCatalog(query: string, limit = 8): CatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return SYMBOL_CATALOG.slice(0, limit);
  const scored = SYMBOL_CATALOG.map((e) => {
    const sym = e.symbol.toLowerCase();
    const name = e.name.toLowerCase();
    let score = 0;
    if (sym === q || sym === `${q}-usd`) score = 100;
    else if (sym.startsWith(q)) score = 80;
    else if (name.startsWith(q)) score = 60;
    else if (sym.includes(q)) score = 40;
    else if (name.includes(q)) score = 30;
    return { e, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.e);
}

import type { NewsCategory } from "./types";

// Public RSS/Atom feeds that require no API key. Google News feeds act as a
// search across "the whole internet" for a topic; direct outlet feeds add
// depth. Everything here is fetched server-side at runtime.

export interface FeedSource {
  name: string;
  url: string;
  category: NewsCategory;
}

const gnews = (query: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(
    query,
  )}&hl=en-US&gl=US&ceid=US:en`;

export const FEEDS: FeedSource[] = [
  // Broad market + economy (search-the-internet feeds)
  { name: "Google News · Markets", url: gnews("stock market when:1d"), category: "equities" },
  { name: "Google News · Earnings", url: gnews("earnings OR guidance when:1d"), category: "equities" },
  { name: "Google News · Fed / Rates", url: gnews("Federal Reserve OR interest rates OR inflation when:1d"), category: "macro" },
  { name: "Google News · Crypto", url: gnews("bitcoin OR ethereum OR crypto when:1d"), category: "crypto" },
  { name: "Google News · Geopolitics", url: gnews("war OR sanctions OR OPEC OR tariffs when:1d"), category: "geopolitics" },
  { name: "Google News · Commodities", url: gnews("oil price OR gold price OR natural gas when:1d"), category: "commodities" },
  { name: "Google News · Big Tech", url: gnews("Nvidia OR Apple OR Microsoft OR Tesla OR AI chips when:1d"), category: "tech" },
  { name: "Google News · M&A / Deals", url: gnews("merger OR acquisition OR buyout OR IPO when:1d"), category: "equities" },

  // Direct financial outlets (RSS, no key)
  { name: "CNBC · Top News", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", category: "general" },
  { name: "CNBC · Markets", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839135", category: "equities" },
  { name: "MarketWatch · Top", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", category: "equities" },
  { name: "MarketWatch · Real-time", url: "https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines", category: "equities" },
  { name: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex", category: "equities" },
  { name: "Investing.com · News", url: "https://www.investing.com/rss/news.rss", category: "general" },
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", category: "crypto" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss", category: "crypto" },
];

// A liquid universe scanned for price/volume signals when a full market
// screener is unavailable. Kept intentionally broad but well-known.
export const EQUITY_UNIVERSE = [
  "NVDA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "TSLA", "AMD", "AVGO", "NFLX",
  "JPM", "BAC", "XOM", "CVX", "UNH", "LLY", "COST", "WMT", "PLTR", "SMCI",
  "MU", "INTC", "CRM", "ORCL", "QCOM", "ARM", "COIN", "MSTR", "SOFI", "MARA",
  "BA", "DIS", "PYPL", "SHOP", "UBER", "ABNB", "SNOW", "DELL", "TSM", "ASML",
];

// Crypto pairs (Binance symbols) to scan for spikes.
export const CRYPTO_UNIVERSE = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT",
  "ADAUSDT", "AVAXUSDT", "LINKUSDT", "MATICUSDT", "DOTUSDT", "LTCUSDT",
  "TRXUSDT", "SHIBUSDT", "NEARUSDT", "APTUSDT", "ARBUSDT", "OPUSDT",
  "INJUSDT", "SUIUSDT", "TIAUSDT", "SEIUSDT", "RNDRUSDT", "FETUSDT",
];

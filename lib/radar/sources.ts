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

// Google News search restricted to a single outlet — used for major outlets
// that no longer publish an open RSS feed (Reuters, Bloomberg, FT, AP…).
const gsite = (domain: string, extra = "business OR markets") =>
  gnews(`site:${domain} ${extra} when:1d`);

export const FEEDS: FeedSource[] = [
  // ── Topic search feeds (scan the whole web by subject) ──────────────────
  { name: "Google News · Markets", url: gnews("stock market when:1d"), category: "equities" },
  { name: "Google News · Earnings", url: gnews("earnings OR guidance OR results when:1d"), category: "equities" },
  { name: "Google News · Fed / Rates", url: gnews("Federal Reserve OR interest rates OR inflation OR CPI when:1d"), category: "macro" },
  { name: "Google News · Economy", url: gnews("economy OR GDP OR jobs report OR recession when:1d"), category: "macro" },
  { name: "Google News · Crypto", url: gnews("bitcoin OR ethereum OR crypto when:1d"), category: "crypto" },
  { name: "Google News · Geopolitics", url: gnews("war OR sanctions OR OPEC OR tariffs OR election when:1d"), category: "geopolitics" },
  { name: "Google News · Commodities", url: gnews("oil price OR gold price OR natural gas OR copper when:1d"), category: "commodities" },
  { name: "Google News · Big Tech", url: gnews("Nvidia OR Apple OR Microsoft OR Tesla OR AI chips when:1d"), category: "tech" },
  { name: "Google News · M&A / IPO", url: gnews("merger OR acquisition OR buyout OR IPO when:1d"), category: "equities" },

  // ── Major wires & papers (via Google News site search) ──────────────────
  { name: "Reuters", url: gsite("reuters.com"), category: "general" },
  { name: "Bloomberg", url: gsite("bloomberg.com"), category: "general" },
  { name: "Associated Press", url: gsite("apnews.com"), category: "general" },
  { name: "Financial Times", url: gsite("ft.com"), category: "general" },
  { name: "The Economist", url: gsite("economist.com", "economy OR finance"), category: "macro" },
  { name: "Barron's", url: gsite("barrons.com"), category: "equities" },
  { name: "Morningstar", url: gsite("morningstar.com", "stocks OR funds"), category: "equities" },
  { name: "Nikkei Asia", url: gsite("asia.nikkei.com"), category: "general" },
  { name: "South China Morning Post", url: gsite("scmp.com", "economy OR markets"), category: "general" },

  // ── CNBC (multiple desks) ───────────────────────────────────────────────
  { name: "CNBC · Top News", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", category: "general" },
  { name: "CNBC · Markets", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839135", category: "equities" },
  { name: "CNBC · Finance", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664", category: "equities" },
  { name: "CNBC · Economy", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258", category: "macro" },
  { name: "CNBC · Investing", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069", category: "equities" },
  { name: "CNBC · Technology", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910", category: "tech" },

  // ── MarketWatch (Dow Jones) ─────────────────────────────────────────────
  { name: "MarketWatch · Top", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", category: "equities" },
  { name: "MarketWatch · Real-time", url: "https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines", category: "equities" },
  { name: "MarketWatch · Market Pulse", url: "https://feeds.content.dowjones.io/public/rss/mw_marketpulse", category: "equities" },
  { name: "MarketWatch · Bulletins", url: "https://feeds.content.dowjones.io/public/rss/mw_bulletins", category: "equities" },

  // ── Wall Street Journal (Dow Jones public feeds) ────────────────────────
  { name: "WSJ · Markets", url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml", category: "equities" },
  { name: "WSJ · Business", url: "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml", category: "general" },
  { name: "WSJ · World", url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml", category: "geopolitics" },

  // ── Other financial outlets (direct RSS) ────────────────────────────────
  { name: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex", category: "equities" },
  { name: "Investing.com · News", url: "https://www.investing.com/rss/news.rss", category: "general" },
  { name: "Investing.com · Stocks", url: "https://www.investing.com/rss/news_25.rss", category: "equities" },
  { name: "Investing.com · Economy", url: "https://www.investing.com/rss/news_14.rss", category: "macro" },
  { name: "Business Insider · Markets", url: "https://markets.businessinsider.com/rss/news", category: "equities" },
  { name: "Seeking Alpha", url: "https://seekingalpha.com/market_currents.xml", category: "equities" },
  { name: "Forbes · Money", url: "https://www.forbes.com/money/feed/", category: "general" },
  { name: "Forbes · Investing", url: "https://www.forbes.com/investing/feed/", category: "equities" },
  { name: "Fortune", url: "https://fortune.com/feed/", category: "general" },
  { name: "Fox Business · Markets", url: "https://moxie.foxbusiness.com/google-publisher/markets.xml", category: "equities" },
  { name: "Fox Business · Latest", url: "https://moxie.foxbusiness.com/google-publisher/latest.xml", category: "general" },
  { name: "Financial Post", url: "https://financialpost.com/feed", category: "general" },
  { name: "Benzinga", url: "https://www.benzinga.com/feed", category: "equities" },
  { name: "TheStreet", url: "https://www.thestreet.com/.rss/full/", category: "equities" },
  { name: "Kiplinger", url: "https://www.kiplinger.com/feed/all", category: "equities" },

  // ── World / general news desks ──────────────────────────────────────────
  { name: "BBC · Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "general" },
  { name: "BBC · World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", category: "geopolitics" },
  { name: "The Guardian · Business", url: "https://www.theguardian.com/business/rss", category: "general" },
  { name: "The Guardian · World", url: "https://www.theguardian.com/world/rss", category: "geopolitics" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", category: "geopolitics" },
  { name: "NYT · Business", url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", category: "general" },
  { name: "NYT · Economy", url: "https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml", category: "macro" },
  { name: "NYT · World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", category: "geopolitics" },
  { name: "NPR · Business", url: "https://feeds.npr.org/1006/rss.xml", category: "general" },
  { name: "Sky News · Business", url: "https://feeds.skynews.com/feeds/rss/business.xml", category: "general" },

  // ── Commodities & energy ────────────────────────────────────────────────
  { name: "OilPrice.com", url: "https://oilprice.com/rss/main", category: "commodities" },
  { name: "Google News · Gold/Metals", url: gnews("gold OR silver OR copper price forecast when:1d"), category: "commodities" },

  // ── Crypto desks ────────────────────────────────────────────────────────
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", category: "crypto" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss", category: "crypto" },
  { name: "Decrypt", url: "https://decrypt.co/feed", category: "crypto" },
  { name: "The Block", url: "https://www.theblock.co/rss.xml", category: "crypto" },
  { name: "CryptoSlate", url: "https://cryptoslate.com/feed/", category: "crypto" },
  { name: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/.rss/full/", category: "crypto" },
  { name: "CryptoPotato", url: "https://cryptopotato.com/feed/", category: "crypto" },
  { name: "Bitcoinist", url: "https://bitcoinist.com/feed/", category: "crypto" },
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

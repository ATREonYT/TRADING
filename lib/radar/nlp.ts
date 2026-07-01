import type { NewsCategory, NewsItem, Sentiment } from "./types";
import type { RawArticle } from "./rss";

// Lightweight, transparent NLP: a finance-tuned sentiment lexicon, an
// impact/urgency scorer, and a company->ticker resolver. No black boxes — a
// trader can read exactly why a headline scored the way it did.

const POSITIVE: Record<string, number> = {
  surge: 3, surges: 3, soar: 3, soars: 3, rally: 3, rallies: 3, jump: 2, jumps: 2,
  beat: 3, beats: 3, tops: 2, upgrade: 3, upgraded: 3, bullish: 3, record: 2,
  gain: 2, gains: 2, rise: 2, rises: 2, climb: 2, climbs: 2, boom: 3, boost: 2,
  outperform: 3, breakthrough: 3, approval: 3, approved: 2, wins: 2, profit: 2,
  growth: 2, strong: 2, higher: 1, rebound: 3, buyback: 2, dividend: 1, raises: 2,
  optimistic: 2, upbeat: 2, expansion: 2, "all-time high": 4, partnership: 1,
};

const NEGATIVE: Record<string, number> = {
  plunge: 3, plunges: 3, crash: 4, crashes: 4, tumble: 3, tumbles: 3, slump: 3,
  miss: 3, misses: 3, downgrade: 3, downgraded: 3, bearish: 3, selloff: 3,
  "sell-off": 3, fall: 2, falls: 2, drop: 2, drops: 2, slide: 2, slides: 2,
  loss: 2, losses: 2, cut: 2, cuts: 2, warning: 3, warns: 3, lawsuit: 2,
  probe: 2, investigation: 2, bankruptcy: 4, default: 3, recession: 4, fear: 2,
  fears: 2, weak: 2, lower: 1, layoffs: 3, fraud: 4, halt: 3, halted: 3,
  sanctions: 2, tariffs: 2, war: 2, collapse: 4, delisting: 3, slashes: 3,
};

const IMPACT_WORDS = [
  "fed", "federal reserve", "rate", "inflation", "cpi", "jobs report", "gdp",
  "earnings", "guidance", "sec", "lawsuit", "merger", "acquisition", "ipo",
  "bankruptcy", "war", "sanctions", "tariff", "opec", "recession", "default",
  "halt", "recall", "breach", "hack", "outage", "downgrade", "upgrade",
];

// Company / asset name -> canonical symbol used across the app.
const NAME_TO_SYMBOL: Record<string, string> = {
  nvidia: "NVDA", apple: "AAPL", microsoft: "MSFT", amazon: "AMZN", meta: "META",
  facebook: "META", google: "GOOGL", alphabet: "GOOGL", tesla: "TSLA", amd: "AMD",
  broadcom: "AVGO", netflix: "NFLX", jpmorgan: "JPM", "bank of america": "BAC",
  exxon: "XOM", chevron: "CVX", unitedhealth: "UNH", "eli lilly": "LLY",
  costco: "COST", walmart: "WMT", palantir: "PLTR", "super micro": "SMCI",
  micron: "MU", intel: "INTC", salesforce: "CRM", oracle: "ORCL", qualcomm: "QCOM",
  arm: "ARM", coinbase: "COIN", microstrategy: "MSTR", strategy: "MSTR",
  boeing: "BA", disney: "DIS", paypal: "PYPL", shopify: "SHOP", uber: "UBER",
  airbnb: "ABNB", snowflake: "SNOW", dell: "DELL", tsmc: "TSM", asml: "ASML",
  bitcoin: "BTC-USD", ethereum: "ETH-USD", solana: "SOL-USD", ripple: "XRP-USD",
  dogecoin: "DOGE-USD", cardano: "ADA-USD", avalanche: "AVAX-USD",
  chainlink: "LINK-USD", polkadot: "DOT-USD", litecoin: "LTC-USD",
};

const CRYPTO_TICKERS = new Set([
  "BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "AVAX", "LINK", "DOT", "LTC", "BNB",
]);

function extractSymbols(text: string): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();

  for (const [name, sym] of Object.entries(NAME_TO_SYMBOL)) {
    if (lower.includes(name)) found.add(sym);
  }
  // $CASHTAGS and standalone upper-case tickers (2-5 letters).
  const cash = text.match(/\$[A-Z]{1,5}\b/g) ?? [];
  for (const c of cash) {
    const t = c.slice(1);
    found.add(CRYPTO_TICKERS.has(t) ? `${t}-USD` : t);
  }
  return [...found].slice(0, 6);
}

function scoreSentiment(text: string): number {
  const lower = ` ${text.toLowerCase()} `;
  let raw = 0;
  for (const [w, v] of Object.entries(POSITIVE)) if (lower.includes(` ${w} `) || lower.includes(w)) raw += v;
  for (const [w, v] of Object.entries(NEGATIVE)) if (lower.includes(` ${w} `) || lower.includes(w)) raw -= v;
  // Squash to -100..100 with diminishing returns.
  return Math.round(100 * Math.tanh(raw / 5));
}

function scoreImpact(text: string, ageMinutes: number, symbols: number): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const w of IMPACT_WORDS) if (lower.includes(w)) hits++;
  const topic = Math.min(60, hits * 15);
  const freshness = ageMinutes < 30 ? 25 : ageMinutes < 120 ? 15 : ageMinutes < 360 ? 8 : 0;
  const linked = Math.min(15, symbols * 8);
  return Math.min(100, topic + freshness + linked);
}

const bucket = (s: number): Sentiment =>
  s >= 15 ? "bullish" : s <= -15 ? "bearish" : "neutral";

function categorize(text: string, fallback: NewsCategory): NewsCategory {
  const l = text.toLowerCase();
  if (/(bitcoin|ethereum|crypto|token|blockchain|defi)/.test(l)) return "crypto";
  if (/(fed|inflation|rate|gdp|cpi|jobs|recession|treasury)/.test(l)) return "macro";
  if (/(war|sanction|tariff|opec|election|geopolit)/.test(l)) return "geopolitics";
  if (/(oil|gold|gas|copper|wheat|commodit)/.test(l)) return "commodities";
  if (/(nvidia|apple|microsoft|chip|ai |software|semiconductor)/.test(l)) return "tech";
  return fallback;
}

function hashId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Turn raw feed articles into enriched, de-duplicated, ranked NewsItems. */
export function enrichArticles(
  raw: RawArticle[],
  feedCategory: (source: string) => NewsCategory,
  now = Date.now(),
): NewsItem[] {
  const seen = new Set<string>();
  const items: NewsItem[] = [];

  for (const a of raw) {
    if (!a.title || a.title.length < 12) continue;
    // Dedup on a normalized title key (outlets echo the same headline).
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);

    const text = `${a.title}. ${a.summary}`;
    const symbols = extractSymbols(text);
    const sentimentScore = scoreSentiment(text);
    const ageMin = Math.max(0, (now - Date.parse(a.publishedAt)) / 60000);
    const impact = scoreImpact(text, ageMin, symbols.length);

    items.push({
      id: hashId(a.title + a.source),
      title: a.title,
      summary: a.summary,
      url: a.url,
      source: a.source,
      publishedAt: a.publishedAt,
      category: categorize(text, feedCategory(a.source)),
      sentimentScore,
      sentiment: bucket(sentimentScore),
      impact,
      symbols,
      breaking: impact >= 55 && ageMin < 90,
    });
  }

  // Rank by a blend of impact and freshness so the top of the feed is what a
  // trader should look at first.
  items.sort((x, y) => {
    const fx = x.impact - Math.min(40, (now - Date.parse(x.publishedAt)) / 60000 / 6);
    const fy = y.impact - Math.min(40, (now - Date.parse(y.publishedAt)) / 60000 / 6);
    return fy - fx;
  });
  return items;
}

export { extractSymbols, scoreSentiment };

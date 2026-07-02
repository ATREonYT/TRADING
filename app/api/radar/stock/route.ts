import { NextResponse } from "next/server";
import type { FeedSource } from "@/lib/radar/sources";
import { fetchAllFeeds } from "@/lib/radar/rss";
import { enrichArticles } from "@/lib/radar/nlp";
import { fetchEquityQuotes, fetchCryptoQuotes } from "@/lib/radar/market";
import { buildSignals } from "@/lib/radar/signals";
import { demoNews, demoQuotes } from "@/lib/radar/demo";
import { lookupSymbol } from "@/lib/symbolCatalog";
import { isValidSymbol, escapeRegExp } from "@/lib/radar/validate";
import {
  computeIndicators,
  projectPrice,
  findHiddenSignals,
  buildBriefing,
  type Indicators,
  type Projection,
  type HiddenSignal,
} from "@/lib/radar/analytics";
import type { NewsItem, Quote, Signal } from "@/lib/radar/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const gnews = (q: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

interface StockPayload {
  ok: boolean;
  degraded: boolean;
  generatedAt: string;
  symbol: string;
  name: string;
  kind: "equity" | "crypto";
  quote: Quote | null;
  signal: Signal | null;
  news: NewsItem[];
  indicators: Indicators | null;
  projection: Projection | null;
  hidden: HiddenSignal[];
  briefing: string;
  notes: string[];
}

export async function GET(req: Request): Promise<NextResponse<StockPayload>> {
  const raw = (new URL(req.url).searchParams.get("symbol") ?? "").toUpperCase().slice(0, 20);
  const { symbol, name, kind } = lookupSymbol(raw);
  // Reject anything that isn't a plain ticker before it reaches upstream URLs.
  if (!isValidSymbol(symbol)) {
    return NextResponse.json(
      {
        ok: false, degraded: false, generatedAt: new Date().toISOString(),
        symbol: "", name: "", kind: "equity" as const,
        quote: null, signal: null, news: [],
        indicators: null, projection: null, hidden: [], briefing: "",
        notes: ["Invalid symbol."],
      },
      { status: 400 },
    );
  }
  const base = symbol.replace(/-USD$/, "");
  const notes: string[] = [];
  let degraded = false;

  // Symbol-specific news query — this is what "caters" the feed to the stock.
  const feeds: FeedSource[] = [
    { name: `Google News · ${name}`, url: gnews(`${name} OR ${base} ${kind === "crypto" ? "crypto" : "stock"} when:3d`), category: "equities" },
    { name: `Google News · ${base} moves`, url: gnews(`${name} stock price OR earnings OR forecast when:3d`), category: "equities" },
  ];
  if (kind === "equity") {
    feeds.push({
      name: `Yahoo Finance · ${base}`,
      url: `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(base)}&region=US&lang=en-US`,
      category: "equities",
    });
  }

  // News + quote in parallel; each degrades independently.
  const quotePromise =
    kind === "crypto" ? fetchCryptoQuotes([`${base}USDT`]) : fetchEquityQuotes([base]);
  const [newsRes, quoteRes] = await Promise.allSettled([
    fetchAllFeeds(feeds, 8000, 4, `stock:${symbol}`),
    quotePromise,
  ]);

  let news: NewsItem[] =
    newsRes.status === "fulfilled"
      ? enrichArticles(newsRes.value.articles, () => (kind === "crypto" ? "crypto" : "equities"))
      : [];

  // Keep only stories actually about this instrument.
  const needleName = name.toLowerCase();
  const tickerRe = new RegExp(`\\b${escapeRegExp(base)}\\b`);
  news = news.filter(
    (n) =>
      n.symbols.includes(symbol) ||
      n.symbols.includes(base) ||
      `${n.title} ${n.summary}`.toLowerCase().includes(needleName) ||
      tickerRe.test(`${n.title} ${n.summary}`),
  );

  let quote: Quote | null =
    quoteRes.status === "fulfilled" && quoteRes.value.length ? quoteRes.value[0] : null;

  // Demo fallbacks (blocked/offline environments).
  if (!quote) {
    degraded = true;
    quote = demoQuotes().find((q) => q.symbol === symbol) ?? null;
    notes.push("Live market data blocked — demo quote in use.");
  }
  if (news.length === 0) {
    degraded = true;
    news = demoNews().filter((n) => n.symbols.includes(symbol) || `${n.title} ${n.summary}`.toLowerCase().includes(needleName));
    notes.push("Live news blocked — demo headlines in use.");
  }

  const signal: Signal | null = quote ? buildSignals([quote], news)[0] ?? null : null;

  // Deep analysis: indicators, hidden signals, and the projection cone.
  const indicators = quote ? computeIndicators(quote.spark) : null;
  const strongestCat = news
    .filter((n) => n.catalyst && n.catalyst.direction !== "neutral")
    .sort((a, b) => (b.catalyst?.strength ?? 0) - (a.catalyst?.strength ?? 0))[0]?.catalyst;
  const catalystPush = strongestCat
    ? (strongestCat.direction === "bullish" ? 1 : -1) * strongestCat.strength
    : 0;
  const projection =
    quote && signal ? projectPrice(quote.spark, quote.price, signal.breakdown, catalystPush) : null;
  const hidden = quote ? findHiddenSignals(quote, news, indicators) : [];
  const briefing = quote
    ? buildBriefing(name, quote, signal, indicators, projection, hidden)
    : "";

  return NextResponse.json({
    ok: true,
    degraded,
    generatedAt: new Date().toISOString(),
    symbol,
    name,
    kind,
    quote,
    signal,
    news: news.slice(0, 40),
    indicators,
    projection,
    hidden,
    briefing,
    notes,
  });
}

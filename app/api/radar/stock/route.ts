import { NextResponse } from "next/server";
import type { FeedSource } from "@/lib/radar/sources";
import { fetchAllFeeds } from "@/lib/radar/rss";
import { enrichArticles } from "@/lib/radar/nlp";
import { fetchEquityQuotes, fetchCryptoQuotes } from "@/lib/radar/market";
import { buildSignals } from "@/lib/radar/signals";
import { demoNews, demoQuotes } from "@/lib/radar/demo";
import { lookupSymbol } from "@/lib/symbolCatalog";
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
  notes: string[];
}

export async function GET(req: Request): Promise<NextResponse<StockPayload>> {
  const raw = new URL(req.url).searchParams.get("symbol") ?? "";
  const { symbol, name, kind } = lookupSymbol(raw);
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
      url: `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${base}&region=US&lang=en-US`,
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
  news = news.filter(
    (n) =>
      n.symbols.includes(symbol) ||
      n.symbols.includes(base) ||
      `${n.title} ${n.summary}`.toLowerCase().includes(needleName) ||
      new RegExp(`\\b${base}\\b`).test(`${n.title} ${n.summary}`),
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
    notes,
  });
}

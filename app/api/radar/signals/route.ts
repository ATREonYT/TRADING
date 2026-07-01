import { NextResponse } from "next/server";
import { FEEDS } from "@/lib/radar/sources";
import { fetchAllFeeds } from "@/lib/radar/rss";
import { enrichArticles } from "@/lib/radar/nlp";
import { fetchAllQuotes } from "@/lib/radar/market";
import { buildSignals } from "@/lib/radar/signals";
import { demoNews, demoQuotes } from "@/lib/radar/demo";
import type { NewsCategory, RadarPayload, Signal } from "@/lib/radar/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const categoryOf = (source: string): NewsCategory =>
  FEEDS.find((x) => x.name === source)?.category ?? "general";

export async function GET(): Promise<NextResponse<RadarPayload<Signal>>> {
  const notes: string[] = [];
  let degraded = false;

  // News + markets in parallel; each degrades independently.
  const [newsRes, mktRes] = await Promise.allSettled([
    fetchAllFeeds(FEEDS),
    fetchAllQuotes(),
  ]);

  let news =
    newsRes.status === "fulfilled"
      ? enrichArticles(newsRes.value.articles, categoryOf)
      : [];
  let quotes = mktRes.status === "fulfilled" ? mktRes.value.quotes : [];

  if (quotes.length === 0) {
    degraded = true;
    quotes = demoQuotes();
    notes.push("Live market data blocked — demo quotes in use.");
  }
  if (news.length === 0) {
    degraded = true;
    news = demoNews();
    notes.push("Live news blocked — demo headlines in use.");
  }

  const signals = buildSignals(quotes, news);

  return NextResponse.json({
    ok: true,
    degraded,
    generatedAt: new Date().toISOString(),
    count: signals.length,
    items: signals,
    notes,
  });
}

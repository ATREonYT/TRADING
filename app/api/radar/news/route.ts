import { NextResponse } from "next/server";
import { FEEDS } from "@/lib/radar/sources";
import { fetchAllFeeds } from "@/lib/radar/rss";
import { enrichArticles } from "@/lib/radar/nlp";
import { demoNews } from "@/lib/radar/demo";
import type { NewsCategory, NewsItem, RadarPayload } from "@/lib/radar/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const categoryOf = (source: string): NewsCategory => {
  const f = FEEDS.find((x) => x.name === source);
  return f?.category ?? "general";
};

export async function GET(): Promise<NextResponse<RadarPayload<NewsItem>>> {
  const notes: string[] = [];
  let items: NewsItem[] = [];
  let degraded = false;

  try {
    const { articles, failed } = await fetchAllFeeds(FEEDS);
    if (failed.length) notes.push(`${failed.length}/${FEEDS.length} feeds unreachable`);
    items = enrichArticles(articles, categoryOf);
  } catch (e) {
    notes.push(`fetch error: ${(e as Error).message}`);
  }

  if (items.length === 0) {
    degraded = true;
    notes.push("Live feeds blocked — showing demo data. Deploy where outbound HTTPS is allowed for live news.");
    items = demoNews();
  }

  return NextResponse.json({
    ok: true,
    degraded,
    generatedAt: new Date().toISOString(),
    count: items.length,
    items: items.slice(0, 120),
    notes,
  });
}

import type { FeedSource } from "./sources";

// Dependency-free RSS/Atom parsing. We only need title/link/summary/date, so a
// tolerant tag extractor beats pulling in a full XML parser.

export interface RawArticle {
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  source: string;
}

const decodeEntities = (s: string): string =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ") // strip nested HTML tags
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, " ")
    .trim();

const tag = (block: string, name: string): string | null => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : null;
};

// Atom links look like <link href="..."/>; RSS links are <link>...</link>.
const link = (block: string): string => {
  const href = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  if (href) return href[1];
  const rss = tag(block, "link");
  return rss ? decodeEntities(rss) : "";
};

const parseFeed = (xml: string, source: string): RawArticle[] => {
  const out: RawArticle[] = [];
  const blocks =
    xml.match(/<item[\s\S]*?<\/item>/gi) ??
    xml.match(/<entry[\s\S]*?<\/entry>/gi) ??
    [];
  for (const block of blocks) {
    const title = tag(block, "title");
    if (!title) continue;
    const date =
      tag(block, "pubDate") ??
      tag(block, "published") ??
      tag(block, "updated") ??
      tag(block, "dc:date") ??
      "";
    const summary =
      tag(block, "description") ??
      tag(block, "summary") ??
      tag(block, "content") ??
      "";
    const iso = date ? new Date(decodeEntities(date)).toISOString() : new Date().toISOString();
    out.push({
      title: decodeEntities(title),
      url: link(block),
      summary: decodeEntities(summary).slice(0, 400),
      publishedAt: Number.isNaN(Date.parse(iso)) ? new Date().toISOString() : iso,
      source,
    });
  }
  return out;
};

async function fetchOne(feed: FeedSource, timeoutMs: number): Promise<RawArticle[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: {
        // Some feeds 403 default fetch UAs; present as a normal browser.
        "User-Agent":
          "Mozilla/5.0 (compatible; HelixRadar/1.0; +https://example.com/bot)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseFeed(xml, feed.name);
  } finally {
    clearTimeout(t);
  }
}

export interface FetchResult {
  articles: RawArticle[];
  failed: string[];
}

/** Fetch every feed concurrently; never throws — collects failures instead. */
export async function fetchAllFeeds(
  feeds: FeedSource[],
  timeoutMs = 8000,
): Promise<FetchResult> {
  const settled = await Promise.allSettled(feeds.map((f) => fetchOne(f, timeoutMs)));
  const articles: RawArticle[] = [];
  const failed: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") articles.push(...r.value);
    else failed.push(feeds[i].name);
  });
  return { articles, failed };
}

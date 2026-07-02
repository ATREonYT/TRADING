import type { FeedSource } from "./sources";
import { safeHttpUrl } from "./validate";

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
// Whatever we find is scheme-checked: a hostile feed item must not be able to
// smuggle a javascript:/data: URL into an <a href>.
const link = (block: string): string => {
  const href = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  if (href) return safeHttpUrl(href[1]);
  const rss = tag(block, "link");
  return rss ? safeHttpUrl(decodeEntities(rss)) : "";
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

/** Map with a bounded number of in-flight requests so we never open 60+ sockets at once. */
async function pooled<I, O>(items: I[], limit: number, fn: (i: I) => Promise<O>): Promise<(O | Error)[]> {
  const out: (O | Error)[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      try {
        out[cur] = await fn(items[cur]);
      } catch (e) {
        out[cur] = e as Error;
      }
    }
  });
  await Promise.all(workers);
  return out;
}

// Short-lived in-memory cache, keyed so per-symbol fetches don't collide with
// the global feed. With ~20s client polling this collapses bursts into one
// fetch cycle.
const cache = new Map<string, { at: number; result: FetchResult }>();
const CACHE_MS = 15000;

/** Fetch every feed with bounded concurrency; never throws — collects failures. */
export async function fetchAllFeeds(
  feeds: FeedSource[],
  timeoutMs = 8000,
  concurrency = 12,
  cacheKey = "global",
): Promise<FetchResult> {
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.result;

  const settled = await pooled(feeds, concurrency, (f) => fetchOne(f, timeoutMs));
  const articles: RawArticle[] = [];
  const failed: string[] = [];
  settled.forEach((r, i) => {
    if (Array.isArray(r)) articles.push(...r);
    else failed.push(feeds[i].name);
  });
  const result = { articles, failed };
  // Only cache a materially successful cycle so transient full failures retry.
  if (articles.length > 0) cache.set(cacheKey, { at: Date.now(), result });
  return result;
}

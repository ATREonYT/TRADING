import { describe, it, expect } from "vitest";
import { parseFeed } from "@/lib/radar/rss";

const RSS = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title><![CDATA[Nvidia surges on record &amp; blowout demand]]></title>
    <link>https://example.com/nvda</link>
    <description><![CDATA[<p>Shares of <b>Nvidia</b> jumped.</p>]]></description>
    <pubDate>Wed, 01 Jul 2026 14:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Evil story</title>
    <link>javascript:alert(1)</link>
    <pubDate>Wed, 01 Jul 2026 14:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Fed holds rates steady</title>
    <link href="https://example.com/fed"/>
    <summary>The FOMC left policy unchanged.</summary>
    <updated>2026-07-01T10:00:00Z</updated>
  </entry>
</feed>`;

describe("parseFeed", () => {
  it("parses RSS items, strips CDATA/HTML and decodes entities", () => {
    const items = parseFeed(RSS, "Test Feed");
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Nvidia surges on record & blowout demand");
    expect(items[0].summary).toBe("Shares of Nvidia jumped.");
    expect(items[0].url).toBe("https://example.com/nvda");
    expect(Number.isNaN(Date.parse(items[0].publishedAt))).toBe(false);
  });

  it("blocks javascript: links from hostile feeds", () => {
    const items = parseFeed(RSS, "Test Feed");
    expect(items[1].url).toBe("");
  });

  it("parses Atom entries with href links", () => {
    const items = parseFeed(ATOM, "Atom Feed");
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://example.com/fed");
    expect(items[0].summary).toContain("FOMC");
  });

  it("strips the Google News publisher suffix and surfaces the outlet", () => {
    const xml = `<rss><channel><item>
      <title>Tesla shares slide after deliveries miss - Reuters</title>
      <link>https://news.google.com/x</link>
      <pubDate>Wed, 01 Jul 2026 14:00:00 GMT</pubDate>
    </item></channel></rss>`;
    const [item] = parseFeed(xml, "Google News · Markets", true);
    expect(item.title).toBe("Tesla shares slide after deliveries miss");
    expect(item.source).toBe("Reuters");
  });

  it("leaves non-Google titles containing dashes intact", () => {
    const xml = `<rss><channel><item>
      <title>Risk-on rally continues - or does it?</title>
      <link>https://example.com/x</link>
      <pubDate>Wed, 01 Jul 2026 14:00:00 GMT</pubDate>
    </item></channel></rss>`;
    const [item] = parseFeed(xml, "Some Feed", false);
    expect(item.title).toBe("Risk-on rally continues - or does it?");
    expect(item.source).toBe("Some Feed");
  });
});

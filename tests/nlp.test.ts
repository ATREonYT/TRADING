import { describe, it, expect } from "vitest";
import { scoreSentiment, extractSymbols, enrichArticles } from "@/lib/radar/nlp";
import type { RawArticle } from "@/lib/radar/rss";

describe("scoreSentiment", () => {
  it("scores clearly bullish text positive", () => {
    expect(scoreSentiment("Shares surge to record high after earnings beat")).toBeGreaterThan(20);
  });
  it("scores clearly bearish text negative", () => {
    expect(scoreSentiment("Stock plunges on bankruptcy fears and layoffs")).toBeLessThan(-20);
  });
  it("stays within bounds", () => {
    const s = scoreSentiment("surge surge surge rally rally boom soars record breakthrough");
    expect(s).toBeLessThanOrEqual(100);
    expect(s).toBeGreaterThan(50);
  });
});

describe("extractSymbols", () => {
  it("maps company names to tickers", () => {
    expect(extractSymbols("Nvidia and Apple rally on AI news")).toEqual(
      expect.arrayContaining(["NVDA", "AAPL"]),
    );
  });
  it("resolves $cashtags and crypto names", () => {
    expect(extractSymbols("Traders pile into $TSLA")).toContain("TSLA");
    expect(extractSymbols("Bitcoin breaks out")).toContain("BTC-USD");
    expect(extractSymbols("$BTC leads the move")).toContain("BTC-USD");
  });
});

const art = (title: string, minsAgo = 10, summary = ""): RawArticle => ({
  title,
  summary,
  url: "https://example.com",
  source: "Test",
  publishedAt: new Date(Date.now() - minsAgo * 60000).toISOString(),
});

describe("enrichArticles", () => {
  it("dedupes near-identical headlines across outlets", () => {
    const items = enrichArticles(
      [art("Nvidia surges to record high on earnings beat!"), art("Nvidia surges to record high on earnings beat")],
      () => "equities",
    );
    expect(items).toHaveLength(1);
  });

  it("attaches catalyst, sentiment and symbols", () => {
    const [item] = enrichArticles(
      [art("Nvidia surges after earnings beat estimates and raised guidance")],
      () => "equities",
    );
    expect(item.symbols).toContain("NVDA");
    expect(item.sentiment).toBe("bullish");
    expect(item.catalyst?.type).toBe("earnings_beat");
    expect(item.impact).toBeGreaterThanOrEqual(60);
  });

  it("drops too-short titles", () => {
    expect(enrichArticles([art("Too short")], () => "general")).toHaveLength(0);
  });

  it("ranks by impact-adjusted freshness", () => {
    const items = enrichArticles(
      [
        art("Company holds annual community picnic in the park this weekend", 5),
        art("Federal Reserve announces emergency rate cut amid recession fears", 5),
      ],
      () => "general",
    );
    expect(items[0].title).toContain("Federal Reserve");
  });
});

import { describe, it, expect } from "vitest";
import { mapYahooSearch } from "@/lib/radar/search";

// Shape mirrors Yahoo's /v1/finance/search response for "alibaba".
const YAHOO_FIXTURE = {
  quotes: [
    { symbol: "BABA", shortname: "Alibaba Group Holding Limited", exchDisp: "NYSE", quoteType: "EQUITY" },
    { symbol: "9988.HK", shortname: "BABA-W", longname: "Alibaba Group Holding Limited", exchDisp: "Hong Kong", quoteType: "EQUITY" },
    { symbol: "BABAF", shortname: "Alibaba Group Holding Ltd", exchDisp: "OTC Markets", quoteType: "EQUITY" },
    { symbol: "^GSPC", shortname: "S&P 500", exchDisp: "SNP", quoteType: "INDEX" },
    { symbol: "EURUSD=X", shortname: "EUR/USD", exchDisp: "CCY", quoteType: "CURRENCY" },
    { symbol: "BTC-USD", shortname: "Bitcoin USD", exchDisp: "CCC", quoteType: "CRYPTOCURRENCY" },
    { symbol: "javascript:alert(1)", shortname: "Evil", exchDisp: "X", quoteType: "EQUITY" },
  ],
};

describe("mapYahooSearch", () => {
  it("keeps multiple listings of the same company with their exchanges", () => {
    const items = mapYahooSearch(YAHOO_FIXTURE);
    const symbols = items.map((i) => i.symbol);
    expect(symbols).toContain("BABA");
    expect(symbols).toContain("9988.HK");
    expect(items.find((i) => i.symbol === "BABA")?.exchange).toBe("NYSE");
    expect(items.find((i) => i.symbol === "9988.HK")?.exchange).toBe("Hong Kong");
  });

  it("skips indices, forex, and invalid symbols", () => {
    const symbols = mapYahooSearch(YAHOO_FIXTURE).map((i) => i.symbol);
    expect(symbols).not.toContain("^GSPC");
    expect(symbols).not.toContain("EURUSD=X");
    expect(symbols.some((s) => s.includes("JAVASCRIPT"))).toBe(false);
  });

  it("classifies crypto and respects the limit", () => {
    const items = mapYahooSearch(YAHOO_FIXTURE, 2);
    expect(items).toHaveLength(2);
    const all = mapYahooSearch(YAHOO_FIXTURE);
    expect(all.find((i) => i.symbol === "BTC-USD")?.kind).toBe("crypto");
  });

  it("survives malformed payloads", () => {
    expect(mapYahooSearch(null)).toEqual([]);
    expect(mapYahooSearch({ quotes: "nope" })).toEqual([]);
    expect(mapYahooSearch({ quotes: [{}] })).toEqual([]);
  });
});

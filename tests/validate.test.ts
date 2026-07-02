import { describe, it, expect } from "vitest";
import { isValidSymbol, escapeRegExp, safeHttpUrl } from "@/lib/radar/validate";

describe("isValidSymbol", () => {
  it("accepts plain tickers and crypto pairs", () => {
    expect(isValidSymbol("AAPL")).toBe(true);
    expect(isValidSymbol("BTC-USD")).toBe(true);
    expect(isValidSymbol("BRK.B")).toBe(true);
  });
  it("rejects injection attempts", () => {
    expect(isValidSymbol("(((")).toBe(false);
    expect(isValidSymbol("AAPL/../x")).toBe(false);
    expect(isValidSymbol("AAPL?range=5y")).toBe(false);
    expect(isValidSymbol("")).toBe(false);
    expect(isValidSymbol("A".repeat(16))).toBe(false);
    expect(isValidSymbol("aapl")).toBe(false); // must be uppercased first
  });
});

describe("escapeRegExp", () => {
  it("makes hostile input safe to embed in a RegExp", () => {
    const hostile = "a(b)|c[d]*+?.^${}\\";
    expect(() => new RegExp(escapeRegExp(hostile))).not.toThrow();
    expect(new RegExp(escapeRegExp("BRK.B")).test("BRK.B")).toBe(true);
    expect(new RegExp(escapeRegExp("BRK.B")).test("BRKXB")).toBe(false);
  });
});

describe("safeHttpUrl", () => {
  it("allows http(s), blocks script schemes", () => {
    expect(safeHttpUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com");
    // eslint-disable-next-line no-script-url
    expect(safeHttpUrl("javascript:alert(1)")).toBe("");
    expect(safeHttpUrl("data:text/html,x")).toBe("");
    expect(safeHttpUrl("  JAVASCRIPT:alert(1)")).toBe("");
  });
});

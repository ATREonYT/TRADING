import { describe, it, expect } from "vitest";
import { detectCatalyst } from "@/lib/radar/catalysts";

const detect = (text: string, sentiment: "bullish" | "bearish" | "neutral" = "neutral") =>
  detectCatalyst(text, sentiment);

describe("detectCatalyst", () => {
  it("detects earnings beats and misses", () => {
    expect(detect("Apple tops estimates with record quarter")?.type).toBe("earnings_beat");
    expect(detect("Tesla misses Wall Street expectations")?.type).toBe("earnings_miss");
  });

  it("detects guidance changes", () => {
    expect(detect("Company raises full-year guidance")?.type).toBe("guidance_raise");
    expect(detect("Retailer cuts outlook, issues profit warning")?.type).toBe("guidance_cut");
  });

  it("detects binary events with fixed direction", () => {
    expect(detect("FDA grants approval for new drug")?.direction).toBe("bullish");
    expect(detect("Firm files for chapter 11 bankruptcy")?.direction).toBe("bearish");
    expect(detect("SEC opens investigation into accounting fraud")?.direction).toBe("bearish");
  });

  it("resolves context-direction rules from the article's tone", () => {
    const fedBull = detect("Fed signals rate cut ahead", "bullish");
    expect(fedBull?.type).toBe("fed_rates");
    expect(fedBull?.direction).toBe("bullish");
    const fedBear = detect("Fed signals more hikes", "bearish");
    expect(fedBear?.direction).toBe("bearish");
  });

  it("picks the strongest catalyst when several match", () => {
    // Earnings beat (88) should outrank analyst action (62).
    const c = detect("Analysts upgrade after company beats estimates");
    expect(c?.type).toBe("earnings_beat");
  });

  it("returns null when nothing price-moving is present", () => {
    expect(detect("Company publishes sustainability report photos")).toBeNull();
  });

  it("every catalyst carries an explanation", () => {
    const c = detect("Board announces $10B buyback");
    expect(c?.why.length).toBeGreaterThan(30);
    expect(c?.strength).toBeGreaterThan(0);
  });
});

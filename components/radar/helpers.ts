import type { NewsCategory, Sentiment } from "@/lib/radar/types";

export function relTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const m = Math.round(diff / 60000);
  if (Number.isNaN(m)) return "";
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export const sentimentColor = (s: Sentiment): string =>
  s === "bullish" ? "text-up" : s === "bearish" ? "text-down" : "text-muted";

export const sentimentBg = (s: Sentiment): string =>
  s === "bullish"
    ? "bg-up/15 text-up ring-up/30"
    : s === "bearish"
      ? "bg-down/15 text-down ring-down/30"
      : "bg-elevated text-muted ring-border";

export const directionArrow = (s: Sentiment): string =>
  s === "bullish" ? "▲" : s === "bearish" ? "▼" : "▪";

export const leanBg = (lean: "buy" | "watch" | "avoid"): string =>
  lean === "buy"
    ? "bg-up/15 text-up ring-up/40"
    : lean === "avoid"
      ? "bg-down/15 text-down ring-down/40"
      : "bg-accent/15 text-accent ring-accent/40";

export const CATEGORY_LABEL: Record<NewsCategory, string> = {
  equities: "Equities",
  crypto: "Crypto",
  macro: "Macro",
  geopolitics: "Geopolitics",
  commodities: "Commodities",
  tech: "Tech",
  general: "General",
};

export const CATEGORIES: NewsCategory[] = [
  "equities",
  "crypto",
  "macro",
  "tech",
  "commodities",
  "geopolitics",
];

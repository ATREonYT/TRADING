import type { Signal, TickerLite } from "./types.js";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function fmtUsd(n: number): string {
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  return `$${n.toPrecision(4)}`;
}

export function fmtCompact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function scoreBar(score: number): string {
  const filled = Math.round((score / 100) * 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

/** Format a pump signal as a Telegram HTML alert. */
export function formatSignal(s: Signal, chartUrl: string): string {
  const heat = s.score >= 80 ? "🔥🔥🔥" : s.score >= 65 ? "🔥🔥" : "🔥";
  const lines = [
    `${heat} <b>PUMP SIGNAL</b> · <b>${esc(s.symbol)}</b>`,
    ``,
    `Price: <b>${fmtUsd(s.price)}</b>`,
    `Move: <b>+${s.windowChangePct}%</b> (window)  ·  24h ${s.change24h >= 0 ? "+" : ""}${s.change24h}%`,
    `Volume: <b>${s.volumeSurge}×</b> avg  ·  RSI ${s.rsi}`,
    `Liquidity: ${fmtCompact(s.quoteVolume)} 24h`,
    ``,
    `Score: <b>${s.score}/100</b>  <code>${scoreBar(s.score)}</code>`,
    `Why: ${s.reasons.map((r) => esc(r.label)).join(" · ")}`,
    ``,
    `<a href="${chartUrl}">Open chart →</a>`,
    `<i>Not financial advice. Momentum signal only — verify before trading.</i>`,
  ];
  return lines.join("\n");
}

export function formatTopMovers(movers: TickerLite[]): string {
  if (!movers.length) return "No liquid movers right now.";
  const rows = movers.map((m, i) => {
    const arrow = m.percentage >= 0 ? "🟢" : "🔴";
    return `${String(i + 1).padStart(2)}. ${arrow} <b>${esc(m.symbol)}</b>  ${
      m.percentage >= 0 ? "+" : ""
    }${m.percentage.toFixed(2)}%  ·  ${fmtCompact(m.quoteVolume)}`;
  });
  return `<b>Top movers (24h)</b>\n` + rows.join("\n");
}

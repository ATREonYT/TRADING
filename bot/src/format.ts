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

/** Compact price string with enough precision for sub-dollar coins. */
function fmtPrice(n: number): string {
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toPrecision(5).replace(/0+$/, "").replace(/\.$/, "");
}

const RISK_EMOJI = { low: "🟢", medium: "🟡", high: "🔴" } as const;

/** Format a pump signal in the clean pump-channel style. */
export function formatSignal(s: Signal, exchangeName: string, windowSeconds: number): string {
  const base = s.symbol.split("/")[0] ?? s.symbol;
  const heat = s.score >= 80 ? "🚀🚀🚀" : s.score >= 65 ? "🚀🚀" : "🚀";
  const priceFrom = s.price / (1 + s.windowChangePct / 100);
  const pressure =
    s.buyPressure !== undefined
      ? ` · book ${s.buyPressure}× ${s.buyPressure >= 1 ? "buy" : "sell"}`
      : "";
  const riskNote = s.riskFlags.length ? ` <i>(${esc(s.riskFlags.slice(0, 2).join(", "))})</i>` : "";
  const lines = [
    `${heat} <b>${esc(base)}</b>  +${s.windowChangePct}% in ${windowSeconds}s`,
    `> Exchange: ${esc(exchangeName.toUpperCase())}`,
    `> ${fmtPrice(priceFrom)} → <b>${fmtPrice(s.price)}</b>`,
    `> Volume 24h: ${fmtCompact(s.quoteVolume)}`,
    `> Surge: ${s.volumeSurge}× · accel ${s.volAccel}× · RSI ${s.rsi}`,
    `> Risk: ${RISK_EMOJI[s.riskLevel]} <b>${s.riskLevel.toUpperCase()}</b>${riskNote}`,
    `> Score: <b>${s.score}/100</b>${pressure}`,
    ``,
    `#${esc(base)} #${esc(base)}_pump`,
    `<i>Not financial advice · high-risk · verify &amp; use a stop</i>`,
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

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

/** Format an on-demand /risk lookup result. */
export function formatRiskReport(r: {
  symbol: string;
  ticker: TickerLite;
  risk: { score: number; level: "low" | "medium" | "high"; flags: string[] };
  windowChangePct: number;
  volumeSurge: number;
  rsi: number;
  buyPressure?: number;
}): string {
  const base = r.symbol.split("/")[0] ?? r.symbol;
  const verdict =
    r.risk.level === "low"
      ? "looks relatively clean"
      : r.risk.level === "medium"
        ? "trade with caution"
        : "high trap risk — avoid or tiny size";
  const flags = r.risk.flags.length ? r.risk.flags.map((f) => `• ${esc(f)}`).join("\n") : "• none flagged";
  const pressure = r.buyPressure !== undefined ? ` · book ${r.buyPressure}× ${r.buyPressure >= 1 ? "buy" : "sell"}` : "";
  return [
    `${RISK_EMOJI[r.risk.level]} <b>${esc(base)}</b> risk check`,
    ``,
    `Price: <b>${fmtPrice(r.ticker.last)}</b> · 24h ${r.ticker.percentage >= 0 ? "+" : ""}${r.ticker.percentage.toFixed(2)}%`,
    `Volume 24h: ${fmtCompact(r.ticker.quoteVolume)}`,
    `Move ${r.windowChangePct >= 0 ? "+" : ""}${r.windowChangePct}% · surge ${r.volumeSurge}× · RSI ${r.rsi}${pressure}`,
    ``,
    `Risk: ${RISK_EMOJI[r.risk.level]} <b>${r.risk.level.toUpperCase()}</b> (${r.risk.score}/100) — ${verdict}`,
    flags,
    ``,
    `<i>Heuristic on market data, not a contract audit — it can't catch every scam.</i>`,
  ].join("\n");
}

const sign = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;

export function formatPerformance(s: {
  closed: number;
  open: number;
  wins: number;
  winRate: number;
  avgPeakPct: number;
  avgFinalPct: number;
  avgDrawdownPct: number;
  best?: { symbol: string; pct: number };
  worst?: { symbol: string; pct: number };
}, winPct: number, horizonMin: number): string {
  if (s.closed === 0 && s.open === 0) {
    return "No signals tracked yet. Once the bot fires alerts, /performance will show how they played out.";
  }
  const lines = [
    `📈 <b>Signal performance</b> <i>(paper-traded, ${horizonMin}m horizon)</i>`,
    ``,
    `Tracked: <b>${s.closed}</b> closed · ${s.open} open`,
    `Win rate (peak ≥ +${winPct}%): <b>${s.winRate}%</b> (${s.wins}/${s.closed})`,
    `Avg peak gain: <b>${sign(s.avgPeakPct)}</b>`,
    `Avg result at ${horizonMin}m: <b>${sign(s.avgFinalPct)}</b>`,
    `Avg max drawdown: <b>${sign(s.avgDrawdownPct)}</b>`,
  ];
  if (s.best) lines.push(`Best: ${esc(s.best.symbol)} ${sign(s.best.pct)}`);
  if (s.worst) lines.push(`Worst: ${esc(s.worst.symbol)} ${sign(s.worst.pct)}`);
  lines.push(``, `<i>Hypothetical — measures signal quality, not real trades.</i>`);
  return lines.join("\n");
}

export function formatOpenTrades(
  trades: Array<{ symbol: string; curPct: number; peakPct: number; ageMin: number }>,
): string {
  if (!trades.length) return "No open paper-trades right now.";
  const rows = trades.map((t) => {
    const base = t.symbol.split("/")[0] ?? t.symbol;
    return `${t.curPct >= 0 ? "🟢" : "🔴"} <b>${esc(base)}</b>  now ${sign(t.curPct)} · peak ${sign(t.peakPct)} · ${t.ageMin}m`;
  });
  return `<b>Open paper-trades</b>\n` + rows.join("\n");
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

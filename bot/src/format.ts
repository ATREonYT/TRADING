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

/** Format a pump signal in the clean pump-channel style (matches reference bots). */
export function formatSignal(s: Signal, exchangeName: string, marketType: "spot" | "swap" = "spot"): string {
  const base = s.symbol.split("/")[0] ?? s.symbol;
  const down = s.direction === "down";
  const heat = down
    ? s.score >= 80 ? "🔻🔻🔻" : s.score >= 65 ? "🔻🔻" : "🔻"
    : s.score >= 80 ? "🚀🚀🚀" : s.score >= 65 ? "🚀🚀" : "🚀";
  const windowSeconds = s.windowSec;
  const exLabel = `${exchangeName.toUpperCase()}${marketType === "swap" ? " (swap)" : ""}`;
  const priceFrom = s.price / (1 + s.windowChangePct / 100);
  const signed = `${s.windowChangePct >= 0 ? "+" : ""}${s.windowChangePct}`;
  const pressure =
    s.buyPressure !== undefined ? ` · book ${s.buyPressure}×${s.buyPressure >= 1 ? "📈" : "📉"}` : "";
  const riskNote = s.riskFlags.length ? ` <i>(${esc(s.riskFlags.slice(0, 2).join(", "))})</i>` : "";
  const tag = down ? "dump" : "pump";
  const lines = [
    `${heat} <b>${esc(base)}</b> ${signed}% in ${windowSeconds}s`,
    `> Exchange: ${esc(exLabel)}`,
    `> ${fmtPrice(priceFrom)} → ${fmtPrice(s.price)}`,
    `> Volume24: $${fmtCompact(s.quoteVolume)}`,
    `> Surge: ${s.volumeSurge}× · RSI ${s.rsi}${pressure}`,
    `> Risk: ${RISK_EMOJI[s.riskLevel]} ${s.riskLevel.toUpperCase()} · Score ${s.score}/100${riskNote}`,
    ``,
    `#${esc(base)} #${esc(base)}_${tag}`,
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
  losses: number;
  flats: number;
  winRate: number;
  targetPct: number;
  stopPct: number;
  avgPeakPct: number;
  avgFinalPct: number;
  avgDrawdownPct: number;
  best?: { symbol: string; pct: number };
  worst?: { symbol: string; pct: number };
}, horizonMin: number): string {
  if (s.closed === 0 && s.open === 0) {
    return "No signals tracked yet. Once the bot fires alerts, /performance will show how they actually played out.";
  }
  if (s.closed === 0) {
    return `📈 <b>Signal performance</b>\n${s.open} trade(s) still tracking — results appear after the ${horizonMin}m horizon. Check back soon.`;
  }
  const lines = [
    `📈 <b>Signal performance</b> <i>(paper-traded, real outcomes)</i>`,
    ``,
    `<b>Win rate: ${s.winRate}%</b> (${s.wins}/${s.closed})`,
    `Rule: hit <b>+${s.targetPct}%</b> before <b>−${s.stopPct}%</b> within ${horizonMin}m`,
    `✅ Wins ${s.wins} · ❌ Losses ${s.losses} · ➖ Flat ${s.flats} · ${s.open} open`,
    ``,
    `Avg result at ${horizonMin}m: <b>${sign(s.avgFinalPct)}</b>`,
    `Avg best/worst excursion: ${sign(s.avgPeakPct)} / ${sign(s.avgDrawdownPct)}`,
  ];
  if (s.best) lines.push(`Best: ${esc(s.best.symbol)} ${sign(s.best.pct)}`);
  if (s.worst) lines.push(`Worst: ${esc(s.worst.symbol)} ${sign(s.worst.pct)}`);
  lines.push(``, `<i>Hypothetical, sampled — measures signal quality, not real fills.</i>`);
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

/**
 * Short risk notice appended to EVERY subscriber-facing (channel) message.
 * Keep it on every message — a disclaimer only helps if the reader actually saw
 * it next to the content they acted on, not buried in a pinned post from months ago.
 */
export const DISCLAIMER_FOOTER =
  `\n—\n<i>⚠️ Educational information, not financial advice. Signals are automated ` +
  `momentum heuristics and frequently fail. You alone are responsible for your trades ` +
  `and can lose everything you risk. Full terms: /disclaimer</i>`;

/** Full disclaimer for /disclaimer and for pinning in the channel. */
export function formatDisclaimer(serviceName: string): string {
  return [
    `⚠️ <b>${esc(serviceName)} — Risk Disclaimer &amp; Terms of Use</b>`,
    ``,
    `<b>1. Not financial advice.</b> Everything posted here — signals, digests, scores, ` +
      `commentary — is automated, general, impersonal market information provided for ` +
      `educational purposes only. Nothing here is investment advice, a recommendation, or ` +
      `a solicitation to buy or sell any asset. We are not a broker, investment adviser, or fiduciary, ` +
      `and no client or advisory relationship is created by subscribing.`,
    ``,
    `<b>2. High risk.</b> Trading cryptocurrencies (especially momentum/"pump" events and ` +
      `leveraged futures) is extremely high risk. Signals detect moves that are already ` +
      `underway and frequently reverse. Many signals lose money. You can lose your entire stake, ` +
      `and with leverage, more than your stake.`,
    ``,
    `<b>3. No guarantees.</b> Past performance — including any win-rate statistics we publish — ` +
      `does not predict future results. Win-rate figures are hypothetical paper-tracked outcomes, ` +
      `not real fills, and overstate what a real trader would achieve after fees, slippage, and delay.`,
    ``,
    `<b>4. Your decisions, your responsibility.</b> Any trade you make is your own decision, ` +
      `made at your own risk, based on your own research. Never trade money you cannot afford to lose. ` +
      `By reading or acting on any content here, you agree that the operators of this service have no ` +
      `liability for your trading results, to the maximum extent permitted by law.`,
    ``,
    `<b>5. Data may be wrong.</b> Prices, volumes and scores come from third-party exchange APIs ` +
      `and automated heuristics; they can be delayed, incomplete, or simply incorrect.`,
    ``,
    `<b>6. No personalized advice.</b> We do not provide one-on-one trade recommendations, manage ` +
      `funds, or tailor anything to your personal situation. Do not ask; consult a licensed financial ` +
      `adviser in your jurisdiction instead.`,
    ``,
    `<i>By remaining in this channel and/or using this bot you acknowledge and accept these terms in full.</i>`,
  ].join("\n");
}

/** Daily digest posted to the subscriber channel — the "newsletter". */
export function formatDigest(d: {
  serviceName: string;
  dateUtc: string;
  signalsToday: number;
  bestToday?: { symbol: string; score: number; windowChangePct: number };
  perf: {
    closed: number;
    wins: number;
    winRate: number;
    avgFinalPct: number;
    targetPct: number;
    stopPct: number;
  };
  horizonMin: number;
  movers: TickerLite[];
}): string {
  const lines = [`📰 <b>${esc(d.serviceName)} — Daily Digest</b> · ${esc(d.dateUtc)} (UTC)`, ``];

  lines.push(`⚡ Signals in the last 24h: <b>${d.signalsToday}</b>`);
  if (d.bestToday) {
    const base = d.bestToday.symbol.split("/")[0] ?? d.bestToday.symbol;
    lines.push(
      `Strongest: <b>${esc(base)}</b> (score ${d.bestToday.score}/100, ` +
        `${d.bestToday.windowChangePct >= 0 ? "+" : ""}${d.bestToday.windowChangePct}% trigger move)`,
    );
  }

  lines.push(``);
  if (d.perf.closed > 0) {
    lines.push(
      `📈 <b>Track record</b> (hypothetical, paper-tracked)`,
      `Win rate: <b>${d.perf.winRate}%</b> (${d.perf.wins}/${d.perf.closed} hit +${d.perf.targetPct}% ` +
        `before −${d.perf.stopPct}% within ${d.horizonMin}m)`,
      `Avg result at ${d.horizonMin}m: ${sign(d.perf.avgFinalPct)}`,
    );
  } else {
    lines.push(`📈 <b>Track record</b>: not enough closed signals yet — stats appear as they accumulate.`);
  }

  if (d.movers.length) {
    lines.push(``, `🌍 <b>Top movers (24h)</b>`);
    for (const [i, m] of d.movers.entries()) {
      lines.push(
        `${i + 1}. ${m.percentage >= 0 ? "🟢" : "🔴"} <b>${esc(m.symbol)}</b> ` +
          `${m.percentage >= 0 ? "+" : ""}${m.percentage.toFixed(2)}% · ${fmtCompact(m.quoteVolume)}`,
      );
    }
  }

  return lines.join("\n") + DISCLAIMER_FOOTER;
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

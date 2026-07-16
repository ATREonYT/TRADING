import { loadConfig, THRESHOLD_KEYS, type Thresholds } from "./config.js";
import { Scanner } from "./scanner.js";
import { TelegramBot } from "./telegram.js";
import {
  formatSignal,
  formatTopMovers,
  formatRiskReport,
  formatPerformance,
  formatOpenTrades,
  formatDisclaimer,
  formatDigest,
  DISCLAIMER_FOOTER,
} from "./format.js";
import { log } from "./logger.js";

const cfg = loadConfig();
const runOnce = process.argv.includes("--once");
const channelMode = cfg.channelId !== "";

// In channel (subscriber) mode, lock broadcasts + control commands to the admin
// chat so random DMs can't reconfigure the bot or receive the paid feed for free.
const bot = new TelegramBot(cfg.telegramToken, cfg.chatId, { lockToAdmin: channelMode });

// Rolling 24h stats for the daily digest.
const daily = {
  signals: 0,
  best: undefined as undefined | { symbol: string; score: number; windowChangePct: number },
  reset() {
    this.signals = 0;
    this.best = undefined;
  },
};

const scanner = new Scanner(cfg, (signal) => {
  const text = formatSignal(signal, cfg.exchange, cfg.marketType);
  daily.signals++;
  if (!daily.best || signal.score > daily.best.score) {
    daily.best = { symbol: signal.symbol, score: signal.score, windowChangePct: signal.windowChangePct };
  }
  const action = signal.direction === "down" ? "Short" : cfg.marketType === "swap" ? "Long" : "Buy";
  const adminButtons = [
    [
      { text: `${action} on ${cfg.exchange.toUpperCase()} ↗`, url: scanner.market.tradeUrl(signal.symbol) },
      { text: "📈 TradingView ↗", url: scanner.market.tradingViewUrl(signal.symbol) },
    ],
    [{ text: "Dex Screener ↗", url: scanner.market.dexScreenerUrl(signal.symbol) }],
  ];
  // Subscriber-facing buttons are deliberately neutral ("view", not "buy") —
  // the channel publishes information, it does not tell anyone to trade.
  const channelButtons = [
    [
      { text: "📈 Chart (TradingView) ↗", url: scanner.market.tradingViewUrl(signal.symbol) },
      { text: `View on ${cfg.exchange.toUpperCase()} ↗`, url: scanner.market.tradeUrl(signal.symbol) },
    ],
  ];
  if (cfg.dryRun) {
    log.ok("[DRY_RUN] signal:\n" + text);
  } else {
    void bot.broadcast(text, adminButtons);
    if (channelMode) void bot.send(text + DISCLAIMER_FOOTER, cfg.channelId, channelButtons);
  }
  log.ok(
    `SIGNAL ${signal.symbol} score=${signal.score} risk=${signal.riskLevel}(${signal.riskScore}) +${signal.windowChangePct}% vol=${signal.volumeSurge}x`,
  );
});

let paused = false;

function uptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function settingsText(t: Thresholds): string {
  return [
    "<b>Scan settings</b>",
    `exchange: <code>${cfg.exchange}</code> · quote: <code>${cfg.quote}</code>`,
    `windowMinutes: <code>${t.windowMinutes}</code>`,
    `minWindowChangePct: <code>${t.minWindowChangePct}</code>`,
    `minVolumeSurge: <code>${t.minVolumeSurge}</code>`,
    `minQuoteVolume: <code>${t.minQuoteVolume}</code>`,
    `maxRsi: <code>${t.maxRsi}</code>`,
    `minScore: <code>${t.minScore}</code>`,
    `maxRiskScore: <code>${t.maxRiskScore}</code>`,
    `cooldownMinutes: <code>${t.cooldownMinutes}</code>`,
    ``,
    `Adjust with <code>/set &lt;key&gt; &lt;value&gt;</code>`,
  ].join("\n");
}

function statusText(): string {
  const st = scanner.stats;
  const lines = [
    `<b>Pump Scanner</b> ${paused ? "⏸ paused" : "▶️ running"}`,
    `Exchange: <code>${scanner.market.id} ${cfg.marketType}</code>`,
    `Uptime: ${uptime(Date.now() - st.startedAt)}`,
    `Markets tracked: ${st.symbolsTracked}`,
    `Liquid (≥$${cfg.thresholds.minQuoteVolume.toLocaleString()}): ${st.liquidCount}`,
    `Scans: ${st.scans} · last deep-scan ${st.deepScanned} in ${st.lastScanMs}ms`,
    `Signals sent: ${st.signalsTotal}`,
    `Alert targets: ${bot.targets().length} chat(s)`,
  ];
  if (st.lastNearMiss) {
    const n = st.lastNearMiss;
    lines.push(
      `Closest miss: ${n.symbol} +${n.change}% vol ${n.surge}× score ${n.score} — <i>${n.reject}</i>`,
    );
  }
  lines.push(st.lastError ? `Last error: <code>${st.lastError}</code>` : `Errors: ${st.errors}`);
  return lines.join("\n");
}

// --- command handlers ---
const adminHelpText = [
  "👋 <b>Pump Scanner online.</b>",
  `Watching ${cfg.exchange} ${cfg.quote} markets for momentum + volume surges.`,
  "",
  "I'll DM you when a coin starts pumping. Commands:",
  "/status – scanner health",
  "/top – current top movers",
  "/risk &lt;symbol&gt; – scam/risk check a coin (e.g. /risk PEPE)",
  "/winrate – honest win rate of past signals",
  "/track – open paper-trades right now",
  "/settings – view thresholds",
  "/set &lt;key&gt; &lt;value&gt; – tune a threshold",
  "/scan – force a scan now",
  "/pause · /resume – toggle alerts",
  "/disclaimer – full risk disclaimer & terms",
  "",
  "<i>Signals are momentum alerts, not financial advice.</i>",
].join("\n");

const publicHelpText = [
  `👋 <b>${cfg.serviceName}</b>`,
  `Automated momentum/volume signals for ${cfg.exchange} ${cfg.quote} markets are posted to the subscriber channel.`,
  "",
  "Commands you can use here:",
  "/top – current top 24h movers",
  "/risk &lt;symbol&gt; – scam/risk check a coin (e.g. /risk PEPE)",
  "/winrate – our honest, hypothetical win-rate stats",
  "/disclaimer – full risk disclaimer & terms of use",
  "",
  "<i>⚠️ Everything this service publishes is educational information, not financial advice. Read /disclaimer before acting on anything.</i>",
].join("\n");

const helpFor = (chatId: number) => (bot.isAdmin(chatId) ? adminHelpText : publicHelpText);

const COMMAND_MENU = [
  { command: "scan", description: "Force a scan right now" },
  { command: "top", description: "Current top movers" },
  { command: "status", description: "Scanner health" },
  { command: "risk", description: "Scam/risk check a coin (e.g. /risk PEPE)" },
  { command: "winrate", description: "Honest win rate of past signals" },
  { command: "track", description: "Open paper-trades right now" },
  { command: "settings", description: "View detection thresholds" },
  { command: "set", description: "Tune a threshold (/set minScore 20)" },
  { command: "pause", description: "Pause alerts" },
  { command: "resume", description: "Resume alerts" },
  { command: "disclaimer", description: "Risk disclaimer & terms of use" },
  { command: "help", description: "Show all commands" },
];

bot.on("start", (_args, chatId) => helpFor(chatId));
bot.on("help", (_args, chatId) => helpFor(chatId));
bot.on("disclaimer", () => formatDisclaimer(cfg.serviceName));
bot.on("terms", () => formatDisclaimer(cfg.serviceName));
bot.on("status", () => statusText(), { adminOnly: true });
bot.on("settings", () => settingsText(cfg.thresholds), { adminOnly: true });
bot.on("top", () => formatTopMovers(scanner.topMovers(10)));
const perf = () => formatPerformance(scanner.tracker.summary(), cfg.trackHorizonMinutes);
bot.on("performance", perf);
bot.on("stats", perf);
bot.on("winrate", perf);
bot.on("track", () => formatOpenTrades(scanner.tracker.openList(Date.now())), { adminOnly: true });

bot.on("risk", async (args, chatId) => {
  const input = args[0];
  if (!input) return "Usage: /risk <symbol>   e.g. /risk PEPE";
  const res = await scanner.analyze(input);
  if ("error" in res) return res.error;
  const buttons = [
    [
      { text: `View on ${cfg.exchange.toUpperCase()} ↗`, url: scanner.market.tradeUrl(res.symbol) },
      { text: "📈 TradingView ↗", url: scanner.market.tradingViewUrl(res.symbol) },
    ],
    [{ text: "Dex Screener ↗", url: scanner.market.dexScreenerUrl(res.symbol) }],
  ];
  await bot.send(formatRiskReport(res), chatId, buttons);
});

bot.on("set", (args) => {
  const [key, valueRaw] = args;
  if (!key || valueRaw === undefined) return "Usage: /set <key> <value>  (see /settings)";
  if (!THRESHOLD_KEYS.includes(key as keyof Thresholds)) {
    return `Unknown key "${key}". Valid: ${THRESHOLD_KEYS.join(", ")}`;
  }
  const value = Number(valueRaw);
  if (!Number.isFinite(value)) return `"${valueRaw}" is not a number.`;
  (cfg.thresholds[key as keyof Thresholds] as number) = value;
  return `✅ ${key} = ${value}`;
}, { adminOnly: true });

bot.on("pause", () => {
  paused = true;
  return "⏸ Alerts paused. /resume to re-enable.";
}, { adminOnly: true });
bot.on("resume", () => {
  paused = false;
  return "▶️ Alerts resumed.";
}, { adminOnly: true });
bot.on("scan", async () => {
  const found = await scanner.scanOnce();
  const st = scanner.stats;
  if (found.length) {
    return `Scan complete — ${found.length} signal(s). Top: ${found[0]!.symbol} (${found[0]!.score}/100)`;
  }
  const funnel = `Scanned ${st.symbolsTracked} markets → ${st.liquidCount} liquid → ${st.deepScanned} deep-scanned → 0 signals.`;
  if (st.symbolsTracked === 0) {
    return `${funnel}\n⚠️ No markets loaded — exchange not reachable. ${st.lastError ?? ""}`;
  }
  if (st.liquidCount === 0) {
    return `${funnel}\n⚠️ Nothing passed the liquidity filter — lower it: <code>/set minQuoteVolume 50000</code>`;
  }
  if (st.lastNearMiss) {
    const n = st.lastNearMiss;
    return `${funnel}\nClosest: ${n.symbol} +${n.change}% vol ${n.surge}× rsi ${n.rsi} score ${n.score} — <i>${n.reject}</i>\nLoosen with /set to catch it.`;
  }
  return `${funnel}\nNothing close — markets are calm right now.`;
}, { adminOnly: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Try to load markets; report a clear, actionable error to Telegram on failure. */
async function tryInit(): Promise<boolean> {
  try {
    await scanner.init();
    return true;
  } catch (err) {
    const msg = (err as Error).message;
    log.error("exchange init failed:", msg);
    scanner.stats.lastError = `init: ${msg.slice(0, 160)}`;
    scanner.stats.errors++;
    const geoBlocked = /\b(451|403|418)\b/.test(msg) || /restricted|not in allowlist|legal reasons|eligibility/i.test(msg);
    await bot.send(
      `⚠️ <b>Can't reach ${cfg.exchange}.</b>\n<code>${msg.slice(0, 200)}</code>\n\n` +
        (geoBlocked
          ? `This server's region is likely <b>geo-blocked</b> by ${cfg.exchange}. Fix: set Railway variable <code>EXCHANGE</code> to <code>bybit</code>, <code>kucoin</code>, <code>okx</code>, or <code>mexc</code> and redeploy.`
          : `I'll keep retrying.`),
    );
    return false;
  }
}

async function main() {
  log.info(`Starting pump scanner · exchange=${cfg.exchange} quote=${cfg.quote} dryRun=${cfg.dryRun}`);

  const username = await bot.getMe();
  if (username) {
    log.ok(`Connected to Telegram as @${username}`);
    // Register the "/" menu so commands are selectable in the Telegram UI.
    await bot.setMyCommands(COMMAND_MENU);
    // Start the command listener FIRST so /status etc. work even if the exchange is down.
    if (!runOnce) void bot.startPolling();
  } else {
    log.warn("Telegram token missing/invalid — set TELEGRAM_BOT_TOKEN. Running without messaging.");
  }

  if (runOnce) {
    if (await tryInit()) {
      const found = await scanner.scanOnce();
      log.ok(`One-shot scan done. ${found.length} signal(s). Markets: ${scanner.stats.symbolsTracked}`);
    }
    return;
  }

  let ready = await tryInit();
  if (ready && username) {
    await bot.broadcast(
      `🚀 <b>Pump Scanner started</b>\nWatching ${scanner.stats.symbolsTracked} ${cfg.quote} ${cfg.marketType} markets on ${cfg.exchange}.\nMin move +${cfg.thresholds.minWindowChangePct}% · ${cfg.thresholds.minVolumeSurge}× volume.`,
    );
  }

  // scan loop — keeps running; re-attempts init if the exchange wasn't reachable yet.
  let lastHeartbeat = Date.now();
  let lastDigestDay = -1;
  for (;;) {
    if (!paused) {
      if (!ready) {
        ready = await tryInit();
        if (ready) await bot.broadcast("✅ Connected to the exchange — scanning now.");
      }
      if (ready) {
        try {
          await scanner.scanOnce();
        } catch (err) {
          log.error("loop error:", (err as Error).message);
        }

        // Daily digest to the subscriber channel — the automated "newsletter".
        const now = new Date();
        if (
          channelMode &&
          cfg.digestHourUtc >= 0 &&
          now.getUTCHours() === cfg.digestHourUtc &&
          now.getUTCDate() !== lastDigestDay
        ) {
          lastDigestDay = now.getUTCDate();
          const s = scanner.tracker.summary();
          const digest = formatDigest({
            serviceName: cfg.serviceName,
            dateUtc: now.toISOString().slice(0, 10),
            signalsToday: daily.signals,
            bestToday: daily.best,
            perf: {
              closed: s.closed,
              wins: s.wins,
              winRate: s.winRate,
              avgFinalPct: s.avgFinalPct,
              targetPct: s.targetPct,
              stopPct: s.stopPct,
            },
            horizonMin: cfg.trackHorizonMinutes,
            movers: scanner.topMovers(5),
          });
          daily.reset();
          if (cfg.dryRun) log.ok("[DRY_RUN] digest:\n" + digest);
          else await bot.send(digest, cfg.channelId);
          log.ok("Daily digest sent to channel.");
        }

        // Periodic proof-of-life so quiet stretches don't look like a crash.
        if (cfg.heartbeatMinutes > 0 && Date.now() - lastHeartbeat >= cfg.heartbeatMinutes * 60_000) {
          lastHeartbeat = Date.now();
          const top = scanner.topMovers(1)[0];
          const topStr = top ? `Top: ${top.symbol} ${top.percentage >= 0 ? "+" : ""}${top.percentage.toFixed(1)}%` : "";
          if (username) {
            await bot.broadcast(
              `💓 <b>Still scanning</b> ${scanner.stats.symbolsTracked} markets on ${cfg.exchange}.\n` +
                `${scanner.stats.scans} scans · ${scanner.stats.signalsTotal} signals so far. ${topStr}`,
            );
          }
        }
      }
    }
    await sleep(cfg.scanIntervalSec * 1000);
  }
}

main().catch((err) => {
  log.error("fatal:", err);
  process.exit(1);
});

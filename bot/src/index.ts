import { loadConfig, THRESHOLD_KEYS, type Thresholds } from "./config.js";
import { Scanner } from "./scanner.js";
import { TelegramBot } from "./telegram.js";
import {
  formatSignal,
  formatTopMovers,
  formatRiskReport,
  formatPerformance,
  formatOpenTrades,
} from "./format.js";
import { log } from "./logger.js";

const cfg = loadConfig();
const runOnce = process.argv.includes("--once");

const bot = new TelegramBot(cfg.telegramToken, cfg.chatId);
const scanner = new Scanner(cfg, (signal) => {
  const windowSeconds = cfg.thresholds.windowMinutes * 60;
  const text = formatSignal(signal, cfg.exchange, windowSeconds);
  const buttons = [
    [
      { text: `${cfg.exchange.toUpperCase()} Swap ↗`, url: scanner.market.tradeUrl(signal.symbol) },
      { text: "Dex Screener ↗", url: scanner.market.dexScreenerUrl(signal.symbol) },
    ],
  ];
  if (cfg.dryRun) log.ok("[DRY_RUN] signal:\n" + text);
  else void bot.broadcast(text, buttons);
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
    `Exchange: <code>${scanner.market.id}</code>`,
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
const helpText = [
  "👋 <b>Pump Scanner online.</b>",
  `Watching ${cfg.exchange} ${cfg.quote} markets for momentum + volume surges.`,
  "",
  "I'll DM you when a coin starts pumping. Commands:",
  "/status – scanner health",
  "/top – current top movers",
  "/risk &lt;symbol&gt; – scam/risk check a coin (e.g. /risk PEPE)",
  "/performance – how past signals played out",
  "/track – open paper-trades right now",
  "/settings – view thresholds",
  "/set &lt;key&gt; &lt;value&gt; – tune a threshold",
  "/scan – force a scan now",
  "/pause · /resume – toggle alerts",
  "",
  "<i>Signals are momentum alerts, not financial advice.</i>",
].join("\n");

bot.on("start", () => helpText);
bot.on("help", () => helpText);
bot.on("status", () => statusText());
bot.on("settings", () => settingsText(cfg.thresholds));
bot.on("top", () => formatTopMovers(scanner.topMovers(10)));
bot.on("performance", () =>
  formatPerformance(scanner.tracker.summary(), cfg.winThresholdPct, cfg.trackHorizonMinutes),
);
bot.on("stats", () =>
  formatPerformance(scanner.tracker.summary(), cfg.winThresholdPct, cfg.trackHorizonMinutes),
);
bot.on("track", () => formatOpenTrades(scanner.tracker.openList(Date.now())));

bot.on("risk", async (args, chatId) => {
  const input = args[0];
  if (!input) return "Usage: /risk <symbol>   e.g. /risk PEPE";
  const res = await scanner.analyze(input);
  if ("error" in res) return res.error;
  const buttons = [
    [
      { text: `🟢 Buy on ${cfg.exchange.toUpperCase()}`, url: scanner.market.tradeUrl(res.symbol) },
      { text: "📊 Dex Screener", url: scanner.market.dexScreenerUrl(res.symbol) },
    ],
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
});

bot.on("pause", () => {
  paused = true;
  return "⏸ Alerts paused. /resume to re-enable.";
});
bot.on("resume", () => {
  paused = false;
  return "▶️ Alerts resumed.";
});
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
});

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
      `🚀 <b>Pump Scanner started</b>\nWatching ${scanner.stats.symbolsTracked} ${cfg.quote} markets on ${cfg.exchange}.\nMin move +${cfg.thresholds.minWindowChangePct}% / ${cfg.thresholds.windowMinutes}m · ${cfg.thresholds.minVolumeSurge}× volume.`,
    );
  }

  // scan loop — keeps running; re-attempts init if the exchange wasn't reachable yet.
  let lastHeartbeat = Date.now();
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

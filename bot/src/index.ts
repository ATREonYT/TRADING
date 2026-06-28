import { loadConfig, THRESHOLD_KEYS, type Thresholds } from "./config.js";
import { Scanner } from "./scanner.js";
import { TelegramBot } from "./telegram.js";
import { formatSignal, formatTopMovers } from "./format.js";
import { log } from "./logger.js";

const cfg = loadConfig();
const runOnce = process.argv.includes("--once");

const bot = new TelegramBot(cfg.telegramToken, cfg.chatId);
const scanner = new Scanner(cfg, (signal) => {
  const text = formatSignal(signal, scanner.market.chartUrl(signal.symbol));
  if (cfg.dryRun) log.ok("[DRY_RUN] signal:\n" + text);
  else void bot.send(text);
  log.ok(`SIGNAL ${signal.symbol} score=${signal.score} +${signal.windowChangePct}% vol=${signal.volumeSurge}x`);
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
    `cooldownMinutes: <code>${t.cooldownMinutes}</code>`,
    ``,
    `Adjust with <code>/set &lt;key&gt; &lt;value&gt;</code>`,
  ].join("\n");
}

function statusText(): string {
  const st = scanner.stats;
  return [
    `<b>Pump Scanner</b> ${paused ? "⏸ paused" : "▶️ running"}`,
    `Exchange: <code>${scanner.market.id}</code>`,
    `Uptime: ${uptime(Date.now() - st.startedAt)}`,
    `Markets tracked: ${st.symbolsTracked}`,
    `Scans: ${st.scans} · last deep-scan ${st.deepScanned} symbols in ${st.lastScanMs}ms`,
    `Signals sent: ${st.signalsTotal}`,
    st.lastError ? `Last error: <code>${st.lastError}</code>` : `Errors: ${st.errors}`,
  ].join("\n");
}

// --- command handlers ---
const helpText = [
  "👋 <b>Pump Scanner online.</b>",
  `Watching ${cfg.exchange} ${cfg.quote} markets for momentum + volume surges.`,
  "",
  "I'll DM you when a coin starts pumping. Commands:",
  "/status – scanner health",
  "/top – current top movers",
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
  return found.length
    ? `Scan complete — ${found.length} signal(s). Top: ${found[0]!.symbol} (${found[0]!.score}/100)`
    : "Scan complete — no signals right now.";
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
    const geoBlocked = /\b(451|403)\b/.test(msg) || /restricted|not in allowlist|legal reasons/i.test(msg);
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
  if (ready && username && cfg.chatId) {
    await bot.send(
      `🚀 <b>Pump Scanner started</b>\nWatching ${scanner.stats.symbolsTracked} ${cfg.quote} markets on ${cfg.exchange}.\nMin move +${cfg.thresholds.minWindowChangePct}% / ${cfg.thresholds.windowMinutes}m · ${cfg.thresholds.minVolumeSurge}× volume.`,
    );
  }

  // scan loop — keeps running; re-attempts init if the exchange wasn't reachable yet.
  for (;;) {
    if (!paused) {
      if (!ready) {
        ready = await tryInit();
        if (ready) await bot.send("✅ Connected to the exchange — scanning now.");
      }
      if (ready) {
        try {
          await scanner.scanOnce();
        } catch (err) {
          log.error("loop error:", (err as Error).message);
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

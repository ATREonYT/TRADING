import "dotenv/config";

function envNum(key: string, def: number): number {
  const v = process.env[key];
  if (v === undefined || v.trim() === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function envStr(key: string, def: string): string {
  const v = process.env[key];
  return v === undefined || v.trim() === "" ? def : v.trim();
}

function envBool(key: string, def: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return def;
  return ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
}

/** Runtime-tunable thresholds (some adjustable via /set). */
export interface Thresholds {
  /** Lookback window for the trigger price move, in 1m candles. */
  windowMinutes: number;
  /** Minimum % price change over the window to consider a pump. */
  minWindowChangePct: number;
  /** Trigger-candle volume must be >= this multiple of the recent average. */
  minVolumeSurge: number;
  /** Minimum 24h quote (USDT) volume — liquidity filter, skips manipulable micro-caps. */
  minQuoteVolume: number;
  /** Reject if RSI(14) above this (already overbought / likely late). */
  maxRsi: number;
  /** Minimum composite score (0-100) required to send an alert. */
  minScore: number;
  /** Skip alerts whose scam/risk score exceeds this (0 clean .. 100 trap). */
  maxRiskScore: number;
  /** Per-symbol alert cooldown in minutes (anti-spam). */
  cooldownMinutes: number;
}

export interface Config {
  telegramToken: string;
  chatId: string;
  exchange: string;
  quote: string;
  scanIntervalSec: number;
  /** Max symbols to deep-scan (fetch klines) per cycle after prefilter. */
  maxDeepScan: number;
  /** Confirm buy-side pressure in the live order book before alerting. */
  checkOrderBook: boolean;
  /** Minutes between "still alive" heartbeat messages. 0 = off. */
  heartbeatMinutes: number;
  dryRun: boolean;
  thresholds: Thresholds;
}

export function loadConfig(): Config {
  return {
    telegramToken: envStr("TELEGRAM_BOT_TOKEN", ""),
    chatId: envStr("TELEGRAM_CHAT_ID", ""),
    exchange: envStr("EXCHANGE", "binance"),
    quote: envStr("QUOTE_CURRENCY", "USDT"),
    scanIntervalSec: envNum("SCAN_INTERVAL_SEC", 20),
    maxDeepScan: envNum("MAX_DEEP_SCAN", 40),
    checkOrderBook: envBool("CHECK_ORDER_BOOK", true),
    heartbeatMinutes: envNum("HEARTBEAT_MINUTES", 60),
    dryRun: envBool("DRY_RUN", false),
    thresholds: {
      windowMinutes: envNum("WINDOW_MINUTES", 5),
      minWindowChangePct: envNum("MIN_WINDOW_CHANGE_PCT", 4),
      minVolumeSurge: envNum("MIN_VOLUME_SURGE", 3),
      minQuoteVolume: envNum("MIN_QUOTE_VOLUME", 300_000),
      maxRsi: envNum("MAX_RSI", 82),
      minScore: envNum("MIN_SCORE", 50),
      maxRiskScore: envNum("MAX_RISK_SCORE", 65),
      cooldownMinutes: envNum("COOLDOWN_MINUTES", 30),
    },
  };
}

export const THRESHOLD_KEYS: (keyof Thresholds)[] = [
  "windowMinutes",
  "minWindowChangePct",
  "minVolumeSurge",
  "minQuoteVolume",
  "maxRsi",
  "minScore",
  "maxRiskScore",
  "cooldownMinutes",
];

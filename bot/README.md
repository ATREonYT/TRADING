# Pump Scanner Bot

A Telegram bot that continuously scans crypto markets for **unusual momentum + volume
surges** ("pumps") and DMs you a buy alert with the symbol, the move, why it fired, and a
chart link.

> ⚠️ **Not financial advice.** This is a momentum/anomaly scanner. It detects pumps that
> are *already starting* — no tool can reliably predict one beforehand. Chasing pumps is
> high-risk and you can lose money fast. Signals are informational only; always do your own
> research and manage risk.

## How it works

```
exchange (ccxt) ──▶ 24h ticker prefilter ──▶ deep-scan top N (1m klines) ──▶ detector ──▶ Telegram alert
                     (liquidity + momentum)     (price/volume/RSI/breakout)   (score ≥ min)   (per-symbol cooldown)
```

A signal requires **both** a fast price move **and** a volume surge over the window — price
alone is noise, volume alone is accumulation. The detector blends four factors into a
0–100 score:

| Factor | What it measures |
|--------|------------------|
| **Momentum** | % price change over the last `WINDOW_MINUTES` |
| **Volume** | trigger-candle volume ÷ recent average |
| **Breakout** | new local high vs the prior 30 candles |
| **Acceleration** | consecutive green candles |

It then **penalises overbought names** (high RSI = likely late) and **hard-gates** on
liquidity, so easily-manipulated micro-caps never surface.

## Setup

```bash
cd bot
npm install
cp .env.example .env
```

1. Create a bot with **[@BotFather](https://t.me/BotFather)** → copy the token into
   `TELEGRAM_BOT_TOKEN`.
2. Message **[@userinfobot](https://t.me/userinfobot)** to get your numeric id → put it in
   `TELEGRAM_CHAT_ID`.
3. (Optional) tune thresholds in `.env`.

## Run

```bash
npm start          # start the scanner + command bot
npm run scan:once  # single scan cycle then exit (good for cron / testing)
npm test           # unit tests for the detection engine
npm run typecheck  # tsc --noEmit
```

Run `DRY_RUN=true npm start` to log signals to the console instead of Telegram.

## Telegram commands

| Command | Description |
|---------|-------------|
| `/start`, `/help` | intro + command list |
| `/status` | scanner health, uptime, markets tracked, signals sent |
| `/top` | current top 24h movers (liquid only) |
| `/risk <symbol>` | run the scam/risk check on any coin, e.g. `/risk PEPE` |
| `/performance` | how past signals played out (paper-traded win rate, avg peak/result) |
| `/track` | currently open paper-trades and their live P&L |
| `/settings` | view all thresholds |
| `/set <key> <value>` | tune a threshold live, e.g. `/set minVolumeSurge 4` |
| `/scan` | force a scan right now |
| `/pause` / `/resume` | toggle scanning |

## Configuration

All settings are environment variables (see `.env.example`). The thresholds are also
adjustable at runtime via `/set`. Exchange can be any
[ccxt](https://github.com/ccxt/ccxt)-supported id (`binance`, `bybit`, `okx`, `kucoin`,
`mexc`, …) — read-only market data, **no API key required**.

**Spot or futures:** set `MARKET_TYPE=swap` to scan **linear USDT perpetual futures**
(where most pumps/dumps happen) instead of spot. Alerts then link to the exchange's
futures page and show `(swap)`. Run a second instance with `MARKET_TYPE=spot` if you want
both at once.

### Network note

Market data is fetched from the exchange's public REST API (e.g. `api.binance.com`). If you
run this behind a restrictive firewall or in a sandbox, allowlist that host. Some exchanges
geo-block certain regions — switch `EXCHANGE` if `loadMarkets` returns 403.

## Project layout

```
src/
  config.ts      env → typed config + thresholds
  types.ts       shared domain types
  indicators.ts  pure TA: sma, rsi, pctChange, volumeSurge, breakout, …
  detector.ts    evaluate() → scored Signal | null  (pure, unit-tested)
  exchange.ts    ccxt wrapper: markets, tickers, OHLCV
  scanner.ts     scan cycle, prefilter, cooldowns, stats
  telegram.ts    Bot API client: send + long-poll command router
  format.ts      alert / top-movers formatting (HTML)
  index.ts       wiring: config → scanner + bot + scan loop
test/            node:test unit tests (no live network needed)
```

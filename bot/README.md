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
| `/winrate` (`/performance`) | honest win rate — % of signals that hit +target before −stop |
| `/track` | currently open paper-trades and their live P&L |
| `/settings` | view all thresholds |
| `/set <key> <value>` | tune a threshold live, e.g. `/set minVolumeSurge 4` |
| `/scan` | force a scan right now |
| `/pause` / `/resume` | toggle scanning |
| `/disclaimer` (`/terms`) | full risk disclaimer & terms of use |

In channel mode (`TELEGRAM_CHANNEL_ID` set), control commands are restricted to the
admin chat; everyone else can use `/top`, `/risk`, `/winrate`, and `/disclaimer`.

## Configuration

All settings are environment variables (see `.env.example`). The thresholds are also
adjustable at runtime via `/set`. Exchange can be any
[ccxt](https://github.com/ccxt/ccxt)-supported id (`binance`, `bybit`, `okx`, `kucoin`,
`mexc`, …) — read-only market data, **no API key required**.

**Spot or futures:** set `MARKET_TYPE=swap` to scan **linear USDT perpetual futures**
(where most pumps/dumps happen) instead of spot. Alerts then link to the exchange's
futures page and show `(swap)`. Run a second instance with `MARKET_TYPE=spot` if you want
both at once.

**Pumps and/or dumps:** set `SIGNAL_DIRECTION=both` to also get **dump/short** alerts
(red ▼, `#dump`, "Short" button) alongside pumps — useful on futures where you can short.
Use `dump` for shorts only, `pump` (default) for longs only. Dump scoring penalises
already-oversold (crashed) names just as pump scoring penalises overbought ones.

## Running it as a paid subscriber channel

The bot can power a **signals channel + daily digest** (a small subscription business)
instead of just DMing you. Set `TELEGRAM_CHANNEL_ID` and it switches to channel mode:

- Every signal is **also posted to the channel**, with neutral "view chart" buttons (no
  buy/sell call-to-action) and a **risk disclaimer appended to every message**.
- A **daily digest** posts at `DIGEST_HOUR_UTC`: signals fired in the last 24h, the
  strongest one, the honest paper-tracked win rate, and the top movers. This is your
  automated "newsletter".
- **Admin lockdown**: control commands (`/set`, `/pause`, `/resume`, `/scan`,
  `/status`, `/settings`, `/track`) only work from `TELEGRAM_CHAT_ID`, and strangers
  who DM the bot are *not* added to the broadcast list — so nobody gets the paid feed
  for free or reconfigures your scanner. Public users can still run `/top`, `/risk`,
  `/winrate`, and `/disclaimer` — good free-tier hooks.

### Setup

1. Create a **private** Telegram channel.
2. Add your bot as a channel **admin** with "Post messages" permission.
3. Get the channel's numeric id (forward any channel post to
   [@userinfobot](https://t.me/userinfobot); it looks like `-100...`) and put it in
   `TELEGRAM_CHANNEL_ID`.
4. Sell access with a platform that gates Telegram invites behind payment and manages
   kicks on non-payment — e.g. **Whop**, **LaunchPass**, or **InviteMember** — rather
   than handling invite links by hand.

### Protecting yourself legally — checklist

**No disclaimer makes you immune from lawsuits or regulators**, but signal services
that follow all of the practices below are dramatically better protected. This repo
handles the technical parts automatically; the rest is on you:

- [ ] **Read and publish `TERMS.md`** (in this folder): fill in the placeholders, pin
      it in the channel, link it in the channel description.
- [ ] **Require terms acceptance at checkout** — Whop/Stripe/Gumroad all support a
      mandatory "I agree to the terms" checkbox. Acceptance at purchase is your
      strongest evidence.
- [ ] **Form an LLC** (or local equivalent) and run the service through it, so claims
      target the company rather than your personal assets.
- [ ] **Have a local lawyer review** `TERMS.md` once — cheap relative to what it buys.
      Rules differ by country, and if you ever cover securities (stocks) rather than
      crypto, stricter regimes (e.g. investment-adviser registration) can apply.
- [ ] **Never give personalized advice.** The legal theory that protects publishers of
      impersonal, one-to-many market commentary collapses the moment you DM someone
      "you should buy X". Don't answer "what should I buy?" — point at /disclaimer.
- [ ] **Never promise profits or post inflated results.** This bot's `/winrate` is
      deliberately honest (paper-tracked, labeled hypothetical) — keep your marketing
      to the same standard. Fabricated performance claims are what actually gets signal
      sellers sued and prosecuted, not losing trades.
- [ ] **Don't touch other people's money** — no managing funds, no trading on anyone's
      behalf, no profit-sharing arrangements.

What's automated for you: the disclaimer footer on every channel message, the full
`/disclaimer` command, neutral non-advice wording on subscriber-facing buttons, honest
hypothetical-performance labeling, and admin-only control of the scanner.

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

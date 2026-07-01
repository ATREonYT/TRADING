# Radar — Live Market Intelligence

Radar is a real-time market-intelligence surface built into the Helix app. It
**scans world & financial news across the internet**, **scans the markets**, and
turns both into **explainable, ranked trade ideas** — updating live so you can
catch moves as they happen.

Open it at **`/radar`** (also linked in the top nav).

> ⚠️ **Not financial advice.** Radar is an automated information tool. Every
> "idea" is a transparent heuristic computed from public price, volume and news
> data — never a recommendation. Do your own research.

## What it does

| Surface | What you get |
| --- | --- |
| **Breaking ticker** | Highest-impact, most recent headlines scroll across the top the second they're detected. |
| **Market Pulse** | The biggest movers market-wide, with an ⚡ flag on names showing **unusual volume** (a common precursor to a spike). |
| **World & Market News** | A live, de-duplicated, sentiment-scored feed. Filter by category (equities, crypto, macro, tech, commodities, geopolitics), tone (bullish/bearish), or free-text/ticker search. Each item shows an impact meter and the tickers it mentions. |
| **Market Scanner · Ideas** | Every scanned symbol scored 0–100 by fusing **momentum + volume + news sentiment**. Expand any row to see the score breakdown, the plain-English drivers, and the exact headlines behind it. Filter to `buy`, `watch`, equities or crypto. |

Everything refreshes on an interval (news every 20s, markets every 30s) and new
items flash as they arrive. A **LIVE** pill shows how fresh the data is.

## How the scoring works (transparent by design)

- **Momentum** — session % change, scaled and capped.
- **Volume** — latest volume vs. its recent average (`>1.8×` = unusual).
- **News** — impact-weighted average sentiment of headlines linked to the symbol.
- **Composite** — `0.45·momentum + 0.25·volume + 0.30·news`, mapped to 0–100.
  `≥66 & rising → buy`, `≤38 → avoid`, otherwise `watch`.

Sentiment uses a finance-tuned lexicon (`lib/radar/nlp.ts`) — no black box, so
you can read exactly why anything scored the way it did.

## Trade on Freedom24

**Trade on Freedom24** buttons open the **exact instrument** at Freedom24 so you
can place the order with your broker. Helix never executes orders — the buttons
just hand off. They appear:

- on the **main dashboard chart** (opens the exact stock you're viewing),
- in each **signal's** detail panel,
- on every **Market Pulse** mover card,
- as a header CTA.

Links use Freedom24's real instrument path,
`https://freedom24.com/what-to-buy/stocks/{TICKER}` — e.g. viewing NVDA links to
`https://freedom24.com/what-to-buy/stocks/NVDA.US`. Freedom24 identifies stocks
with a market-suffixed ticker (`.US` for US listings); crypto maps to the base
coin and falls back to Freedom24's browse page.

Two optional env vars tune the links:

```bash
# Override the URL pattern (e.g. to point at the logged-in terminal).
# Use {ticker} as the placeholder.
NEXT_PUBLIC_FREEDOM24_URL="https://freedom24.com/what-to-buy/stocks/{ticker}"

# Optional partner / referral code appended to every Freedom24 link.
NEXT_PUBLIC_FREEDOM24_REF="your-code"
```

## Data sources (keyless, public)

- **News** — **65+ outlets**: Google News topic feeds (searches the whole web),
  the major wires & papers (Reuters, Bloomberg, AP, Financial Times, WSJ,
  Barron's, The Economist, Nikkei, SCMP), six CNBC desks, four MarketWatch
  feeds, Yahoo Finance, Investing.com, Business Insider, Seeking Alpha, Forbes,
  Fortune, Fox Business, Benzinga, TheStreet, Kiplinger, BBC, The Guardian, NYT,
  NPR, Al Jazeera, Sky News, OilPrice, and eight crypto desks (CoinDesk,
  Cointelegraph, Decrypt, The Block, CryptoSlate, Bitcoin Magazine, and more).
  See `lib/radar/sources.ts`. Feeds are fetched 12-at-a-time and cached ~15s.
- **Equities** — Yahoo Finance chart API (price history + volume).
- **Crypto** — Binance klines (OHLCV).

No API keys required. All fetching happens **server-side** in the API routes.

## Architecture

```
lib/radar/
  types.ts      shared types
  sources.ts    RSS feed list + scanned symbol universe
  rss.ts        dependency-free RSS/Atom fetch + parse
  nlp.ts        sentiment, impact, ticker extraction, dedup + ranking
  market.ts     Yahoo (equities) + Binance (crypto) quotes, with a pooled fetcher
  signals.ts    fuses market + news into scored, explained ideas
  demo.ts       deterministic fallback data (offline/blocked environments)

app/api/radar/
  news/route.ts      GET → enriched news feed
  markets/route.ts   GET → live quotes, biggest movers first
  signals/route.ts   GET → ranked trade ideas

components/radar/     RadarView + BreakingBanner, MarketPulse, NewsFeed,
                      SignalsPanel, and the useLive polling hook
app/radar/page.tsx    the page
```

## Deploying for live data

The API routes need **outbound HTTPS** to the sources above. In a locked-down
or offline environment those hosts are blocked, so Radar automatically falls
back to clearly-labelled **demo data** (`degraded: true` in every response and a
banner in the UI). Deploy to any host with normal egress (Vercel, Render, a VPS,
your own machine via `npm run dev`) and it streams real data with no config.

```bash
npm install
npm run dev     # http://localhost:3000/radar
```

// "Trade on Freedom24" deep links.
//
// Freedom24 identifies every instrument with a market-suffixed ticker
// (e.g. AAPL.US, ASML.EU, TSLA.US). Our equity universe is all US-listed, so
// ".US" is the correct default; crypto maps to the base coin symbol.
//
// Freedom24's public instrument page is /what-to-buy/stocks/{TICKER} (e.g.
// https://freedom24.com/what-to-buy/stocks/TSLA.US) — the button opens that
// exact stock. Override the pattern with NEXT_PUBLIC_FREEDOM24_URL (use
// `{ticker}` as the placeholder) if you want the logged-in terminal URL
// instead. Add a partner/referral code with NEXT_PUBLIC_FREEDOM24_REF.

const CUSTOM = process.env.NEXT_PUBLIC_FREEDOM24_URL?.trim() || "";
const EQUITY_DEFAULT = "https://freedom24.com/what-to-buy/stocks/{ticker}";
// Freedom24's crypto listings don't live under /stocks; browse page is the safe
// landing when no custom template is configured.
const CRYPTO_DEFAULT = "https://freedom24.com/what-to-buy";
const REF = process.env.NEXT_PUBLIC_FREEDOM24_REF?.trim() || "";

const withRef = (url: string): string =>
  REF ? `${url}${url.includes("?") ? "&" : "?"}ref=${encodeURIComponent(REF)}` : url;

/** Convert an internal symbol (e.g. "AAPL", "BTC-USD") to a Freedom24 ticker. */
export function toF24Ticker(symbol: string, kind: "equity" | "crypto"): string {
  if (kind === "crypto") return symbol.replace(/-USD$/i, "");
  return /\.[A-Z]{2}$/.test(symbol) ? symbol : `${symbol}.US`;
}

/** Deep link that opens the exact instrument on Freedom24. */
export function freedom24Url(symbol: string, kind: "equity" | "crypto"): string {
  const ticker = toF24Ticker(symbol, kind);
  const template = CUSTOM || (kind === "crypto" ? CRYPTO_DEFAULT : EQUITY_DEFAULT);
  let url: string;
  if (template.includes("{ticker}")) {
    url = template.replace(/\{ticker\}/g, encodeURIComponent(ticker));
  } else if (kind === "crypto" && !CUSTOM) {
    url = template; // browse page — no per-coin path
  } else {
    const sep = template.includes("?") ? "&" : "?";
    url = `${template}${sep}ticker=${encodeURIComponent(ticker)}`;
  }
  return withRef(url);
}

/** Freedom24 home / open-account link (carries the referral code if set). */
export const FREEDOM24_HOME = withRef("https://freedom24.com/");

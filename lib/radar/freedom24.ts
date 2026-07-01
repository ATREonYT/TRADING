// "Trade on Freedom24" deep links.
//
// Freedom24 identifies every instrument with a market-suffixed ticker
// (e.g. AAPL.US, ASML.EU, TSLA.US). Our equity universe is all US-listed, so
// ".US" is the correct default; crypto maps to the base coin symbol.
//
// The link template is environment-configurable because Freedom24 blocks
// automated verification of its exact instrument path. To point the buttons at
// the precise page you see when logged in, set NEXT_PUBLIC_FREEDOM24_URL and use
// `{ticker}` as the placeholder, e.g.
//   NEXT_PUBLIC_FREEDOM24_URL="https://freedom24.com/charts/{ticker}"
// Add a partner/referral code with NEXT_PUBLIC_FREEDOM24_REF.

const TEMPLATE =
  process.env.NEXT_PUBLIC_FREEDOM24_URL?.trim() || "https://freedom24.com/us-stocks";
const REF = process.env.NEXT_PUBLIC_FREEDOM24_REF?.trim() || "";

const withRef = (url: string): string =>
  REF ? `${url}${url.includes("?") ? "&" : "?"}ref=${encodeURIComponent(REF)}` : url;

/** Convert an internal symbol (e.g. "AAPL", "BTC-USD") to a Freedom24 ticker. */
export function toF24Ticker(symbol: string, kind: "equity" | "crypto"): string {
  if (kind === "crypto") return symbol.replace(/-USD$/i, "");
  return /\.[A-Z]{2}$/.test(symbol) ? symbol : `${symbol}.US`;
}

/** Deep link that opens the instrument on Freedom24. */
export function freedom24Url(symbol: string, kind: "equity" | "crypto"): string {
  const ticker = toF24Ticker(symbol, kind);
  let url: string;
  if (TEMPLATE.includes("{ticker}")) {
    url = TEMPLATE.replace(/\{ticker\}/g, encodeURIComponent(ticker));
  } else {
    const sep = TEMPLATE.includes("?") ? "&" : "?";
    url = `${TEMPLATE}${sep}ticker=${encodeURIComponent(ticker)}`;
  }
  return withRef(url);
}

/** Freedom24 home / open-account link (carries the referral code if set). */
export const FREEDOM24_HOME = withRef("https://freedom24.com/");

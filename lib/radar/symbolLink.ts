// A single source of truth for "open this symbol in the Radar". Crypto pairs
// (e.g. BTC-USD) collapse to their base so the Radar search matches both the
// coin and its pair form.
export function radarLink(symbol: string): string {
  const q = symbol.replace(/-USD$/i, "");
  return `/radar?q=${encodeURIComponent(q)}`;
}

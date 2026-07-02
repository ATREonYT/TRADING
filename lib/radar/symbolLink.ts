// A single source of truth for "open this symbol's page" — the dedicated
// per-stock view with news + analytics catered to that instrument.
export function radarLink(symbol: string): string {
  return `/stock/${encodeURIComponent(symbol.toUpperCase())}`;
}

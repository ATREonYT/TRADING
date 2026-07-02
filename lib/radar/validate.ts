// Input sanitization for anything user-supplied or fetched from third parties.

/** Instrument symbols: uppercase letters/digits, dots and dashes, bounded length. */
const SYMBOL_RE = /^[A-Z0-9.\-]{1,15}$/;

export function isValidSymbol(s: string): boolean {
  return SYMBOL_RE.test(s);
}

/** Escape a string so it can be embedded in a RegExp literally. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Only allow http(s) links from third-party feeds (blocks javascript:, data:). */
export function safeHttpUrl(url: string): string {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : "";
}

// Locale-aware, tabular-friendly formatters (a11y: number-formatting rule)

export const usd = (n: number, opts: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  }).format(n);

export const compactUsd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n);

export const num = (n: number, frac = 2) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  }).format(n);

export const compactNum = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const pct = (n: number, frac = 2) =>
  `${n >= 0 ? "+" : ""}${num(n, frac)}%`;

export const signedUsd = (n: number) => `${n >= 0 ? "+" : "−"}${usd(Math.abs(n))}`;

export const dirClass = (n: number) =>
  n > 0 ? "text-up" : n < 0 ? "text-down" : "text-muted";

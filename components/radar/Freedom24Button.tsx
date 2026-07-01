"use client";

import { freedom24Url } from "@/lib/radar/freedom24";
import { External } from "@/components/icons";

// Freedom24 wordmark badge — a simple "F24" mark in Freedom24's green so the
// button reads as the broker without shipping their raster logo.
function F24Mark({ size = 16 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded bg-white/15 font-mono font-bold leading-none text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      F24
    </span>
  );
}

type Variant = "button" | "chip";

/**
 * "Trade on Freedom24" deep link. `button` is the full CTA (used in the signal
 * detail); `chip` is the compact form (used on mover cards).
 */
export function Freedom24Button({
  symbol,
  kind,
  variant = "button",
  className = "",
}: {
  symbol: string;
  kind: "equity" | "crypto";
  variant?: Variant;
  className?: string;
}) {
  const href = freedom24Url(symbol, kind);
  const label = `Trade ${symbol} on Freedom24`;

  if (variant === "chip") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={label}
        title={label}
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-1 rounded bg-[#0FA958] px-1.5 py-0.5 text-2xs font-semibold text-white transition-colors hover:bg-[#0c8f4a] ${className}`}
      >
        <F24Mark size={12} />
        Trade
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#0FA958] to-[#0c8f4a] px-3 py-2 text-sm font-semibold text-white shadow-card transition-opacity hover:opacity-90 ${className}`}
    >
      <F24Mark size={16} />
      Trade {symbol} on Freedom24
      <External size={13} className="opacity-90" />
    </a>
  );
}

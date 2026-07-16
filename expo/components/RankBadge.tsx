import { rankFor } from "@/lib/ranks";
import type { RankDef } from "@/lib/types";

interface RankBadgeProps {
  /** Verified monthly revenue — resolved via rankFor. Ignored when rank is given. */
  revenue?: number;
  rank?: RankDef;
  size?: "sm" | "lg";
  className?: string;
}

/** Colored dot + rank name in letterspaced caps. Server-safe. */
export default function RankBadge({
  revenue,
  rank,
  size = "sm",
  className = "",
}: RankBadgeProps) {
  const r = rank ?? rankFor(revenue ?? 0);
  const dot = size === "lg" ? "h-3 w-3" : "h-2 w-2";
  const label =
    size === "lg"
      ? "text-[13px] font-semibold uppercase tracking-widest"
      : "micro";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-ink ${className}`}
      title={r.blurb}
    >
      <span
        aria-hidden="true"
        className={`inline-block ${dot} rounded-full`}
        style={{ backgroundColor: r.color }}
      />
      <span className={label}>{r.name}</span>
    </span>
  );
}

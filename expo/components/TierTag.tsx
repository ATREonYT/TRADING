import type { SubTier } from "@/lib/types";

export const TIER_LABEL: Record<SubTier, string> = {
  free: "Free",
  pro: "Pro",
  founder: "Founder+",
};

export const TIER_PRICE: Record<SubTier, string> = {
  free: "$0",
  pro: "$9/mo",
  founder: "$19/mo",
};

const STYLES: Record<SubTier, string> = {
  free: "border-line text-muted",
  pro: "border-accent/40 text-accent",
  founder: "border-gold/50 text-gold",
};

/** Small uppercase letterspaced tier tag. Server-safe. */
export default function TierTag({
  tier,
  className = "",
}: {
  tier: SubTier;
  className?: string;
}) {
  return (
    <span
      className={`micro inline-flex items-center rounded-sm border px-1.5 py-0.5 ${STYLES[tier]} ${className}`}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

import type { SubTier } from "@/lib/types";
import { TIER_PRICING } from "@/lib/pricing";

export const TIER_LABEL: Record<SubTier, string> = {
  free: "Free",
  pro: "Pro",
  founder: "Founder+",
};

export const TIER_PRICE: Record<SubTier, string> = {
  free: "$0",
  pro: `$${TIER_PRICING.pro.monthly}/mo`,
  founder: `$${TIER_PRICING.founder.monthly}/mo`,
};

export const TIER_PRICE_ANNUAL: Record<SubTier, string> = {
  free: "$0",
  pro: `$${TIER_PRICING.pro.annual}/yr`,
  founder: `$${TIER_PRICING.founder.annual}/yr`,
};

const STYLES: Record<SubTier, string> = {
  free: "border-line text-muted",
  pro: "border-accent/40 text-accent",
  founder: "border-gold/50 text-gold-deep",
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

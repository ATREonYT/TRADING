import type { Sentiment } from "./types";

// Catalyst engine — classifies a headline by the *actual driver* that moves a
// stock's price, not just its tone. These are the event types that repeatedly
// cause real repricings, ranked by how hard they typically hit.

export interface Catalyst {
  /** stable key, e.g. "earnings_beat" */
  type: string;
  /** short human label, e.g. "Earnings Beat" */
  label: string;
  /** which way this driver usually pushes price */
  direction: Sentiment;
  /** 0..100 — typical magnitude of the move this driver causes */
  strength: number;
  /** plain-English reason this actually moves the tape */
  why: string;
}

interface Rule extends Omit<Catalyst, "direction"> {
  direction: Sentiment | "context"; // "context" = decide from tone/sentiment
  patterns: RegExp[];
}

// Ordered by importance. Higher-strength rules win when several match.
const RULES: Rule[] = [
  {
    type: "bankruptcy",
    label: "Solvency Risk",
    direction: "bearish",
    strength: 95,
    why: "Solvency risk can wipe out equity holders entirely — one of the most severe bearish catalysts, often causing gap-downs and halts.",
    patterns: [/\b(bankrupt|chapter 11|insolven|going concern|debt default|delisting)\b/i],
  },
  {
    type: "earnings_beat",
    label: "Earnings Beat",
    direction: "bullish",
    strength: 88,
    why: "Beating EPS/revenue forecasts forces analysts to revise models up and squeezes shorts — a top driver of post-report gaps.",
    patterns: [
      /\bbeat(s|en)?\b.*\b(estimat|expectation|forecast|street|consensus)/i,
      /\btops?\b.*\b(estimat|expectation|forecast|consensus)/i,
      /\b(blowout|record)\b.*\b(quarter|earnings|revenue|profit|results)/i,
      /\bearnings beat\b/i,
    ],
  },
  {
    type: "earnings_miss",
    label: "Earnings Miss",
    direction: "bearish",
    strength: 88,
    why: "Missing forecasts triggers downward estimate revisions and long liquidation — reliably one of the sharpest bearish reactions.",
    patterns: [
      /\bmiss(es|ed)?\b.*\b(estimat|expectation|forecast|street|consensus)/i,
      /\b(disappoint|falls? short|weak)\b.*\b(earnings|results|revenue|sales)/i,
      /\bearnings miss\b/i,
    ],
  },
  {
    type: "guidance_cut",
    label: "Guidance Cut",
    direction: "bearish",
    strength: 86,
    why: "Forward guidance drives valuation more than the past quarter — a cut lowers every future earnings estimate at once.",
    patterns: [
      /\b(cut|lower|slash|reduce)(s|ed)?\b.*\b(guidance|outlook|forecast|full-year|target)/i,
      /\b(profit|revenue|sales)\s+warning\b/i,
      /\bwarns?\b.*\b(sales|profit|revenue|demand)/i,
    ],
  },
  {
    type: "guidance_raise",
    label: "Guidance Raise",
    direction: "bullish",
    strength: 84,
    why: "Raised forward guidance lifts future earnings — the number valuations are actually built on — making it a powerful bullish catalyst.",
    patterns: [
      /\b(raise|lift|hike|boost)(s|d|ed)?\b.*\b(guidance|outlook|forecast|full-year|target)/i,
      /\b(upbeat|strong|rosy)\b.*\b(guidance|outlook|forecast)/i,
    ],
  },
  {
    type: "regulatory_approval",
    label: "Approval / Clearance",
    direction: "bullish",
    strength: 82,
    why: "A binary approval (FDA/EMA/regulatory) unlocks a whole revenue stream — these events cause outsized, sudden moves.",
    patterns: [/\b(FDA|EMA|regulatory)\b.*\b(approv|clear)/i, /\b(wins?|granted|receives?)\b.*\bapproval\b/i],
  },
  {
    type: "ma_deal",
    label: "M&A / Deal",
    direction: "context",
    strength: 80,
    why: "M&A reprices the target toward the offer and can move the acquirer — deal premiums drive large, fast gaps.",
    patterns: [
      /\b(acqui|merg|buyout|takeover|tender offer)\b/i,
      /\b(to buy|bid for|in talks to buy|deal to (buy|purchase|acquire))\b/i,
    ],
  },
  {
    type: "short_squeeze",
    label: "Short Squeeze",
    direction: "bullish",
    strength: 78,
    why: "Forced short covering fuels sharp, self-reinforcing rallies that detach from fundamentals.",
    patterns: [/\b(short|gamma)\s+squeeze\b/i, /\bshorts?\b.*\b(cover|covering|trapped)/i, /\bheavily shorted\b/i],
  },
  {
    type: "fed_rates",
    label: "Fed / Rates",
    direction: "context",
    strength: 78,
    why: "Rate decisions reset the discount rate for every asset — the single biggest macro driver of stocks and crypto.",
    patterns: [
      /\b(federal reserve|FOMC|powell|ECB|central bank)\b/i,
      // Bare "Fed" only counts near policy words (avoids "fed up" false hits).
      /\bfed\b.{0,50}\b(rate|rates|hikes?|cuts?|policy|meeting|minutes|inflation)\b/i,
      /\brate (cuts?|hikes?|decision)\b/i,
      /\b(interest rates|basis points|hawkish|dovish)\b/i,
    ],
  },
  {
    type: "regulatory_legal",
    label: "Legal / Regulatory Risk",
    direction: "bearish",
    strength: 72,
    why: "Lawsuits, probes, fines and recalls threaten cash flows and add uncertainty — markets price the worst case quickly.",
    patterns: [
      /\b(lawsuit|sued|probe|investigation|antitrust|subpoena|fine[ds]?|penalty|charges|fraud|recall|ban(ned)?|sanction)\b/i,
      /\b(SEC|DOJ|FTC)\b.*\b(charge|sue|probe|investigat)/i,
    ],
  },
  {
    type: "inflation_data",
    label: "Inflation Data",
    direction: "context",
    strength: 70,
    why: "CPI/PCE prints move rate-cut odds, which flow straight into equity and bond valuations.",
    patterns: [/\b(inflation|CPI|PCE|PPI|consumer price)\b/i],
  },
  {
    type: "supply_commodity",
    label: "Supply / Commodity",
    direction: "context",
    strength: 68,
    why: "Supply shocks move commodity prices and ripple through energy, transport and inflation-sensitive names.",
    patterns: [/\b(OPEC|crude|oil (output|production|supply|price)|barrel|natural gas|refinery|pipeline)\b/i],
  },
  {
    type: "geopolitics",
    label: "Geopolitical Shock",
    direction: "bearish",
    strength: 66,
    why: "Geopolitical shocks raise risk premia — capital rotates to safe havens and high-beta names sell off.",
    patterns: [/\b(war|invasion|sanctions|tariff|conflict|missile|embargo|coup)\b/i],
  },
  {
    type: "analyst_rating",
    label: "Analyst Action",
    direction: "context",
    strength: 62,
    why: "Upgrades/downgrades and price-target changes pull in (or push out) institutional flows and reset sentiment.",
    patterns: [
      /\b(upgrade|downgrade)(s|d)?\b/i,
      /\b(raises?|cuts?|lifts?|lowers?)\b.*\bprice target\b/i,
      /\b(initiat|reiterat)(es|ed)\b.*\b(buy|sell|overweight|underweight|outperform)/i,
    ],
  },
  {
    type: "jobs_gdp",
    label: "Growth / Jobs Data",
    direction: "context",
    strength: 60,
    why: "Labor and GDP data shape Fed policy odds and earnings expectations for the whole market.",
    patterns: [/\b(jobs report|nonfarm|payrolls|unemployment|GDP|economic growth|recession)\b/i],
  },
  {
    type: "capital_return",
    label: "Buyback / Dividend",
    direction: "bullish",
    strength: 56,
    why: "Buybacks and dividend hikes return capital and signal management confidence, supporting the share price.",
    patterns: [/\b(buyback|repurchase|special dividend|raises? dividend|dividend (increase|hike))\b/i],
  },
  {
    type: "product_contract",
    label: "Product / Contract",
    direction: "bullish",
    strength: 54,
    why: "New products, contract wins and partnerships expand the revenue outlook — the market front-runs future sales.",
    patterns: [
      /\b(unveils?|launch(es|ed)?|new product|contract win|awarded|secures? (order|deal)|partnership|signs? (deal|agreement))\b/i,
    ],
  },
  {
    type: "restructuring",
    label: "Layoffs / Restructuring",
    direction: "context",
    strength: 50,
    why: "Cost cuts can lift margins (bullish) but can also signal weak demand — the reaction depends on framing.",
    patterns: [/\b(layoffs|job cuts|restructuring|cost cuts|workforce reduction)\b/i],
  },
  {
    type: "management",
    label: "Leadership Change",
    direction: "context",
    strength: 46,
    why: "CEO/CFO changes shift strategy and risk perception, re-rating the stock either way.",
    patterns: [/\b(CEO|CFO|chief executive)\b.*\b(resign|step down|ousted|appoint|named|replace)/i, /\bnew (CEO|CFO)\b/i],
  },
  {
    type: "crypto_flows",
    label: "Crypto Flows / Supply",
    direction: "context",
    strength: 64,
    why: "ETF flows and supply events (halving, large transfers) shift crypto's supply/demand balance directly.",
    patterns: [/\b(ETF (inflow|outflow|approval)|spot (bitcoin|ether) ETF|halving|whale (move|transfer)|on-chain)\b/i],
  },
];

/**
 * Detect the dominant price-moving catalyst in a headline. Returns the
 * strongest matching rule (or null). For "context" rules, direction is resolved
 * from the article's own sentiment tone.
 */
export function detectCatalyst(text: string, sentiment: Sentiment): Catalyst | null {
  let best: Rule | null = null;
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      if (!best || rule.strength > best.strength) best = rule;
    }
  }
  if (!best) return null;
  const direction = best.direction === "context" ? sentiment : best.direction;
  return {
    type: best.type,
    label: best.label,
    direction,
    strength: best.strength,
    why: best.why,
  };
}

import Link from "next/link";
import { FLOORS } from "@/lib/data/floors";
import { RANKS } from "@/lib/ranks";
import { TIER_ORDER, type SubTier } from "@/lib/types";
import TierTag, { TIER_LABEL, TIER_PRICE } from "@/components/TierTag";

function money(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

const STEPS: { title: string; body: string }[] = [
  {
    title: "Walk in",
    body: "Pick a name, pick a face, pick a floor. Arrow keys from there. No calendar invite, no badge scanner.",
  },
  {
    title: "Talk to founders",
    body: "Every booth has a person behind it. Walk up, press E, ask what they actually do. They will tell you, briefly.",
  },
  {
    title: "Connect",
    body: "If it's worth remembering, hit Connect. The list lives in your profile, not in a CRM you'll never open.",
  },
];

const PRICING: { tier: SubTier; blurb: string }[] = [
  { tier: "free", blurb: "The public floors. Plenty to see." },
  { tier: "pro", blurb: "Everything in Free, plus the floors where deals get quieter." },
  { tier: "founder", blurb: "Every floor, including the ones with a velvet rope." },
];

export default function LandingPage() {
  const maxRevenue = Math.max(...RANKS.map((r) => r.minRevenue), 1);

  return (
    <main className="mx-auto w-full max-w-5xl px-4">
      {/* hero */}
      <section className="border-b border-line py-16 sm:py-24">
        <h1 className="max-w-2xl font-display text-4xl leading-tight sm:text-5xl">
          A trade-show floor that never tears down.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
          FounderFloor is a small 2D world where startups keep a booth and
          founders actually stand at it. You walk around, you read the signs,
          you talk to people. Ranks come from verified revenue, so the booth
          with the gold badge earned it the boring way.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/lobby"
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
          >
            Walk the floor
          </Link>
          <Link
            href="/profile"
            className="rounded-md border border-ink px-5 py-2.5 text-sm font-medium text-ink hover:bg-panel"
          >
            Set up a booth
          </Link>
        </div>
      </section>

      {/* how it works */}
      <section aria-labelledby="how-heading" className="border-b border-line py-14">
        <h2 id="how-heading" className="font-display text-2xl">
          How it works
        </h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="panel p-5">
              <span className="font-display text-3xl text-accent">{i + 1}</span>
              <h3 className="mt-3 font-display text-lg">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* floors preview */}
      <section aria-labelledby="floors-heading" className="border-b border-line py-14">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="floors-heading" className="font-display text-2xl">
            The floors
          </h2>
          <Link href="/lobby" className="text-sm text-accent hover:underline">
            Enter the lobby
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FLOORS.map((floor) => {
            const locked = TIER_ORDER[floor.tier] > TIER_ORDER.free;
            return (
              <article
                key={floor.id}
                className={`panel p-5 ${locked ? "bg-paper/50" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3
                    className={`font-display text-lg leading-snug ${
                      locked ? "text-muted" : ""
                    }`}
                  >
                    {floor.name}
                  </h3>
                  <TierTag tier={floor.tier} />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {floor.tagline}
                </p>
                <p className="micro mt-4 text-muted">
                  {floor.boothSpots.length} booths
                  {locked ? ` · requires ${TIER_LABEL[floor.tier]}` : ""}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* rank ladder */}
      <section aria-labelledby="ranks-heading" className="border-b border-line py-14">
        <h2 id="ranks-heading" className="font-display text-2xl">
          The rank ladder
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Ranks are set by verified monthly revenue, read through a read-only
          Stripe connection — nobody types their own number. This build
          simulates the connection; the skepticism is real.
        </p>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="micro py-2 pr-4 font-medium text-muted">
                  Rank
                </th>
                <th scope="col" className="micro py-2 pr-4 font-medium text-muted">
                  Verified monthly revenue
                </th>
                <th scope="col" className="micro py-2 font-medium text-muted">
                  In practice
                </th>
              </tr>
            </thead>
            <tbody>
              {RANKS.map((rank) => (
                <tr key={rank.id} className="border-b border-line">
                  <td className="py-3 pr-4 align-top">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: rank.color }}
                      />
                      <span className="micro">{rank.name}</span>
                    </span>
                  </td>
                  <td className="w-64 py-3 pr-4 align-top">
                    <span className="text-sm">{money(rank.minRevenue)}+</span>
                    <span className="mt-1.5 block h-1 w-full rounded-full bg-line">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.max(
                            4,
                            (rank.minRevenue / maxRevenue) * 100,
                          )}%`,
                          backgroundColor: rank.color,
                        }}
                      />
                    </span>
                  </td>
                  <td className="py-3 align-top text-sm text-muted">
                    {rank.blurb}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* pricing */}
      <section aria-labelledby="pricing-heading" className="py-14">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 id="pricing-heading" className="font-display text-2xl">
            Membership
          </h2>
          <span className="micro rounded-sm border border-line px-1.5 py-0.5 text-muted">
            demo — payments not wired up
          </span>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {PRICING.map(({ tier, blurb }) => {
            const unlocked = FLOORS.filter(
              (f) => TIER_ORDER[f.tier] <= TIER_ORDER[tier],
            );
            return (
              <article key={tier} className="panel flex flex-col p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-lg">{TIER_LABEL[tier]}</h3>
                  <span className="text-sm text-muted">{TIER_PRICE[tier]}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{blurb}</p>
                <ul className="mt-4 flex-1 space-y-1.5">
                  {unlocked.map((f) => (
                    <li key={f.id} className="flex items-baseline gap-2 text-sm">
                      <span aria-hidden="true" className="text-verify">
                        ·
                      </span>
                      {f.name}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/profile"
                  className="mt-5 rounded-md border border-ink px-4 py-2 text-center text-sm hover:bg-paper"
                >
                  Choose {TIER_LABEL[tier]}
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

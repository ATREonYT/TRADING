import Link from "next/link";
import { FLOORS } from "@/lib/data/floors";
import { RANKS } from "@/lib/ranks";
import { TIER_ORDER, type GlyphId, type SubTier } from "@/lib/types";
import TierTag, { TIER_LABEL, TIER_PRICE, TIER_PRICE_ANNUAL } from "@/components/TierTag";
import { FOUNDING_OFFER, TIER_PERKS, annualFreeMonths } from "@/lib/pricing";
import PixelGlyph from "@/components/PixelGlyph";
import HeroScene from "@/components/HeroScene";
import Reveal from "@/components/Reveal";
import FloorThumb from "@/components/FloorThumb";

function money(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

const STEPS: { title: string; body: string; glyph: GlyphId }[] = [
  {
    title: "Walk in",
    glyph: "bolt",
    body: "Pick a name, pick a face, pick a floor. Arrow keys — or just tap where you want to go. No calendar invite, no badge scanner.",
  },
  {
    title: "Talk to founders",
    glyph: "wave",
    body: "Every booth has a person behind it. Walk up, press E, ask what they actually do. They will tell you, briefly.",
  },
  {
    title: "Connect",
    glyph: "heart",
    body: "If it's worth remembering, hit Connect. The list lives in your profile, not in a CRM you'll never open.",
  },
];

const PRICING: { tier: SubTier; blurb: string }[] = [
  { tier: "free", blurb: "The public floors. Plenty to see." },
  {
    tier: "pro",
    blurb: "Everything in Free, plus the floors where deals get quieter.",
  },
  {
    tier: "founder",
    blurb: "Every floor, including the ones with a velvet rope.",
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-sm border border-line bg-panel px-1.5 py-0.5 font-mono text-xs text-ink">
      {children}
    </kbd>
  );
}

export default function LandingPage() {
  const maxRevenue = Math.max(...RANKS.map((r) => r.minRevenue), 1);

  return (
    <main>
      {/* hero — two columns on desktop so the pixel scene fills the space
          beside the copy instead of leaving the right half of the page blank;
          stacks to a full-width band on phones and tablets */}
      <section className="border-b border-line">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-14 pt-16 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
          <div>
            <p className="micro text-muted">A walkable expo for startups</p>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
              A trade-show floor that never tears down.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
              FounderFloor is a small 2D world where startups keep a booth and
              founders actually stand at it. You walk around, you read the
              signs, you talk to people. Ranks come from verified revenue, so
              the booth with the gold badge earned it the boring way.
            </p>
            <p className="micro mt-3 text-muted">
              Verification is simulated in this demo. The skepticism is real.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
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
            <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <Kbd>W A S D</Kbd> walk
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>E</Kbd> talk
              </span>
              <span>Nothing to install.</span>
            </p>
          </div>
          <div>
            <HeroScene className="lg:h-[400px]" />
            <p className="micro mt-3 text-muted">
              Main Hall, ambient view. The real one takes WASD, arrow keys, or
              taps.
            </p>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section aria-labelledby="how-heading" className="border-b border-line bg-panel">
        <Reveal className="mx-auto w-full max-w-5xl px-4 py-14 sm:py-16">
          <h2 id="how-heading" className="font-display text-2xl sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-6">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-md border border-line bg-paper p-5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-2xl text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <PixelGlyph glyph={step.glyph} size={20} color="#6F6A5E" />
                </div>
                <h3 className="mt-4 font-display text-lg">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {/* the map of the site — four surfaces, one sentence each */}
      <section aria-labelledby="around-heading" className="border-b border-line">
        <Reveal className="mx-auto w-full max-w-5xl px-4 py-14 sm:py-16">
          <h2 id="around-heading" className="font-display text-2xl sm:text-3xl">
            Find your way around
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Four places, each with one job. Everything you do in one shows up
            in the others.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                href: "/lobby",
                glyph: "cube" as const,
                name: "Floors",
                blurb: "The halls themselves. Walk in, browse booths, talk to whoever's there.",
                action: "Walk a floor",
              },
              {
                href: "/directory",
                glyph: "star" as const,
                name: "Directory",
                blurb: "Every startup on every floor, searchable. One click walks you to their booth.",
                action: "Search startups",
              },
              {
                href: "/connections",
                glyph: "heart" as const,
                name: "Connections",
                blurb: "The people you've met. Requests, accepts, and chats that work from anywhere.",
                action: "Open your rolodex",
              },
              {
                href: "/profile",
                glyph: "bolt" as const,
                name: "Profile",
                blurb: "Your name, your booth, your quests and badges — and an account if you want one.",
                action: "Set yourself up",
              },
            ].map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="panel card-lift group flex flex-col p-5"
              >
                <div className="flex items-center justify-between">
                  <PixelGlyph glyph={s.glyph} size={18} color="#6F6A5E" />
                  <span className="micro text-muted">{s.name}</span>
                </div>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-muted">
                  {s.blurb}
                </p>
                <span className="mt-4 text-sm text-accent group-hover:underline">
                  {s.action} →
                </span>
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      {/* floors */}
      <section aria-labelledby="floors-heading" className="border-b border-line">
        <Reveal className="mx-auto w-full max-w-5xl px-4 py-14 sm:py-16">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="floors-heading" className="font-display text-2xl sm:text-3xl">
              The floors
            </h2>
            <Link href="/lobby" className="text-sm text-accent hover:underline">
              Enter the lobby
            </Link>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Four halls, four temperaments. Each one is a real map with real
            booths; the miniatures below are to scale.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {FLOORS.map((floor) => {
              const locked = TIER_ORDER[floor.tier] > TIER_ORDER.free;
              return (
                <article
                  key={floor.id}
                  className={`panel card-lift flex flex-col gap-4 p-5 sm:flex-row sm:gap-5 ${
                    locked ? "bg-paper/50" : ""
                  }`}
                >
                  <FloorThumb
                    floor={floor}
                    className={`self-start rounded-sm border border-line ${
                      locked ? "opacity-70" : ""
                    }`}
                  />
                  <div className="min-w-0 flex-1">
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
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">
                      {floor.tagline}
                    </p>
                    <p className="micro mt-3 text-muted">
                      {floor.boothSpots.length} booths
                      {floor.reservedSpot !== undefined ? " · one left open for newcomers" : ""}
                      {locked
                        ? ` · requires ${TIER_LABEL[floor.tier]}, ${TIER_PRICE[floor.tier]}`
                        : ""}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </Reveal>
      </section>

      {/* rank ladder */}
      <section aria-labelledby="ranks-heading" className="border-b border-line bg-panel">
        <Reveal className="mx-auto w-full max-w-5xl px-4 py-14 sm:py-16">
          <h2 id="ranks-heading" className="font-display text-2xl sm:text-3xl">
            The rank ladder
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Ranks are set by verified monthly revenue, read through a read-only
            Stripe connection &mdash; nobody types their own number. This build
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
                    <td className="py-3 align-top text-sm text-muted">{rank.blurb}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      {/* pricing */}
      <section aria-labelledby="pricing-heading" className="border-b border-line">
        <Reveal className="mx-auto w-full max-w-5xl px-4 py-14 sm:py-16">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 id="pricing-heading" className="font-display text-2xl sm:text-3xl">
              Membership
            </h2>
            <span className="micro rounded-sm border border-line px-1.5 py-0.5 text-muted">
              beta &mdash; billing goes live at launch
            </span>
          </div>

          {/* founding member strip — the launch offer, capped on purpose */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gold/60 bg-panel px-4 py-3">
            <p className="text-sm">
              <span className="font-display">Founding Member</span>
              <span className="text-muted">
                {" "}
                — ${FOUNDING_OFFER.price} once: a year of Founder+, your price
                locked for life, a numbered badge. First {FOUNDING_OFFER.cap}{" "}
                people only.
              </span>
            </p>
            <Link
              href="/profile#membership"
              className="rounded-md border border-ink px-3 py-1.5 text-sm hover:bg-paper"
            >
              Claim a number
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {PRICING.map(({ tier, blurb }) => {
              const unlocked = FLOORS.filter(
                (f) => TIER_ORDER[f.tier] <= TIER_ORDER[tier],
              );
              const [amount, per] = TIER_PRICE[tier].split("/");
              return (
                <article
                  key={tier}
                  className={`panel card-lift flex flex-col p-5 ${
                    tier === "pro" ? "border-accent/40" : ""
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-lg">{TIER_LABEL[tier]}</h3>
                    {tier === "pro" ? (
                      <span className="micro text-accent">the sensible one</span>
                    ) : null}
                  </div>
                  <p className="mt-2 font-display text-3xl">
                    {amount}
                    {per ? (
                      <span className="ml-1 font-body text-sm text-muted">/ {per}</span>
                    ) : null}
                  </p>
                  {tier !== "free" && (
                    <p className="micro mt-1 text-muted">
                      or {TIER_PRICE_ANNUAL[tier]} — {annualFreeMonths(tier)} months free
                    </p>
                  )}
                  <p className="mt-3 text-sm leading-relaxed text-muted">{blurb}</p>
                  <ul className="mt-4 flex-1 space-y-1.5">
                    {unlocked.map((f) => (
                      <li key={f.id} className="flex items-center gap-2 text-sm">
                        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-verify" />
                        {f.name}
                      </li>
                    ))}
                    {TIER_PERKS[tier].map((perk) => (
                      <li key={perk} className="flex items-center gap-2 text-sm text-muted">
                        <span
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 shrink-0 ${
                            tier === "founder" ? "bg-gold" : "bg-accent/60"
                          }`}
                        />
                        {perk}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/profile#membership"
                    className="mt-5 rounded-md border border-ink px-4 py-2 text-center text-sm hover:bg-paper"
                  >
                    Choose {TIER_LABEL[tier]}
                  </Link>
                </article>
              );
            })}
          </div>
        </Reveal>
      </section>

      {/* what's next — the build is alive; give people a reason to check back */}
      <section aria-labelledby="next-heading" className="border-t border-line">
        <Reveal className="mx-auto w-full max-w-5xl px-4 py-14 sm:py-16">
          <h2 id="next-heading" className="font-display text-3xl">
            The floor keeps changing
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            This place ships weekly. Walk in after a few days away and the
            lobby will tell you what you missed.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="panel p-6">
              <p className="micro text-verify">Landed recently</p>
              <ul className="mt-3 flex flex-col gap-2.5 text-sm leading-relaxed text-muted">
                <li>
                  <span className="text-ink">A directory that grows itself</span>{" "}
                  — every startup someone creates shows up, with its category
                  as a new filter, the moment they save it.
                </li>
                <li>
                  <span className="text-ink">Chats that follow you</span> —
                  message a connection from anywhere; they get a pixel-mail
                  ping whether they&rsquo;re on a floor or in a menu.
                </li>
                <li>
                  <span className="text-ink">Your own banner logo</span> — any
                  image, shrunk to a 16&times;16 mark on your stand.
                </li>
                <li>
                  <span className="text-ink">Your progress, everywhere</span>{" "}
                  — booth, quests, badges, and streaks now follow your
                  account across devices.
                </li>
                <li>
                  <span className="text-ink">Smooth on any machine</span> —
                  the floor now tunes its render resolution to your hardware.
                </li>
              </ul>
            </div>
            <div className="panel p-6">
              <p className="micro text-accent">Being built</p>
              <ul className="mt-3 flex flex-col gap-2.5 text-sm leading-relaxed text-muted">
                <li>
                  <span className="text-ink">Real revenue verification</span>{" "}
                  — a read-only Stripe connection, so the gold badges stop
                  being simulated and start being earned.
                </li>
                <li>
                  <span className="text-ink">A real events calendar</span> —
                  Demo Night gets siblings: pitch hours, category meetups,
                  co-founder speed-walking.
                </li>
                <li>
                  <span className="text-ink">Bigger halls</span> — new floors
                  open as the existing ones fill with real stands.
                </li>
              </ul>
            </div>
          </div>
        </Reveal>
      </section>

      {/* final CTA */}
      <section aria-labelledby="cta-heading" className="bg-ink">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 text-center sm:py-20">
          <h2
            id="cta-heading"
            className="mx-auto max-w-2xl font-display text-3xl leading-tight text-paper sm:text-4xl"
          >
            The doors are propped open. They stay that way.
          </h2>
          <p className="mt-4 text-sm text-paper/70">
            No badge, no lanyard, no schedule. The founders are at their booths.
          </p>
          <Link
            href="/lobby"
            className="mt-8 inline-block rounded-md bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent/90"
          >
            Walk the floor
          </Link>
        </div>
      </section>
    </main>
  );
}

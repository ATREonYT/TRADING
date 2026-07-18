import type { Metadata } from "next";
import Link from "next/link";
import FeedbackBox from "@/components/FeedbackBox";

export const metadata: Metadata = {
  title: "About — FounderFloor",
  description:
    "What FounderFloor is, what it stores, and what it does with it. Short, because there isn't much to hide.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="panel p-6">
      <h2 className="font-display text-xl">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header>
        <p className="micro text-muted">THE FINE PRINT, KEPT SHORT</p>
        <h1 className="mt-1 font-display text-3xl">About FounderFloor</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
          A walkable 2D expo floor for startups. You walk in, read the signs,
          talk to founders, and connect with the ones worth remembering. This
          page covers what the site is, what it stores, and what it does with
          it — because a site that asks for your trust should say so in plain
          words.
        </p>
      </header>

      <Section title="What this is (and isn't)">
        <p>
          FounderFloor is an early, self-hosted project run by one person. It
          is not an investment platform, a marketplace, or a source of advice
          of any kind. Conversations here are conversations — do your own
          diligence on anyone you meet, the same as at a physical expo.
        </p>
        <p>
          Revenue ranks are labeled &ldquo;verified&rdquo; on the floor; in
          this build verification is <strong>simulated</strong> — founders
          type a number and the badge follows. Every page that shows a rank
          says so. Live Stripe-based verification is the plan, not the
          present.
        </p>
      </Section>

      <Section title="What gets stored, and where">
        <p>
          <strong>In your browser (localStorage):</strong> your display name,
          avatar, booth, quests, badges, notes on connections, and — if you
          create an account — a session token. Clearing site data removes it
          from that device.
        </p>
        <p>
          <strong>Progress sync:</strong> the same profile data (booth,
          badges, quests, streaks, membership tier) is also saved to the
          floor server under your identity, so signing in on another device
          brings it with you. It expires after 180 days of inactivity, and a
          deletion request removes it.
        </p>
        <p>
          <strong>On the floor server:</strong> what other people need to see
          or that has to survive your absence — your stand (up to 7 days
          idle), guestbook entries, the activity ticker, connection requests
          and mutual connections, direct messages with your connections
          (latest 100 per thread), and abuse reports. Floor chat and floor
          DMs are relayed live and not stored.
        </p>
        <p>
          <strong>Accounts are optional.</strong> If you make one, the server
          stores your account name and a salted scrypt hash of your password —
          never the password itself. Sessions expire after 30 days of disuse.
          Guests get a browser-held secret that stops anyone else from
          claiming their identity; no email, no tracking pixels, no analytics,
          no third-party anything.
        </p>
      </Section>

      <Section title="Moderation">
        <p>
          Every player card has a Report option. Reports go to the operator
          and are reviewed by hand. Mute is instant and local. The operator
          can remove stands, guestbook entries, and accounts that abuse the
          floor. Be the kind of person you&rsquo;d want at the booth next to
          yours.
        </p>
      </Section>

      <section aria-label="Feedback" id="feedback" className="panel scroll-mt-6 p-6">
        <h2 className="font-display text-xl">Beta feedback</h2>
        <p className="mb-4 mt-3 text-sm leading-relaxed text-muted">
          This is a beta — the fastest way to shape what gets built next is
          to say something.
        </p>
        <FeedbackBox />
      </section>

      <Section title="Contact">
        <p>
          Questions, deletion requests, or something on the floor that
          shouldn&rsquo;t be there: use the Report option in-game, or reach
          the operator through the repository this build ships from. Deletion
          requests are honored — everything above is either in your browser
          (yours to clear) or in one server file (ours to edit).
        </p>
      </Section>

      <p className="text-xs text-muted">
        <Link href="/" className="text-accent hover:underline">
          Back to the floor
        </Link>
      </p>
    </main>
  );
}

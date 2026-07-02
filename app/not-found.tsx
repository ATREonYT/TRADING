import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="hero-mesh absolute inset-0 -z-10 animate-gradient-pan opacity-70" />
      <div className="grid-overlay absolute inset-0 -z-10 opacity-40" />

      <div className="glossy max-w-md rounded-3xl p-10">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-deep shadow-glow">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 16c3-1 4-9 7-9s2 6 5 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <circle cx="5" cy="16" r="1.6" fill="#22D3EE" />
          </svg>
        </div>
        <div className="font-mono text-5xl font-bold text-gradient">404</div>
        <h1 className="mt-2 text-lg font-semibold text-ink">This ticker doesn&apos;t exist</h1>
        <p className="mt-2 text-sm text-muted">
          The page you&apos;re looking for isn&apos;t on the tape. Let&apos;s get you back to the action.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.03]"
          >
            Back home
          </Link>
          <Link
            href="/radar"
            className="rounded-lg border border-border bg-surface/60 px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-primary/50"
          >
            Open Radar
          </Link>
        </div>
      </div>
    </div>
  );
}

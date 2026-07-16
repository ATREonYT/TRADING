import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import PixelLogo from "@/components/PixelLogo";

export const metadata: Metadata = {
  title: "FounderFloor — a walkable expo for startups",
  description:
    "A 2D trade-show floor that never tears down. Walk in, talk to founders, connect. Ranks come from verified revenue (simulated in this demo).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-paper text-ink">
        <header className="border-b border-line bg-panel">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
            <Link
              href="/"
              className="flex items-center gap-2.5"
              aria-label="FounderFloor home"
            >
              <PixelLogo size={22} />
              <span className="font-display text-lg tracking-tight">
                FounderFloor
              </span>
            </Link>
            <nav aria-label="Main" className="ml-auto flex items-center gap-5">
              <Link
                href="/lobby"
                className="text-sm text-muted hover:text-ink hover:underline"
              >
                Floors
              </Link>
              <Link
                href="/profile"
                className="text-sm text-muted hover:text-ink hover:underline"
              >
                Profile
              </Link>
            </nav>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-line bg-panel">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-6 text-sm text-muted sm:flex-row sm:items-baseline sm:justify-between">
            <p>Built by one person and a robot.</p>
            <p>Revenue ranks are verified &mdash; simulated in this build. Egos are not.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}

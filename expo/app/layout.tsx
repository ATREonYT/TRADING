import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import PixelLogo from "@/components/PixelLogo";
import NavConnections from "@/components/NavConnections";
import Messenger from "@/components/Messenger";

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
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 sm:gap-6">
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
            {/* min-w-0 + overflow-x-auto: on narrow phones the nav scrolls
                sideways instead of pushing links off the edge */}
            <nav
              aria-label="Main"
              className="ml-auto flex min-w-0 items-center gap-3 overflow-x-auto whitespace-nowrap sm:gap-5"
            >
              <Link
                href="/lobby"
                className="text-sm text-muted hover:text-ink hover:underline"
              >
                Floors
              </Link>
              <Link
                href="/directory"
                className="text-sm text-muted hover:text-ink hover:underline"
              >
                Directory
              </Link>
              <NavConnections />
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

        {/* site-wide chats: bubble button bottom-right, mail toasts top-right
            (hides itself on floors — the game has its own chat panel) */}
        <Messenger />

        <footer className="border-t border-line bg-panel">
          {/* pb-20 on phones keeps the fixed chat button from sitting on the
              footer text; desktops have room to spare */}
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 pb-20 pt-6 text-sm text-muted sm:flex-row sm:items-baseline sm:justify-between sm:pb-6">
            <p>
              Built by one person and a robot.{" "}
              <Link href="/about" className="underline hover:text-ink">
                About &amp; privacy
              </Link>{" "}
              ·{" "}
              <Link href="/about#feedback" className="underline hover:text-ink">
                Send feedback
              </Link>
            </p>
            <p>Revenue ranks are verified &mdash; simulated in this build. Egos are not.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}

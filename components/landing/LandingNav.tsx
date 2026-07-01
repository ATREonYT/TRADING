"use client";

import { useEffect, useState } from "react";
import { Radar } from "@/components/icons";

const LINKS = [
  { label: "Features", href: "#features" },
  { label: "Catalysts", href: "#catalysts" },
  { label: "How it works", href: "#how" },
  { label: "Markets", href: "#markets" },
  { label: "FAQ", href: "#faq" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? "glass border-b border-border" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4 lg:px-6">
        <a href="#top" className="flex items-center gap-2.5" aria-label="Helix home">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-deep shadow-glow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 16c3-1 4-9 7-9s2 6 5 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="5" cy="16" r="1.6" fill="#F59E0B" />
            </svg>
          </span>
          <span className="font-mono text-[15px] font-semibold tracking-tight text-ink">HELIX</span>
        </a>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Sections">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-elevated/60 hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href="/dashboard"
            className="hidden rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink sm:block"
          >
            Dashboard
          </a>
          <a
            href="/radar"
            className="group flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.03]"
          >
            <Radar size={16} />
            Launch Radar
          </a>
        </div>
      </div>
    </header>
  );
}

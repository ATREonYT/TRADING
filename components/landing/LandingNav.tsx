"use client";

import { useEffect, useState } from "react";
import { Radar, Search } from "@/components/icons";

const LINKS = [
  { label: "Features", href: "#features" },
  { label: "Catalysts", href: "#catalysts" },
  { label: "How it works", href: "#how" },
  { label: "Markets", href: "#markets" },
  { label: "FAQ", href: "#faq" },
];

const openCmdK = () => window.dispatchEvent(new Event("helix:cmdk"));

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled || menu ? "glass border-b border-border" : "border-b border-transparent"
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
          {/* ⌘K search */}
          <button
            onClick={openCmdK}
            aria-label="Search (Command K)"
            className="hidden items-center gap-2 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-2xs text-muted transition-colors hover:text-ink sm:flex"
          >
            <Search size={13} />
            Search
            <kbd className="rounded border border-border px-1 text-[10px] text-faint">⌘K</kbd>
          </button>
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
            <span className="hidden sm:inline">Launch Radar</span>
            <span className="sm:hidden">Radar</span>
          </a>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenu((m) => !m)}
            aria-label="Toggle menu"
            aria-expanded={menu}
            className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted transition-colors hover:text-ink md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menu ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu drawer */}
      {menu && (
        <div className="animate-fade-up border-t border-border md:hidden">
          <nav className="mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-3" aria-label="Mobile">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenu(false)}
                className="rounded-md px-3 py-2.5 text-sm text-muted transition-colors hover:bg-elevated/60 hover:text-ink"
              >
                {l.label}
              </a>
            ))}
            <button
              onClick={() => {
                setMenu(false);
                openCmdK();
              }}
              className="flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-elevated/60 hover:text-ink"
            >
              <Search size={14} /> Search symbols
            </button>
            <a
              href="/dashboard"
              onClick={() => setMenu(false)}
              className="rounded-md px-3 py-2.5 text-sm text-muted transition-colors hover:bg-elevated/60 hover:text-ink"
            >
              Dashboard
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}

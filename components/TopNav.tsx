"use client";

import { usePathname } from "next/navigation";
import { Search, Bell, Grid, Candles, Radar } from "./icons";
import { compactUsd } from "@/lib/format";
import { PORTFOLIO } from "@/lib/mockData";

const NAV = [
  { label: "Home", icon: Grid, href: "/" },
  { label: "Dashboard", icon: Candles, href: "/dashboard" },
  { label: "Radar", icon: Radar, href: "/radar" },
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-base/80 backdrop-blur supports-[backdrop-filter]:bg-base/60">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 lg:px-6">
        {/* Brand */}
        <a href="/" className="flex items-center gap-2.5" aria-label="Helix home">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-deep shadow-glow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 16c3-1 4-9 7-9s2 6 5 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="5" cy="16" r="1.6" fill="#F59E0B" />
            </svg>
          </span>
          <span className="font-mono text-[15px] font-semibold tracking-tight text-ink">HELIX</span>
        </a>

        {/* Primary nav */}
        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map(({ label, icon: Icon, href }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href.split("#")[0]) && href !== "/";
            return (
            <a
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-elevated text-ink"
                  : "text-muted hover:bg-elevated/60 hover:text-ink"
              }`}
            >
              <Icon size={16} />
              {label}
            </a>
            );
          })}
        </nav>

        {/* Search */}
        <div className="ml-auto hidden items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted sm:flex">
          <Search size={15} />
          <input
            aria-label="Search symbols"
            placeholder="Search symbol…"
            className="w-28 bg-transparent text-ink placeholder:text-faint focus:outline-none lg:w-40"
          />
          <kbd className="rounded border border-border px-1.5 text-2xs text-faint">⌘K</kbd>
        </div>

        {/* Account equity pill */}
        <div className="hidden flex-col items-end leading-tight lg:flex">
          <span className="text-2xs uppercase tracking-wide text-faint">Equity</span>
          <span className="tnum font-mono text-sm font-semibold text-ink">{compactUsd(PORTFOLIO.equity)}</span>
        </div>

        <button
          className="relative grid h-9 w-9 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-ink"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
        </button>

        <div
          className="grid h-9 w-9 place-items-center rounded-full bg-elevated font-mono text-xs font-semibold text-ink ring-1 ring-border"
          aria-hidden="true"
        >
          AK
        </div>
      </div>
    </header>
  );
}

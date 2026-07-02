"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Search, Grid, Candles, Radar, Wallet } from "./icons";
import { compactUsd } from "@/lib/format";
import { searchCatalog } from "@/lib/symbolCatalog";
import { radarLink } from "@/lib/radar/symbolLink";
import { useAccount } from "./AccountContext";
import { paperEquity } from "@/lib/account";

const NAV = [
  { label: "Home", icon: Grid, href: "/" },
  { label: "Dashboard", icon: Candles, href: "/dashboard" },
  { label: "Radar", icon: Radar, href: "/radar" },
  { label: "Paper", icon: Wallet, href: "/paper" },
];

export function TopNav() {
  const pathname = usePathname();
  const { user, ready } = useAccount();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLFormElement>(null);

  const results = useMemo(() => (q.trim() ? searchCatalog(q, 6) : []), [q]);

  useEffect(() => setActive(0), [q]);

  // Close the dropdown on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const go = (symbol: string) => {
    setOpen(false);
    setQ("");
    window.location.href = radarLink(symbol);
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (results.length > 0) go(results[Math.min(active, results.length - 1)].symbol);
    else if (q.trim()) go(q.trim().toUpperCase());
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const initials =
    user?.name
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "";

  const paperCash = user ? paperEquity(user.paper, {}) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-base/70 backdrop-blur-xl supports-[backdrop-filter]:bg-base/55">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 lg:px-6">
        {/* Brand */}
        <a href="/" className="flex items-center gap-2.5" aria-label="Helix home">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-deep shadow-glow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 16c3-1 4-9 7-9s2 6 5 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="5" cy="16" r="1.6" fill="#22D3EE" />
            </svg>
          </span>
          <span className="font-mono text-[15px] font-semibold tracking-tight text-ink">HELIX</span>
        </a>

        {/* Primary nav */}
        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map(({ label, icon: Icon, href }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href) && href !== "/";
            return (
              <a
                key={label}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active ? "bg-elevated text-ink" : "text-muted hover:bg-elevated/60 hover:text-ink"
                }`}
              >
                <Icon size={16} />
                {label}
              </a>
            );
          })}
        </nav>

        {/* Search with typeahead dropdown */}
        <form
          ref={boxRef}
          onSubmit={onSearch}
          className="relative ml-auto hidden items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted transition-colors focus-within:border-primary/50 sm:flex"
        >
          <Search size={15} />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => q.trim() && setOpen(true)}
            onKeyDown={onKey}
            aria-label="Search symbols"
            aria-expanded={open && results.length > 0}
            placeholder="Search symbol…"
            className="w-28 bg-transparent text-ink placeholder:text-faint focus:outline-none lg:w-40"
          />
          <kbd className="rounded border border-border px-1.5 text-2xs text-faint">↵</kbd>

          {open && results.length > 0 && (
            <ul
              role="listbox"
              className="glossy absolute left-0 right-0 top-[calc(100%+6px)] z-50 animate-drop-in overflow-hidden rounded-xl py-1"
            >
              {results.map((r, i) => (
                <li key={r.symbol} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      go(r.symbol);
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                      i === active ? "bg-primary/15" : ""
                    }`}
                  >
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-2xs font-bold ring-1 ring-border ${
                        r.kind === "crypto" ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary"
                      }`}
                    >
                      {r.symbol.replace(/-USD$/, "").slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-xs font-semibold text-ink">{r.symbol}</span>
                      <span className="ml-2 truncate text-2xs text-muted">{r.name}</span>
                    </span>
                    <span className="text-2xs text-faint">↵</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>

        {/* Launch Radar CTA */}
        <a
          href="/radar"
          className="hidden items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.03] md:flex"
        >
          <Radar size={15} />
          Radar
        </a>

        {/* Paper cash pill (signed in) */}
        {user && paperCash != null && (
          <a href="/paper" className="hidden flex-col items-end leading-tight transition-opacity hover:opacity-80 lg:flex">
            <span className="text-2xs uppercase tracking-wide text-faint">Paper cash</span>
            <span className="tnum font-mono text-sm font-semibold text-ink">{compactUsd(user.paper.cash)}</span>
          </a>
        )}

        {/* Account */}
        {ready && user ? (
          <a
            href="/account"
            title={`${user.name} — account`}
            className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-deep font-mono text-xs font-semibold text-white ring-1 ring-primary/50 transition-transform hover:scale-105"
          >
            {initials || "?"}
          </a>
        ) : (
          <a
            href="/account"
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-primary/50 hover:text-ink"
          >
            Sign in
          </a>
        )}
      </div>
    </header>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { searchCatalog } from "@/lib/symbolCatalog";
import { radarLink } from "@/lib/radar/symbolLink";
import { Search, Radar, Grid, Candles } from "./icons";

type Item =
  | { type: "action"; id: string; label: string; hint: string; href: string; icon: "home" | "dashboard" | "radar" }
  | { type: "symbol"; id: string; label: string; hint: string; href: string; kind: "equity" | "crypto" };

const ACTIONS: Item[] = [
  { type: "action", id: "home", label: "Home", hint: "Landing page", href: "/", icon: "home" },
  { type: "action", id: "dashboard", label: "Dashboard", hint: "Portfolio & charts", href: "/dashboard", icon: "dashboard" },
  { type: "action", id: "radar", label: "Radar", hint: "News & scanner", href: "/radar", icon: "radar" },
  { type: "action", id: "paper", label: "Paper Trading", hint: "Practice portfolio", href: "/paper", icon: "dashboard" },
  { type: "action", id: "account", label: "Account", hint: "Profile & sign in", href: "/account", icon: "home" },
];

/**
 * App-wide command palette. Opens on ⌘K / Ctrl+K, on "/" (when not typing), or
 * when any element dispatches the `helix:cmdk` window event. Fuzzy-searches the
 * symbol catalog and jumps to the Radar for the chosen ticker.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo<Item[]>(() => {
    const query = q.trim();
    const symbols: Item[] = searchCatalog(query, 8).map((e) => ({
      type: "symbol",
      id: e.symbol,
      label: e.symbol,
      hint: e.name,
      href: radarLink(e.symbol),
      kind: e.kind,
    }));
    const actions = query
      ? ACTIONS.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()))
      : ACTIONS;
    return [...actions, ...symbols];
  }, [q]);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setActive(0);
  }, []);

  const go = useCallback(
    (item: Item | undefined) => {
      if (!item) return;
      close();
      window.location.href = item.href;
    },
    [close],
  );

  // Global open triggers.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA"].includes(e.target.tagName);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing && !open)) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") close();
    };
    const onEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("helix:cmdk", onEvent as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("helix:cmdk", onEvent as EventListener);
    };
  }, [open, close]);

  // Focus the input + lock scroll when open.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(t);
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[active]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="absolute inset-0 bg-base/70 backdrop-blur-sm" onClick={close} />
      <div className="glossy relative w-full max-w-lg animate-fade-up overflow-hidden rounded-2xl">
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
          <Search size={16} className="text-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onListKey}
            placeholder="Search symbols or jump to a page…"
            className="w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
            aria-label="Search"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-2xs text-faint">esc</kbd>
        </div>

        <ul className="scroll-thin max-h-[52vh] overflow-y-auto p-2" role="listbox">
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-faint">No matches for “{q}”.</li>
          )}
          {items.map((it, i) => {
            const isActive = i === active;
            return (
              <li key={`${it.type}-${it.id}`} role="option" aria-selected={isActive}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(it)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    isActive ? "bg-primary/15 ring-1 ring-primary/30" : "hover:bg-elevated/60"
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1 ring-border ${
                      it.type === "symbol"
                        ? it.kind === "crypto"
                          ? "bg-accent/15 text-accent"
                          : "bg-primary/15 text-primary"
                        : "bg-elevated text-muted"
                    }`}
                  >
                    {it.type === "action" ? <ActionIcon icon={it.icon} /> : <Radar size={14} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-mono text-sm font-semibold text-ink">{it.label}</span>
                    <span className="ml-2 truncate text-2xs text-muted">{it.hint}</span>
                  </span>
                  <span className="text-2xs text-faint">
                    {it.type === "symbol" ? "News & analysis" : "Go"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-3 border-t border-border/60 px-4 py-2 text-2xs text-faint">
          <span><kbd className="rounded border border-border px-1">↑↓</kbd> navigate</span>
          <span><kbd className="rounded border border-border px-1">↵</kbd> open</span>
          <span className="ml-auto">Powered by Helix Radar</span>
        </div>
      </div>
    </div>
  );
}

function ActionIcon({ icon }: { icon: "home" | "dashboard" | "radar" }) {
  if (icon === "home") return <Grid size={14} />;
  if (icon === "dashboard") return <Candles size={14} />;
  return <Radar size={14} />;
}

"use client";

import { useMemo, useState } from "react";
import type { NewsItem, Sentiment } from "@/lib/radar/types";
import { Newspaper, External, Search, Zap } from "@/components/icons";
import { relTime, sentimentBg, directionArrow, CATEGORY_LABEL, CATEGORIES } from "./helpers";

const SENTIMENTS: (Sentiment | "all")[] = ["all", "bullish", "bearish"];

export function NewsFeed({
  items,
  freshIds,
  initialQuery = "",
}: {
  items: NewsItem[];
  freshIds: Set<string>;
  initialQuery?: string;
}) {
  const [cat, setCat] = useState<string>("all");
  const [sent, setSent] = useState<string>("all");
  const [catalystOnly, setCatalystOnly] = useState(false);
  const [q, setQ] = useState(initialQuery);
  const [openWhy, setOpenWhy] = useState<Set<string>>(new Set());

  const toggleWhy = (id: string) =>
    setOpenWhy((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((n) => {
      if (cat !== "all" && n.category !== cat) return false;
      if (sent !== "all" && n.sentiment !== sent) return false;
      if (catalystOnly && !n.catalyst) return false;
      if (query && !`${n.title} ${n.summary} ${n.symbols.join(" ")}`.toLowerCase().includes(query))
        return false;
      return true;
    });
  }, [items, cat, sent, catalystOnly, q]);

  return (
    <section className="glossy flex min-h-0 flex-col rounded-2xl">
      <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <Newspaper size={16} className="text-primary" />
        <h2 className="text-sm font-semibold text-ink">News & Catalyst Analysis</h2>
        <span className="ml-auto rounded-full bg-elevated px-2 py-0.5 text-2xs tabular-nums text-muted">
          {filtered.length}
        </span>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 rounded-md border border-border bg-base px-2.5 py-1.5">
          <Search size={14} className="text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search headlines, tickers…"
            className="w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
            aria-label="Search news"
          />
        </div>
        <div className="scroll-thin flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <Chip active={cat === "all"} onClick={() => setCat("all")}>
            All
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              {CATEGORY_LABEL[c]}
            </Chip>
          ))}
          <span className="mx-1 h-4 w-px shrink-0 bg-border" />
          {SENTIMENTS.map((s) => (
            <Chip key={s} active={sent === s} onClick={() => setSent(s)}>
              {s === "all" ? "Any tone" : s === "bullish" ? "Bullish" : "Bearish"}
            </Chip>
          ))}
          <span className="mx-1 h-4 w-px shrink-0 bg-border" />
          <button
            onClick={() => setCatalystOnly((v) => !v)}
            className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-medium transition-colors ${
              catalystOnly ? "bg-accent text-black" : "bg-elevated text-muted hover:text-ink"
            }`}
          >
            <Zap size={11} />
            Catalysts
          </button>
        </div>
      </div>

      {/* Feed */}
      <ol className="scroll-thin flex-1 divide-y divide-border/60 overflow-y-auto">
        {filtered.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-faint">No headlines match.</li>
        )}
        {filtered.map((n) => (
          <li
            key={n.id}
            className={`px-4 py-3 transition-colors hover:bg-elevated/40 ${
              freshIds.has(n.id) ? "animate-fade-up bg-primary/[0.06]" : ""
            }`}
          >
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              {n.breaking && (
                <span className="rounded bg-down px-1.5 py-0.5 text-2xs font-bold uppercase text-white">
                  Breaking
                </span>
              )}
              {n.catalyst && (
                <span
                  className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-bold ring-1 ${sentimentBg(
                    n.catalyst.direction,
                  )}`}
                  title={`Price driver: ${n.catalyst.label}`}
                >
                  <Zap size={10} />
                  {directionArrow(n.catalyst.direction)} {n.catalyst.label}
                </span>
              )}
              <span
                className={`rounded px-1.5 py-0.5 text-2xs font-medium capitalize ring-1 ${sentimentBg(
                  n.sentiment,
                )}`}
              >
                {n.sentiment}
              </span>
              <span className="rounded bg-elevated px-1.5 py-0.5 text-2xs text-muted">
                {CATEGORY_LABEL[n.category]}
              </span>
              {n.symbols.map((s) => (
                <span key={s} className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-2xs text-primary">
                  {s}
                </span>
              ))}
              <span className="ml-auto flex items-center gap-2 text-2xs text-faint">
                <ImpactMeter value={n.impact} />
                {relTime(n.publishedAt)}
              </span>
            </div>
            <a
              href={n.url}
              target="_blank"
              rel="noreferrer"
              className="group flex items-start gap-1.5 text-sm font-medium leading-snug text-ink hover:text-primary"
            >
              <span>{n.title}</span>
              <External size={12} className="mt-0.5 shrink-0 text-faint group-hover:text-primary" />
            </a>
            {n.summary && (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{n.summary}</p>
            )}
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-2xs text-faint">{n.source}</span>
              {n.catalyst && (
                <button
                  onClick={() => toggleWhy(n.id)}
                  className="ml-auto flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-2xs font-medium text-accent transition-colors hover:bg-accent/20"
                  aria-expanded={openWhy.has(n.id)}
                >
                  Why it moves
                  <span className={`transition-transform ${openWhy.has(n.id) ? "rotate-90" : ""}`}>›</span>
                </button>
              )}
            </div>
            {n.catalyst && openWhy.has(n.id) && (
              <div className="mt-2 animate-fade-up rounded-lg border border-accent/20 bg-accent/[0.06] p-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-accent">
                  <Zap size={11} /> {n.catalyst.label} · typical impact {n.catalyst.strength}/100
                </div>
                <p className="text-xs leading-relaxed text-muted">{n.catalyst.why}</p>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-2.5 py-1 text-2xs font-medium transition-colors ${
        active ? "bg-primary text-white" : "bg-elevated text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ImpactMeter({ value }: { value: number }) {
  const bars = Math.round((value / 100) * 4);
  return (
    <span className="flex items-end gap-0.5" title={`Impact ${value}/100`} aria-label={`Impact ${value} of 100`}>
      {[3, 6, 9, 12].map((h, i) => (
        <span
          key={h}
          className={`w-0.5 rounded-sm ${i < bars ? "bg-accent" : "bg-border"}`}
          style={{ height: h }}
        />
      ))}
    </span>
  );
}

"use client";

/**
 * Directory — every seed startup across every floor. Text search, filter
 * chips (category, seeking co-founder, minimum rank), and a "Walk there"
 * link straight to the booth's floor. Presence dots come from /presence.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { STARTUPS } from "@/lib/data/startups";
import { FLOORS } from "@/lib/data/floors";
import { RANKS, rankFor } from "@/lib/ranks";
import type { FloorDef, RankId, Startup } from "@/lib/types";
import RankBadge from "@/components/RankBadge";
import TierTag from "@/components/TierTag";
import { usePresence } from "@/components/usePresence";

// startupId -> the floor whose startupIds list it (module scope, computed once)
const FLOOR_OF: Record<string, FloorDef> = (() => {
  const out: Record<string, FloorDef> = {};
  for (const f of FLOORS) {
    for (const id of f.startupIds) out[id] = f;
  }
  return out;
})();

const CATEGORIES: string[] = Array.from(
  new Set(Object.values(STARTUPS).map((s) => s.category)),
).sort();

const MIN_RANKS = RANKS.filter((r) => r.id > 0);

function chipClass(active: boolean): string {
  return `min-h-[40px] rounded-md border px-3 py-2 text-xs ${
    active
      ? "border-accent bg-accent-soft text-accent"
      : "border-line text-muted hover:border-muted hover:text-ink"
  }`;
}

export default function DirectoryPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [seeking, setSeeking] = useState(false);
  const [minRank, setMinRank] = useState<RankId | null>(null);
  const presence = usePresence();

  const results: Startup[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    return Object.values(STARTUPS)
      .filter((s) => {
        if (category !== null && s.category !== category) return false;
        if (seeking && !s.seekingCofounder) return false;
        if (minRank !== null && rankFor(s.verifiedRevenue).id < minRank) return false;
        if (term) {
          const hay = `${s.name} ${s.oneLiner} ${s.category} ${s.founder}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          b.verifiedRevenue - a.verifiedRevenue || a.name.localeCompare(b.name),
      );
  }, [q, category, seeking, minRank]);

  const total = Object.keys(STARTUPS).length;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl">Directory</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        All {total} booths across {FLOORS.length} floors, on paper. Search,
        filter, then go stand in front of one.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <div>
          <label htmlFor="directory-search" className="sr-only">
            Search startups
          </label>
          <input
            id="directory-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, one-liner, category, founder"
            autoComplete="off"
            className="h-11 w-full rounded-md border border-line px-3 text-sm placeholder:text-muted/70"
          />
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category filter">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory((cur) => (cur === c ? null : c))}
              className={chipClass(category === c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="More filters">
          <button
            type="button"
            aria-pressed={seeking}
            onClick={() => setSeeking((v) => !v)}
            className={chipClass(seeking)}
          >
            Seeking co-founder
          </button>
          {MIN_RANKS.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={minRank === r.id}
              title={r.blurb}
              onClick={() => setMinRank((cur) => (cur === r.id ? null : r.id))}
              className={chipClass(minRank === r.id)}
            >
              {r.name}+
            </button>
          ))}
        </div>
      </div>

      <p className="micro mt-6 text-muted">
        {results.length === total
          ? `${total} startups`
          : `${results.length} of ${total} startups`}
      </p>

      {results.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Nothing matches. Either loosen a filter or accept that it hasn&rsquo;t
          been built yet.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {results.map((s) => {
            const floor = FLOOR_OF[s.id];
            const here = floor ? presence[floor.id] ?? 0 : 0;
            return (
              <li
                key={s.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg leading-snug">{s.name}</h2>
                    <RankBadge revenue={s.verifiedRevenue} />
                    {s.seekingCofounder && (
                      <span className="micro rounded-sm border border-verify/40 px-1.5 py-0.5 text-verify">
                        Seeking co-founder
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-snug text-muted">{s.oneLiner}</p>
                  <p className="micro mt-1.5 text-muted">
                    {s.founder} · {s.category}
                  </p>
                </div>
                {floor && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                    <span className="flex items-center gap-2 text-xs text-muted">
                      {here > 0 && (
                        <span className="flex items-center gap-1 text-verify">
                          <span
                            aria-hidden="true"
                            className="inline-block h-2 w-2 rounded-full bg-verify"
                          />
                          {here} here
                        </span>
                      )}
                      <span>{floor.name}</span>
                      <TierTag tier={floor.tier} />
                    </span>
                    <Link
                      // ?booth deep link: the floor page auto-walks you from
                      // the door to this startup's stand.
                      href={`/floor/${floor.id}?booth=${encodeURIComponent(s.id)}`}
                      className="rounded-md border border-ink px-3 py-2 text-sm hover:bg-panel"
                    >
                      Walk there
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

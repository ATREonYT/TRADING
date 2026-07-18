"use client";

/**
 * The lobby's pulse: what happened while you were away, and who's looking
 * for a co-founder right now. This is the "reason to come back" surface —
 * new startups since your last visit, notes left on your stand, requests
 * waiting, and the day streak. Everything degrades quietly when the floor
 * server is offline.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { STARTUPS } from "@/lib/data/startups";
import { FLOORS } from "@/lib/data/floors";
import { httpBase } from "@/lib/net";
import { useInbox } from "@/lib/social";
import { TIER_ORDER, type FloorDef, type SubTier } from "@/lib/types";
import { useCommunityStartups } from "@/components/useCommunityStartups";
import TierTag, { TIER_LABEL } from "@/components/TierTag";

const FLOOR_OF: Record<string, FloorDef> = (() => {
  const out: Record<string, FloorDef> = {};
  for (const f of FLOORS) for (const id of f.startupIds) out[id] = f;
  return out;
})();

const FLOOR_BY_ID: Record<string, FloorDef> = Object.fromEntries(FLOORS.map((f) => [f.id, f]));

interface SeekingRow {
  key: string;
  name: string;
  founder: string;
  category: string;
  floor: FloorDef | undefined;
  href: string;
  online: boolean;
  community: boolean;
  tier?: "pro" | "founder";
}

/** Membership visibility boost: Founder+ over Pro over free. */
function tierWeight(tier: "pro" | "founder" | undefined): number {
  return tier === "founder" ? 2 : tier === "pro" ? 1 : 0;
}

export default function LobbyPulse({
  me,
  sub,
  prevSeenAt,
  visitStreak,
  claims,
}: {
  me: string;
  sub: SubTier;
  prevSeenAt: number;
  visitStreak: number;
  /** Your claimed stands: floorId -> spotIndex (for "notes on your stand"). */
  claims: Record<string, number>;
}) {
  const community = useCommunityStartups(30_000);
  const [inbox] = useInbox(me, 30_000);
  const [newNotes, setNewNotes] = useState(0);

  // Notes left on your stand(s) since you were last here.
  useEffect(() => {
    if (!prevSeenAt || Object.keys(claims).length === 0) return;
    let disposed = false;
    void (async () => {
      const base = httpBase();
      if (!base) return;
      let count = 0;
      for (const [floorId, spotIndex] of Object.entries(claims)) {
        try {
          const res = await fetch(
            `${base}/guestbook?floor=${encodeURIComponent(floorId)}&key=spot:${spotIndex}`,
          );
          if (!res.ok) continue;
          const data = (await res.json()) as { entries?: { ts: number }[] };
          count += (data.entries ?? []).filter((e) => e.ts > prevSeenAt).length;
        } catch {
          // offline — the digest just shows less
        }
      }
      if (!disposed) setNewNotes(count);
    })();
    return () => {
      disposed = true;
    };
  }, [prevSeenAt, claims]);

  // Community startups that appeared (or came back) since your last visit,
  // excluding your own.
  const fresh = useMemo(
    () =>
      community.filter(
        (c) =>
          c.lastSeen > prevSeenAt &&
          c.startup.id !== `reg:${me}` &&
          c.startup.id !== `claim:${me}`,
      ),
    [community, prevSeenAt, me],
  );

  const seeking: SeekingRow[] = useMemo(() => {
    const rows: SeekingRow[] = [];
    for (const c of community) {
      if (!c.startup.seekingCofounder) continue;
      if (c.startup.id === `reg:${me}` || c.startup.id === `claim:${me}`) continue;
      const floor = c.floorId !== null ? FLOOR_BY_ID[c.floorId] : undefined;
      rows.push({
        key: c.startup.id,
        name: c.startup.name,
        founder: c.startup.founder,
        category: c.startup.category,
        floor,
        href: floor ? `/floor/${floor.id}?spot=${c.spotIndex}` : "/directory?seeking=1",
        online: c.online,
        community: true,
        tier: c.startup.tier,
      });
    }
    for (const s of Object.values(STARTUPS)) {
      if (!s.seekingCofounder) continue;
      const floor = FLOOR_OF[s.id];
      rows.push({
        key: s.id,
        name: s.name,
        founder: s.founder,
        category: s.category,
        floor,
        href: floor ? `/floor/${floor.id}?booth=${encodeURIComponent(s.id)}` : "/directory?seeking=1",
        online: false,
        community: false,
      });
    }
    // live founders first, then paid members (a membership perk), then
    // fresh community stands, then the regulars
    rows.sort(
      (a, b) =>
        Number(b.online) - Number(a.online) ||
        tierWeight(b.tier) - tierWeight(a.tier) ||
        Number(b.community) - Number(a.community),
    );
    return rows.slice(0, 5);
  }, [community, me]);

  const requestCount = inbox.requests.length;
  const hasDigest = prevSeenAt > 0 && (fresh.length > 0 || newNotes > 0 || requestCount > 0);

  return (
    <section
      aria-label="What's happening"
      className={`mt-8 grid gap-4 ${hasDigest ? "lg:grid-cols-2" : ""}`}
    >
      {hasDigest && (
        <div className="panel p-5">
          <h2 className="font-display text-lg">Since you were away</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
            {fresh.length > 0 && (
              <li>
                <span className="text-ink">
                  {fresh.length} startup{fresh.length === 1 ? "" : "s"}
                </span>{" "}
                new or back on the floors —{" "}
                {fresh
                  .slice(0, 3)
                  .map((c) => c.startup.name)
                  .join(", ")}
                {fresh.length > 3 ? "…" : ""}{" "}
                <Link href="/directory" className="text-accent hover:underline">
                  see them all
                </Link>
              </li>
            )}
            {newNotes > 0 && (
              <li>
                <span className="text-ink">
                  {newNotes} new note{newNotes === 1 ? "" : "s"}
                </span>{" "}
                in your stand&rsquo;s guestbook — walk over and read them
              </li>
            )}
            {requestCount > 0 && (
              <li>
                <span className="text-ink">
                  {requestCount} connection request{requestCount === 1 ? "" : "s"}
                </span>{" "}
                waiting —{" "}
                <Link href="/connections" className="text-accent hover:underline">
                  answer them
                </Link>
              </li>
            )}
          </ul>
          {visitStreak >= 1 && (
            <p className="micro mt-4 border-t border-line pt-3 text-muted">
              {visitStreak >= 2
                ? `Day ${visitStreak} streak — tomorrow keeps it alive.`
                : "Come back tomorrow and it starts counting as a streak."}
            </p>
          )}
        </div>
      )}

      <div className="panel p-5">
        <h2 className="font-display text-lg">Looking for a co-founder right now</h2>
        {seeking.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Nobody has their hand up at the moment. Set up your own booth and
            flip the &ldquo;seeking co-founder&rdquo; switch — you&rsquo;d be
            first on this list.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {seeking.map((r) => {
              const allowed = r.floor
                ? TIER_ORDER[sub] >= TIER_ORDER[r.floor.tier]
                : true;
              return (
                <li key={r.key} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      {r.name}
                      {r.online && (
                        <span className="micro ml-2 rounded-sm border border-verify/40 px-1 py-px text-verify">
                          founder here now
                        </span>
                      )}
                      {r.tier && (
                        <span className="ml-2 inline-block align-middle">
                          <TierTag tier={r.tier} />
                        </span>
                      )}
                    </p>
                    <p className="micro mt-0.5 truncate text-muted">
                      {r.founder} · {r.category}
                      {r.floor ? ` · ${r.floor.name}` : " · no stand yet"}
                    </p>
                  </div>
                  {r.floor &&
                    (allowed ? (
                      <Link
                        href={r.href}
                        className="shrink-0 rounded-md border border-ink px-2.5 py-1.5 text-xs hover:bg-panel"
                      >
                        Walk there
                      </Link>
                    ) : (
                      <Link
                        href="/profile#membership"
                        className="shrink-0 rounded-md border border-line px-2.5 py-1.5 text-xs text-muted hover:border-ink hover:text-ink"
                      >
                        Needs {TIER_LABEL[r.floor.tier]}
                      </Link>
                    ))}
                </li>
              );
            })}
          </ul>
        )}
        <p className="micro mt-3 border-t border-line pt-3">
          <Link href="/directory?seeking=1" className="text-accent hover:underline">
            Everyone seeking a co-founder →
          </Link>
        </p>
      </div>
    </section>
  );
}

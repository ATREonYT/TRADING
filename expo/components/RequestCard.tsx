"use client";

/**
 * An incoming connection request: the requester's calling card — who they
 * are, what they've actually done here — with accept/decline. Used on the
 * Connections page and as the on-floor popup.
 */

import { useEffect, useRef } from "react";
import type { ConnectRequest } from "@/lib/types";
import RankBadge from "@/components/RankBadge";

export default function RequestCard({
  req,
  onRespond,
  compact = false,
}: {
  req: ConnectRequest;
  onRespond: (accept: boolean) => void;
  /** Floor variant: tighter, with a header line. */
  compact?: boolean;
}) {
  const c = req.from;
  const ref = useRef<HTMLDivElement>(null);

  // The floor popup appears mid-screen unprompted — move focus into it so
  // keyboard and screen-reader users find Accept/Decline without hunting.
  useEffect(() => {
    if (compact) ref.current?.focus();
  }, [compact, req.from.id]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={compact ? "dialog" : undefined}
      aria-label={compact ? `Connection request from ${c.name}` : undefined}
      className={`panel anim-in pointer-events-auto w-[300px] max-w-[calc(100vw-24px)] p-3 shadow-card outline-none ${
        compact ? "border-l-2 border-l-accent" : ""
      }`}
    >
      {compact && <p className="micro mb-1.5 text-accent">Connection request</p>}
      <div className="flex items-baseline gap-2">
        <p className="font-display text-base leading-tight">{c.name}</p>
        {c.title && (
          <span className="micro rounded-sm border border-gold/50 px-1 py-px text-gold-deep">
            {c.title}
          </span>
        )}
      </div>
      {c.status && <p className="mt-0.5 text-xs text-muted">{c.status}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {c.startupName && (
          <span className="flex items-center gap-1.5">
            {c.startupName}
            {c.startupRevenue !== undefined && <RankBadge revenue={c.startupRevenue} />}
          </span>
        )}
        <span>{c.connections} connection{c.connections === 1 ? "" : "s"}</span>
        <span>{c.badges.length} badge{c.badges.length === 1 ? "" : "s"}</span>
        <span>{c.floorsVisited} floor{c.floorsVisited === 1 ? "" : "s"} visited</span>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onRespond(true)}
          className="btn-press flex-1 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => onRespond(false)}
          className="btn-press flex-1 rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:border-ink hover:text-ink"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

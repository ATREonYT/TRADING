"use client";

import type { Startup } from "@/lib/types";
import RankBadge from "@/components/RankBadge";
import PixelGlyph from "@/components/PixelGlyph";

interface BoothCardProps {
  startup: Startup;
  isYours: boolean;
  connected: boolean;
  onConnect: () => void;
  onChat: () => void;
  onClose: () => void;
}

export default function BoothCard({
  startup: s,
  isYours,
  connected,
  onConnect,
  onChat,
  onClose,
}: BoothCardProps) {
  const firstName = s.founder.split(" ")[0] || s.founder;
  const pct = Math.round(Math.max(0, Math.min(1, s.goalProgress)) * 100);

  return (
    <aside
      aria-label={`Booth: ${s.name}`}
      className="panel pointer-events-auto flex w-[340px] max-w-[calc(100vw-24px)] flex-col shadow-card"
    >
      {/* banner strip in the booth's own colors */}
      <div
        className="flex items-center gap-2 rounded-t-md px-4 py-2"
        style={{ backgroundColor: s.booth.banner }}
      >
        <PixelGlyph glyph={s.booth.glyph} color="#F2EFE7" size={16} />
        <span className="micro truncate text-paper">{s.booth.sign}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close booth card"
          className="ml-auto rounded-sm px-1 leading-none text-paper/80 hover:text-paper"
        >
          ×
        </button>
      </div>

      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl leading-tight">{s.name}</h2>
          <RankBadge revenue={s.verifiedRevenue} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="micro rounded-sm border border-line px-1.5 py-0.5 text-muted">
            {s.category}
          </span>
          {s.seekingCofounder && (
            <span className="micro rounded-sm border border-verify/40 px-1.5 py-0.5 text-verify">
              Seeking co-founder
            </span>
          )}
        </div>

        <p className="font-display text-[15px] italic leading-snug text-ink">
          {s.oneLiner}
        </p>
        <p className="text-sm leading-relaxed text-muted">{s.pitch}</p>

        <div>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="micro text-muted">Goal</span>
            <span className="text-xs text-muted">{pct}%</span>
          </div>
          <p className="mb-1.5 text-sm">{s.goal}</p>
          <div className="h-1 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-verify"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progress toward goal: ${pct}%`}
            />
          </div>
        </div>

        <div className="border-t border-line pt-3">
          <span className="micro text-muted">Founder</span>
          <p className="text-sm">{s.founder}</p>
        </div>

        {isYours ? (
          <p className="text-sm text-muted">
            This is your booth. Try not to talk to yourself.
          </p>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onChat}
              className="flex-1 rounded-md bg-ink px-3 py-2 text-sm text-paper hover:bg-ink/85"
            >
              Chat with {firstName}
            </button>
            <button
              type="button"
              onClick={onConnect}
              disabled={connected}
              className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                connected
                  ? "cursor-default border-verify/40 text-verify"
                  : "border-accent text-accent hover:bg-accent-soft"
              }`}
            >
              {connected ? "Connected" : "Connect"}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

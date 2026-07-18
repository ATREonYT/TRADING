"use client";

import Link from "next/link";
import type { NetClient, Startup } from "@/lib/types";
import RankBadge from "@/components/RankBadge";
import TierTag from "@/components/TierTag";
import PixelGlyph from "@/components/PixelGlyph";
import Guestbook from "@/components/Guestbook";
import { luma } from "@/game/sprites";

interface BoothCardProps {
  startup: Startup;
  isYours: boolean;
  /** Claimed by a live player on this floor (the founder is a real person here now). */
  live?: boolean;
  /** Claimed stand whose owner has left the floor (stand stays up, marked away). */
  ownerAway?: boolean;
  connected: boolean;
  /** Owned stands only: a connection request is already out to this person. */
  pending?: boolean;
  onConnect: () => void;
  onChat: () => void;
  /** Present only for your own stand: pack it up. */
  onUnclaim?: () => void;
  onClose: () => void;
  /** When set, a guestbook renders below the founder row. */
  guestbook?: {
    net: NetClient | null;
    floorId: string;
    boothKey: string;
    onFocusChange?: (focused: boolean) => void;
    onSigned?: (key: string) => void;
  };
}

export default function BoothCard({
  startup: s,
  isYours,
  live = false,
  ownerAway = false,
  connected,
  pending = false,
  onConnect,
  onChat,
  onUnclaim,
  onClose,
  guestbook,
}: BoothCardProps) {
  const firstName = s.founder.split(" ")[0] || s.founder;
  const pct = Math.round(Math.max(0, Math.min(1, s.goalProgress)) * 100);
  // Banner colors are user-picked — same light/dark flip the tilemap uses,
  // or pale banners render their sign text unreadable.
  const bannerFg = luma(s.booth.banner) > 0.62 ? "#23201A" : "#F2EFE7";

  return (
    <aside
      aria-label={`Booth: ${s.name}`}
      className="panel anim-in pointer-events-auto flex w-[340px] max-w-[calc(100vw-24px)] flex-col shadow-card"
    >
      {/* banner strip in the booth's own colors */}
      <div
        className="flex items-center gap-2 rounded-t-md px-4 py-2"
        style={{ backgroundColor: s.booth.banner }}
      >
        {s.booth.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.booth.logo} alt="" aria-hidden="true" width={16} height={16} className="pixelated" />
        ) : (
          <PixelGlyph glyph={s.booth.glyph} color={bannerFg} size={16} />
        )}
        <span className="micro truncate" style={{ color: bannerFg }}>
          {s.booth.sign}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close booth card"
          className="ml-auto rounded-sm px-1 leading-none opacity-80 hover:opacity-100"
          style={{ color: bannerFg }}
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
          {s.tier && <TierTag tier={s.tier} />}
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

        {guestbook && (
          <Guestbook
            net={guestbook.net}
            floorId={guestbook.floorId}
            boothKey={guestbook.boothKey}
            boothName={s.name}
            onFocusChange={guestbook.onFocusChange}
            onSigned={guestbook.onSigned}
          />
        )}

        {isYours ? (
          <>
            <p className="text-sm text-muted">
              This is your stand. Try not to talk to yourself.
            </p>
            <div className="flex gap-2">
              <Link
                href="/profile"
                className="flex-1 rounded-md bg-ink px-3 py-2 text-center text-sm text-paper hover:bg-ink/85"
              >
                Customize
              </Link>
              {onUnclaim && (
                <button
                  type="button"
                  onClick={onUnclaim}
                  className="flex-1 rounded-md border border-line px-3 py-2 text-sm text-muted hover:border-ink hover:text-ink"
                >
                  Pack up
                </button>
              )}
            </div>
          </>
        ) : live ? (
          <>
            <p className="text-sm text-muted">
              {firstName} is a real person, somewhere on this floor right now.
              Say hi in floor chat.
            </p>
            <button
              type="button"
              onClick={onConnect}
              disabled={connected || pending}
              className={`btn-press rounded-md border px-3 py-2 text-sm ${
                connected
                  ? "cursor-default border-verify/40 text-verify"
                  : pending
                    ? "cursor-default border-line text-muted"
                    : "border-accent text-accent hover:bg-accent-soft"
              }`}
            >
              {connected ? "Connected" : pending ? "Requested" : "Request to connect"}
            </button>
          </>
        ) : ownerAway ? (
          <>
            <p className="text-sm text-muted">
              {firstName} set this stand up but is away right now. Leave a note
              in the guestbook — founders read them when they come back.
            </p>
            <button
              type="button"
              onClick={onConnect}
              disabled={connected || pending}
              className={`btn-press rounded-md border px-3 py-2 text-sm ${
                connected
                  ? "cursor-default border-verify/40 text-verify"
                  : pending
                    ? "cursor-default border-line text-muted"
                    : "border-accent text-accent hover:bg-accent-soft"
              }`}
            >
              {connected ? "Connected" : pending ? "Requested" : "Request to connect"}
            </button>
          </>
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

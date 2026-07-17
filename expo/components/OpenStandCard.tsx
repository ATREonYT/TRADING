"use client";

import Link from "next/link";

interface OpenStandCardProps {
  floorName: string;
  /** Whether the local player has a startup to put on the stand. */
  hasStartup: boolean;
  /** Whether they already hold a different stand on this floor (claim moves). */
  claimedElsewhere: boolean;
  onClaim: () => void;
  onClose: () => void;
}

/** Card shown when interacting with a vacant stand. */
export default function OpenStandCard({
  floorName,
  hasStartup,
  claimedElsewhere,
  onClaim,
  onClose,
}: OpenStandCardProps) {
  return (
    <aside
      aria-label="Open stand"
      className="panel anim-in pointer-events-auto flex w-[340px] max-w-[calc(100vw-24px)] flex-col shadow-card"
    >
      <div className="flex items-center gap-2 rounded-t-md bg-line/60 px-4 py-2">
        <span className="micro text-muted">Open stand</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close card"
          className="ml-auto rounded-sm px-1 leading-none text-muted hover:text-ink"
        >
          ×
        </button>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <h2 className="font-display text-xl leading-tight">Nobody here yet.</h2>

        {hasStartup ? (
          <>
            <p className="text-sm leading-relaxed text-muted">
              {claimedElsewhere
                ? `You already have a stand on ${floorName}. Claiming this one moves it — carpet, banner, and all.`
                : `Claim it and your booth goes up right here on ${floorName}, visible to everyone on the floor.`}
            </p>
            <button
              type="button"
              onClick={onClaim}
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              {claimedElsewhere ? "Move your stand here" : "Claim this stand"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-muted">
              This spot is up for grabs. Set up your startup first, then come
              back and claim it.
            </p>
            <Link
              href="/profile"
              className="rounded-md bg-ink px-3 py-2 text-center text-sm text-paper hover:bg-ink/85"
            >
              Set up your booth in Profile
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}

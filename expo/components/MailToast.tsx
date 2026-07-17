"use client";

/**
 * Top-right "you've got mail" notification: pixel envelope, sender, preview.
 * Used by the global Messenger on regular pages and by the floor HUD for
 * incoming connection DMs. Click opens the conversation; it dismisses itself
 * after a few seconds either way.
 */

import { useEffect } from "react";

export interface MailToastData {
  id: number; // fresh id per toast so repeat senders still re-animate
  fromName: string;
  company?: string;
  text: string;
  /** Which thread to open on click (peer profile id). */
  peerId: string;
}

/** 12x9 pixel envelope, drawn with rects like the in-game emotes. */
export function PixelMail({ size = 22, color = "#23201A" }: { size?: number; color?: string }) {
  const px = size / 12;
  const r = (x: number, y: number, w: number, h: number, key: string) => (
    <rect key={key} x={x * px} y={y * px} width={w * px} height={h * px} />
  );
  return (
    <svg
      width={size}
      height={(size * 9) / 12}
      viewBox={`0 0 ${size} ${(size * 9) / 12}`}
      aria-hidden="true"
      shapeRendering="crispEdges"
      fill={color}
    >
      {r(0, 0, 12, 1, "top")}
      {r(0, 8, 12, 1, "bottom")}
      {r(0, 0, 1, 9, "left")}
      {r(11, 0, 1, 9, "right")}
      {/* flap: two diagonals meeting mid-envelope */}
      {r(1, 1, 1, 1, "f1")}
      {r(10, 1, 1, 1, "f2")}
      {r(2, 2, 1, 1, "f3")}
      {r(9, 2, 1, 1, "f4")}
      {r(3, 3, 1, 1, "f5")}
      {r(8, 3, 1, 1, "f6")}
      {r(4, 4, 1, 1, "f7")}
      {r(7, 4, 1, 1, "f8")}
      {r(5, 5, 2, 1, "f9")}
    </svg>
  );
}

export default function MailToast({
  toast,
  onOpen,
  onDismiss,
}: {
  toast: MailToastData | null;
  onOpen: (peerId: string) => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed right-3 top-16 z-50">
      <button
        type="button"
        onClick={() => {
          onDismiss();
          onOpen(toast.peerId);
        }}
        aria-label={`New message from ${toast.fromName} — open chat`}
        className="panel anim-in btn-press pointer-events-auto flex w-[280px] max-w-[calc(100vw-24px)] items-start gap-2.5 border-l-2 border-l-accent p-3 text-left shadow-card"
      >
        <span className="mt-0.5 shrink-0">
          <PixelMail />
        </span>
        <span className="min-w-0">
          <span className="micro block text-accent">New message</span>
          <span className="block truncate text-sm text-ink">
            {toast.fromName}
            {toast.company && <span className="text-muted"> · {toast.company}</span>}
          </span>
          <span className="block truncate text-xs text-muted">{toast.text}</span>
        </span>
      </button>
    </div>
  );
}

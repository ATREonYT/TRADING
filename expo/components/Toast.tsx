"use client";

export interface ToastData {
  id: number;
  text: string;
}

/**
 * Quiet toast, top-center under the ticker — the bottom of the screen belongs
 * to the emote bar and interact hint, which fire at exactly the moments toasts
 * do. The parent owns the state and the dismiss timer; this stays mounted so
 * the aria-live region exists before the first message.
 */
export default function Toast({ toast }: { toast: ToastData | null }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-36 z-[70] -translate-x-1/2 sm:top-28"
    >
      {toast && (
        <div
          key={toast.id}
          className="panel px-4 py-2 text-sm shadow-card"
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

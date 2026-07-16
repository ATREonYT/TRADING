"use client";

export interface ToastData {
  id: number;
  text: string;
}

/**
 * Quiet toast, bottom-center. The parent owns the state and the dismiss timer;
 * this stays mounted so the aria-live region exists before the first message.
 */
export default function Toast({ toast }: { toast: ToastData | null }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-[70] -translate-x-1/2"
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

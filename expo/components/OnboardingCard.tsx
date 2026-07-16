"use client";

/**
 * Compact first-session checklist. The floor page mounts it only while
 * fewer than four steps are done; once complete it never comes back.
 */

import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/types";

const LABELS: Record<OnboardingStep, string> = {
  move: "Walk somewhere",
  talk: "Send a direct message",
  emote: "Send a reaction",
  connect: "Make a connection",
};

export default function OnboardingCard({ done }: { done: OnboardingStep[] }) {
  return (
    <div
      aria-label="First steps checklist"
      className="panel pointer-events-auto w-48 px-3 py-2.5 shadow-card"
    >
      <span className="micro text-muted">First steps</span>
      <ul className="mt-1.5 space-y-1.5">
        {ONBOARDING_STEPS.map((step) => {
          const ok = done.includes(step);
          return (
            <li
              key={step}
              className={`flex items-center gap-2 text-xs ${
                ok ? "text-muted line-through" : "text-ink"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border text-[9px] leading-none ${
                  ok ? "border-verify bg-verify text-white" : "border-line bg-panel"
                }`}
              >
                {ok ? "✓" : ""}
              </span>
              {LABELS[step]}
              <span className="sr-only">{ok ? " — done" : " — not yet"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

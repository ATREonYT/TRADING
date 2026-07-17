"use client";

/**
 * The guided tour: one instruction at a time, bottom-center above the emote
 * bar, advancing as the player actually does each thing. Skippable. When the
 * last step lands the floor page marks the tutorial done, which completes the
 * "First steps" quest.
 */

import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/types";

const STEP_COPY: Record<OnboardingStep, { title: string; body: string; touchBody?: string }> = {
  move: {
    title: "Walk around",
    body: "WASD or arrow keys — or click anywhere on the floor to walk there.",
    touchBody: "Tap anywhere on the floor to walk there.",
  },
  interact: {
    title: "Find a booth",
    body: "Walk up to any stand and press E (or click it) to see who's there.",
    touchBody: "Walk up to any stand and tap it to see who's there.",
  },
  talk: {
    title: "Say something",
    body: "Ask the founder a question — type in the chat that just opened.",
  },
  emote: {
    title: "React",
    body: "Press 1–5 (or use the buttons below) to send a reaction.",
    touchBody: "Use the reaction buttons below to send one.",
  },
  connect: {
    title: "Make it count",
    body: "Like them? Hit Connect on the booth card — they go in your contact list.",
  },
};

export default function TutorialCoach({
  done,
  coarse,
  onSkip,
}: {
  /** Steps already completed. */
  done: OnboardingStep[];
  /** Coarse pointer (touch) — swaps the keyboard copy. */
  coarse: boolean;
  onSkip: () => void;
}) {
  const current = ONBOARDING_STEPS.find((s) => !done.includes(s));
  if (!current) return null;
  const idx = ONBOARDING_STEPS.indexOf(current);
  const copy = STEP_COPY[current];
  const body = coarse && copy.touchBody ? copy.touchBody : copy.body;

  return (
    <div className="panel anim-in pointer-events-auto w-[320px] max-w-[calc(100vw-24px)] border-l-2 border-l-accent p-3 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <span className="micro text-accent">
          Tour · {idx + 1}/{ONBOARDING_STEPS.length}
        </span>
        <button
          type="button"
          onClick={onSkip}
          className="micro text-muted hover:text-ink"
        >
          skip tour
        </button>
      </div>
      <p className="mt-1 font-display text-base leading-tight">{copy.title}</p>
      <p className="mt-0.5 text-sm leading-snug text-muted">{body}</p>
    </div>
  );
}

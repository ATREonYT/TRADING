"use client";

/**
 * Scroll reveal: children fade-rise in when they enter the viewport (once).
 * IntersectionObserver + the .reveal styles in globals.css; reduced-motion
 * users see everything immediately.
 */

import { useEffect, useRef } from "react";

export default function Reveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("reveal-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // huge top rootMargin: anything at or above the viewport counts as
          // seen, so fast scrolling (End key, flick) can't skip a section and
          // leave it invisible
          if (entry.isIntersecting) {
            window.setTimeout(() => el.classList.add("reveal-in"), delayMs);
            io.disconnect();
          }
        }
      },
      { threshold: 0, rootMargin: "10000px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delayMs]);

  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}

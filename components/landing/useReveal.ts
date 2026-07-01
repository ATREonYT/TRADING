"use client";

import { useEffect, useRef } from "react";

/**
 * Adds the `in` class when the element scrolls into view, driving the CSS
 * reveal transition. One-shot (unobserves after first reveal). Degrades to
 * always-visible if IntersectionObserver is unavailable.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(delayMs = 0) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const t = setTimeout(() => el.classList.add("in"), delayMs);
            io.unobserve(el);
            return () => clearTimeout(t);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delayMs]);
  return ref;
}

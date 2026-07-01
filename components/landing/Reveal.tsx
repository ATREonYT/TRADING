"use client";

import { useReveal } from "./useReveal";

/** Wraps children in a scroll-reveal container. */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const ref = useReveal<HTMLDivElement>(delay);
  const Tag = as as "div";
  return (
    <Tag ref={ref} className={`reveal ${className}`}>
      {children}
    </Tag>
  );
}

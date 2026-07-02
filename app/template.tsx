"use client";

// Remounts on every route change, giving each page a smooth entrance.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}

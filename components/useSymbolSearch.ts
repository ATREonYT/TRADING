"use client";

import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "@/lib/radar/search";
import { searchCatalog } from "@/lib/symbolCatalog";

/**
 * Debounced global symbol search. Shows instant results from the built-in
 * catalog while the live all-exchanges lookup is in flight, then swaps in the
 * server results (Yahoo search — names + tickers across every exchange).
 */
export function useSymbolSearch(query: string, limit = 8) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Instant local hits so the dropdown never feels laggy.
    setResults(
      searchCatalog(q, limit).map((e) => ({
        symbol: e.symbol,
        name: e.name,
        exchange: e.kind === "crypto" ? "Crypto" : "US",
        kind: e.kind,
      })),
    );
    setLoading(true);

    const mySeq = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/radar/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const json = (await res.json()) as { items: SearchResult[] };
        if (seq.current === mySeq && Array.isArray(json.items) && json.items.length > 0) {
          setResults(json.items.slice(0, limit));
        }
      } catch {
        /* keep local results */
      } finally {
        if (seq.current === mySeq) setLoading(false);
      }
    }, 220);

    return () => clearTimeout(t);
  }, [query, limit]);

  return { results, loading };
}

/** Route to a stock page, carrying the display name for catered news. */
export function stockHref(r: { symbol: string; name?: string }): string {
  const base = `/stock/${encodeURIComponent(r.symbol.toUpperCase())}`;
  return r.name ? `${base}?name=${encodeURIComponent(r.name.slice(0, 60))}` : base;
}

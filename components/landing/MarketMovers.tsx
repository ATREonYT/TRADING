"use client";

import { useEffect, useState } from "react";
import type { Quote, RadarPayload } from "@/lib/radar/types";
import { Sparkline } from "@/components/Sparkline";
import { usd, pct } from "@/lib/format";
import { ArrowUp, ArrowDown } from "@/components/icons";
import { radarLink } from "@/lib/radar/symbolLink";

// Live top gainers / losers pulled from the markets API.
export function MarketMovers() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/radar/markets", { cache: "no-store" })
      .then((r) => r.json() as Promise<RadarPayload<Quote>>)
      .then((d) => {
        if (!active) return;
        setQuotes(d.items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const gainers = [...quotes].filter((q) => q.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 5);
  const losers = [...quotes].filter((q) => q.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 5);

  return (
    <div className="glossy grid gap-px overflow-hidden rounded-2xl sm:grid-cols-2">
      <Column title="Top gainers" up quotes={gainers} loading={loading} />
      <Column title="Top losers" up={false} quotes={losers} loading={loading} />
    </div>
  );
}

function Column({ title, up, quotes, loading }: { title: string; up: boolean; quotes: Quote[]; loading: boolean }) {
  return (
    <div className="bg-surface/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={up ? "text-up" : "text-down"}>{up ? <ArrowUp size={15} /> : <ArrowDown size={15} />}</span>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      <ul className="space-y-1.5">
        {loading &&
          Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="h-9 animate-pulse rounded bg-elevated/40" />
          ))}
        {!loading &&
          quotes.map((q) => (
            <li key={q.symbol}>
              <a
                href={radarLink(q.symbol)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-elevated/40"
              >
                <span className="w-16 shrink-0 font-mono text-xs font-semibold text-ink">{q.symbol}</span>
                <Sparkline data={q.spark ?? []} up={up} width={48} height={18} />
                <span className="ml-auto tnum font-mono text-2xs text-muted">{usd(q.price)}</span>
                <span className={`tnum w-16 shrink-0 text-right font-mono text-2xs font-semibold ${up ? "text-up" : "text-down"}`}>
                  {pct(q.changePct)}
                </span>
              </a>
            </li>
          ))}
        {!loading && quotes.length === 0 && (
          <li className="py-4 text-center text-2xs text-faint">No data</li>
        )}
      </ul>
    </div>
  );
}

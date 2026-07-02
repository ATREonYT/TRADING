"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "@/components/AccountContext";
import { paperEquity, STARTING_CASH } from "@/lib/account";
import type { Quote, RadarPayload } from "@/lib/radar/types";
import { usd, num, signedUsd, pct } from "@/lib/format";
import { radarLink } from "@/lib/radar/symbolLink";
import { Wallet, ArrowUp, ArrowDown, Radar, External } from "@/components/icons";

export function PaperView() {
  const { user, ready } = useAccount();
  const [prices, setPrices] = useState<Record<string, number>>({});

  // Live prices for P&L: one markets call covers the scanned universe.
  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/radar/markets", { cache: "no-store" })
        .then((r) => r.json() as Promise<RadarPayload<Quote>>)
        .then((d) => {
          if (!active) return;
          const map: Record<string, number> = {};
          for (const q of d.items) map[q.symbol] = q.price;
          setPrices(map);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const rows = useMemo(() => {
    if (!user) return [];
    return Object.entries(user.paper.positions).map(([symbol, pos]) => {
      const last = prices[symbol] ?? pos.avgCost;
      const mv = pos.qty * last;
      const pnl = (last - pos.avgCost) * pos.qty;
      const pnlPct = pos.avgCost ? ((last - pos.avgCost) / pos.avgCost) * 100 : 0;
      return { symbol, ...pos, last, mv, pnl, pnlPct };
    }).sort((a, b) => b.mv - a.mv);
  }, [user, prices]);

  if (!ready) return <div className="px-6 py-20 text-center text-sm text-faint">Loading…</div>;

  if (!user) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-16 text-center lg:px-6">
        <div className="glossy animate-rise rounded-2xl p-8">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-deep text-white shadow-glow">
            <Wallet size={24} />
          </span>
          <h1 className="text-xl font-bold text-ink">Paper trading</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Practice with {usd(STARTING_CASH)} of virtual cash — buy and sell at live prices, track
            your P&amp;L, and learn without risking a cent.
          </p>
          <a
            href="/account"
            className="mt-5 inline-block rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.03]"
          >
            Create a free account to start
          </a>
        </div>
      </div>
    );
  }

  const equity = paperEquity(user.paper, prices);
  const totalPnl = equity - STARTING_CASH;
  const invested = equity - user.paper.cash;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Paper Portfolio</h1>
          <p className="text-2xs text-muted">Virtual money · live prices · zero risk</p>
        </div>
        <a
          href="/radar"
          className="flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.03]"
        >
          <Radar size={15} />
          Find something to trade
        </a>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary label="Account value" value={usd(equity)} />
        <Summary
          label="Total P&L"
          value={signedUsd(totalPnl)}
          tint={totalPnl >= 0 ? "text-up" : "text-down"}
          sub={`${totalPnl >= 0 ? "+" : ""}${num((totalPnl / STARTING_CASH) * 100)}% all-time`}
        />
        <Summary label="Cash" value={usd(user.paper.cash)} sub="available to trade" />
        <Summary label="Invested" value={usd(invested)} sub={`${rows.length} position${rows.length === 1 ? "" : "s"}`} />
      </div>

      {/* Positions */}
      <section className="glossy rounded-2xl" aria-label="Paper positions">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Positions</h2>
          <span className="text-2xs text-faint">click a row for news &amp; trading</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-muted">No positions yet.</p>
            <p className="mt-1 text-2xs text-faint">
              Open any stock page and use the Paper Trade ticket to place your first order.
            </p>
          </div>
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 text-2xs uppercase tracking-wide text-faint">
                  <th className="px-4 py-2.5 text-left font-medium">Symbol</th>
                  <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-4 py-2.5 text-right font-medium">Avg cost</th>
                  <th className="px-4 py-2.5 text-right font-medium">Last</th>
                  <th className="px-4 py-2.5 text-right font-medium">Mkt value</th>
                  <th className="px-4 py-2.5 text-right font-medium">P&L</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.symbol}
                    onClick={() => (window.location.href = radarLink(r.symbol))}
                    className="cursor-pointer border-b border-border/50 transition-colors hover:bg-elevated/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 font-mono font-semibold text-ink">
                        {r.symbol}
                        <External size={11} className="text-faint" />
                      </div>
                      <div className="text-2xs text-faint">{r.name}</div>
                    </td>
                    <td className="tnum px-4 py-3 text-right font-mono">{r.qty}</td>
                    <td className="tnum px-4 py-3 text-right font-mono">{num(r.avgCost)}</td>
                    <td className="tnum px-4 py-3 text-right font-mono text-ink">{num(r.last)}</td>
                    <td className="tnum px-4 py-3 text-right font-mono">{usd(r.mv)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className={`tnum flex items-center justify-end gap-1 font-mono font-semibold ${r.pnl >= 0 ? "text-up" : "text-down"}`}>
                        {r.pnl >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                        {signedUsd(r.pnl)}
                      </div>
                      <div className={`tnum text-2xs ${r.pnl >= 0 ? "text-up/80" : "text-down/80"}`}>{pct(r.pnlPct)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Trade history */}
      <section className="glossy rounded-2xl" aria-label="Trade history">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Trade history</h2>
          <span className="text-2xs text-faint">{user.paper.trades.length} fills</span>
        </div>
        {user.paper.trades.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-faint">No trades yet.</p>
        ) : (
          <ol className="scroll-thin max-h-[320px] divide-y divide-border/50 overflow-y-auto">
            {user.paper.trades.slice(0, 40).map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span
                  className={`w-11 rounded px-1.5 py-0.5 text-center text-2xs font-bold uppercase ${
                    t.side === "buy" ? "bg-up/15 text-up" : "bg-down/15 text-down"
                  }`}
                >
                  {t.side}
                </span>
                <a href={radarLink(t.symbol)} className="font-mono font-semibold text-ink hover:text-primary">
                  {t.symbol}
                </a>
                <span className="tnum font-mono text-2xs text-muted">
                  {t.qty} @ {num(t.price)}
                </span>
                <span className="tnum ml-auto font-mono text-2xs text-ink">{usd(t.total)}</span>
                <span className="w-32 text-right text-2xs text-faint">
                  {new Date(t.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="rounded-lg border border-border bg-surface/50 px-3 py-2 text-2xs leading-relaxed text-faint">
        <span className="font-semibold text-muted">Simulation only.</span> Paper trades fill instantly
        at the last shown price with no fees, slippage or market impact — real trading differs. Virtual
        money, stored on this device. Not financial advice.
      </p>
    </div>
  );
}

function Summary({ label, value, sub, tint = "text-ink" }: { label: string; value: string; sub?: string; tint?: string }) {
  return (
    <div className="glossy card-hover rounded-2xl p-4">
      <div className="text-2xs font-medium uppercase tracking-wide text-faint">{label}</div>
      <div className={`tnum mt-1.5 font-mono text-xl font-bold tracking-tight ${tint}`}>{value}</div>
      {sub && <div className="mt-0.5 text-2xs text-muted">{sub}</div>}
    </div>
  );
}

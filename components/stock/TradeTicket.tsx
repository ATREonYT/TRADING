"use client";

import { useState } from "react";
import { useAccount } from "@/components/AccountContext";
import { placeTrade } from "@/lib/accounts";
import { usd } from "@/lib/format";
import { Wallet } from "@/components/icons";

// Paper-trading order ticket: market orders against the latest shown price.
export function TradeTicket({
  symbol,
  name,
  kind,
  price,
}: {
  symbol: string;
  name: string;
  kind: "equity" | "crypto";
  price: number | null;
}) {
  const { user, ready } = useAccount();
  const [qtyStr, setQtyStr] = useState("1");
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const qty = parseFloat(qtyStr);
  const validQty = Number.isFinite(qty) && qty > 0;
  const est = validQty && price ? qty * price : 0;
  const pos = user?.paper.positions[symbol];

  const submit = async (side: "buy" | "sell") => {
    if (!price) return;
    const res = await placeTrade({ symbol, name, kind, side, qty, price });
    setFlash(
      res.ok
        ? { kind: "ok", text: `${side === "buy" ? "Bought" : "Sold"} ${qty} ${symbol} @ ${usd(price)}` }
        : { kind: "err", text: res.error ?? "Order rejected." },
    );
    setTimeout(() => setFlash(null), 3500);
  };

  if (!ready) return null;

  if (!user) {
    return (
      <div className="glossy rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary">
            <Wallet size={15} />
          </span>
          <h2 className="text-sm font-semibold text-ink">Paper trade {symbol}</h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Practice trading with $100,000 of virtual cash — no real money, no risk.
        </p>
        <a
          href="/account"
          className="mt-3 block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.02]"
        >
          Create a free practice account
        </a>
      </div>
    );
  }

  return (
    <div className="glossy rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary">
          <Wallet size={15} />
        </span>
        <h2 className="text-sm font-semibold text-ink">Paper trade</h2>
        <span className="ml-auto text-2xs text-faint">
          cash <span className="tnum font-mono text-ink">{usd(user.paper.cash)}</span>
        </span>
      </div>

      {pos && (
        <div className="mt-2.5 flex items-center justify-between rounded-lg border border-border/60 bg-base/40 px-2.5 py-1.5 text-2xs">
          <span className="text-muted">
            Holding <span className="tnum font-mono text-ink">{pos.qty}</span> @ avg{" "}
            <span className="tnum font-mono text-ink">{usd(pos.avgCost)}</span>
          </span>
          {price && (
            <span className={`tnum font-mono font-semibold ${price >= pos.avgCost ? "text-up" : "text-down"}`}>
              {price >= pos.avgCost ? "+" : ""}
              {usd((price - pos.avgCost) * pos.qty)}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-faint">Quantity</span>
          <input
            type="number"
            min="0"
            step="any"
            value={qtyStr}
            onChange={(e) => setQtyStr(e.target.value)}
            className="w-full rounded-lg border border-border bg-base px-3 py-2 font-mono text-sm text-ink transition-colors focus:border-primary/60 focus:outline-none"
            aria-label="Order quantity"
          />
        </label>
        <div className="flex-1 text-right">
          <span className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-faint">Est. total</span>
          <span className="tnum font-mono text-lg font-bold text-ink">{price ? usd(est) : "—"}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => submit("buy")}
          disabled={!price || !validQty || est > user.paper.cash}
          className="rounded-lg bg-up px-4 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Buy
        </button>
        <button
          onClick={() => submit("sell")}
          disabled={!price || !validQty || !pos || qty > (pos?.qty ?? 0)}
          className="rounded-lg bg-down px-4 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Sell
        </button>
      </div>

      {flash && (
        <p
          className={`mt-2.5 animate-fade-up rounded-lg px-3 py-2 text-xs font-medium ${
            flash.kind === "ok"
              ? "border border-up/40 bg-up/10 text-up"
              : "border border-down/40 bg-down/10 text-down"
          }`}
          role="status"
        >
          {flash.text}
        </p>
      )}

      <p className="mt-2.5 text-2xs leading-relaxed text-faint">
        Simulated fills at the last shown price · virtual money only · not financial advice.
      </p>
    </div>
  );
}

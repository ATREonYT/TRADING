"use client";

/**
 * Booth guestbook: last three entries plus a one-line sign form.
 * Existing entries load from GET httpBase()/guestbook; new ones arrive
 * live over the ws {t:"guestbook"} broadcast (sender included). Offline,
 * the form is disabled — a signature that goes nowhere shouldn't look
 * like one that persists.
 */

import { useEffect, useState } from "react";
import type { GuestbookEntry, NetClient } from "@/lib/types";
import { httpBase } from "@/lib/net";

const MAX_LEN = 120;

function parseEntries(data: unknown): GuestbookEntry[] {
  if (!data || typeof data !== "object") return [];
  const raw = (data as { entries?: unknown }).entries;
  if (!Array.isArray(raw)) return [];
  const out: GuestbookEntry[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    if (
      typeof r.from === "string" &&
      typeof r.text === "string" &&
      typeof r.ts === "number"
    ) {
      out.push({ from: r.from, text: r.text, ts: r.ts });
    }
  }
  return out;
}

/** Merge two entry lists, dedupe, newest first, capped at 50. */
function mergeEntries(a: GuestbookEntry[], b: GuestbookEntry[]): GuestbookEntry[] {
  const seen = new Map<string, GuestbookEntry>();
  for (const e of [...a, ...b]) {
    seen.set(`${e.ts}:${e.from}:${e.text}`, e);
  }
  return [...seen.values()].sort((x, y) => y.ts - x.ts).slice(0, 50);
}

interface GuestbookProps {
  net: NetClient | null;
  floorId: string;
  /** Startup id for seed booths, "spot:<spotIndex>" for claimed stands. */
  boothKey: string;
  /** Booth display name — the server embeds it in the ticker line on sign. */
  boothName?: string;
  /** Wire game input on/off while typing. */
  onFocusChange?: (focused: boolean) => void;
  /** Fired after a successful sign (quest tracking). */
  onSigned?: (key: string) => void;
}

export default function Guestbook({
  net,
  floorId,
  boothKey,
  boothName,
  onFocusChange,
  onSigned,
}: GuestbookProps) {
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [text, setText] = useState("");
  const [online, setOnline] = useState<boolean>(net?.online ?? false);

  // existing entries, newest first — merged (not replaced) so live ws entries
  // that land while the fetch is in flight survive
  useEffect(() => {
    setEntries([]);
    const base = httpBase();
    if (!base) return;
    const ctrl = new AbortController();
    const url = `${base}/guestbook?floor=${encodeURIComponent(floorId)}&key=${encodeURIComponent(boothKey)}`;
    fetch(url, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        // abort() can't cancel an already-settled promise chain — a response
        // that raced a boothKey switch must not paint the previous booth's
        // entries over this one's.
        if (ctrl.signal.aborted || !data) return;
        setEntries((prev) => mergeEntries(prev, parseEntries(data)));
      })
      .catch(() => {
        // Offline or aborted — the guestbook just starts empty.
      });
    return () => ctrl.abort();
  }, [floorId, boothKey]);

  // live entries for this key (our own signature arrives as the broadcast
  // echo) + connectivity, so the form disables when the floor server drops
  useEffect(() => {
    if (!net) return;
    setOnline(net.online);
    return net.on((ev) => {
      if (ev.t === "guestbook" && ev.key === boothKey) {
        setEntries((prev) => mergeEntries(prev, [ev.entry]));
      }
      if (ev.t === "welcome") setOnline(true);
      if (ev.t === "status") setOnline(ev.online);
    });
  }, [net, boothKey]);

  const sign = (e: React.FormEvent): void => {
    e.preventDefault();
    const t = text.trim().slice(0, MAX_LEN);
    if (!t || !net?.online) return;
    // The server broadcasts the entry back (echo) — no local append.
    net.sendSign(boothKey, t, boothName);
    onSigned?.(boothKey);
    setText("");
  };

  return (
    <div className="border-t border-line pt-3">
      <span className="micro text-muted">Guestbook</span>
      {entries.length === 0 ? (
        <p className="mt-1.5 text-xs text-muted">Nobody has signed yet.</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {entries.slice(0, 3).map((en, i) => (
            <li key={`${en.ts}-${i}`} className="text-xs leading-snug text-muted">
              <span className="text-ink">{en.from}</span> — {en.text}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={sign} className="mt-2 flex gap-2">
        <label htmlFor={`guestbook-${boothKey}`} className="sr-only">
          Sign the guestbook
        </label>
        <input
          id={`guestbook-${boothKey}`}
          type="text"
          value={text}
          maxLength={MAX_LEN}
          disabled={!online}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          placeholder={online ? "Leave a line" : "guestbook needs the floor server"}
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-md border border-line px-2 text-sm placeholder:text-muted/70 disabled:bg-paper disabled:text-muted"
        />
        <button
          type="submit"
          disabled={!online}
          className="h-10 shrink-0 rounded-md border border-ink px-3 text-sm hover:bg-paper disabled:cursor-default disabled:border-line disabled:text-muted disabled:hover:bg-transparent"
        >
          Sign
        </button>
      </form>
    </div>
  );
}

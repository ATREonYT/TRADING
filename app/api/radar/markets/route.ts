import { NextResponse } from "next/server";
import { fetchAllQuotes } from "@/lib/radar/market";
import { demoQuotes } from "@/lib/radar/demo";
import type { Quote, RadarPayload } from "@/lib/radar/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(): Promise<NextResponse<RadarPayload<Quote>>> {
  const notes: string[] = [];
  let quotes: Quote[] = [];
  let degraded = false;

  try {
    const res = await fetchAllQuotes();
    quotes = res.quotes;
  } catch (e) {
    notes.push(`fetch error: ${(e as Error).message}`);
  }

  if (quotes.length === 0) {
    degraded = true;
    notes.push("Live market data blocked — showing demo quotes.");
    quotes = demoQuotes();
  }

  // Biggest movers first so spikes surface immediately.
  quotes.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  return NextResponse.json({
    ok: true,
    degraded,
    generatedAt: new Date().toISOString(),
    count: quotes.length,
    items: quotes,
    notes,
  });
}

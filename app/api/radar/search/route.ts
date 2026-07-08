import { NextResponse } from "next/server";
import { searchSymbols } from "@/lib/radar/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 60);
  const { items, degraded } = await searchSymbols(q, 10);
  return NextResponse.json({ ok: true, degraded, items });
}

"use client";

/**
 * Client for the floor server's account API. Accounts are optional — guests
 * keep full access — but an account makes your identity server-verified:
 * nobody can impersonate your id on the floor, in the social graph, or on
 * your stand, and your connections/chats follow you across devices.
 * The bearer token lives in localStorage next to the rest of the app state.
 */

import { httpBase } from "@/lib/net";

const AUTH_KEY = "founderfloor:auth";

export interface AuthState {
  id: string; // "acct_<uuid>"
  name: string;
  token: string;
}

export function getAuth(): AuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as AuthState).id === "string" &&
      typeof (parsed as AuthState).token === "string"
    ) {
      return parsed as AuthState;
    }
  } catch {
    // corrupt — treat as signed out
  }
  return null;
}

function setAuth(a: AuthState | null): void {
  if (typeof window === "undefined") return;
  try {
    if (a) window.localStorage.setItem(AUTH_KEY, JSON.stringify(a));
    else window.localStorage.removeItem(AUTH_KEY);
  } catch {
    // storage blocked — session-only auth
  }
}

/** Token for a given profile id, or undefined when it isn't the signed-in account. */
export function tokenFor(profileId: string): string | undefined {
  const a = getAuth();
  return a && a.id === profileId ? a.token : undefined;
}

const GS_KEY = "founderfloor:gs";

/**
 * Browser-held guest secret: generated once, sent with every join and social
 * call. The server binds it to your guest id on first use, so nobody who
 * merely SAW your id (it travels to peers on stands, cards, and DMs) can read
 * your inbox or repossess your stand. Accounts use bearer tokens instead,
 * but sending this alongside is harmless.
 */
export function guestSecret(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(GS_KEY);
    if (existing && existing.length >= 16) return existing;
    const s = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    window.localStorage.setItem(GS_KEY, s);
    return s;
  } catch {
    return ""; // storage blocked — degrade to an unbound guest
  }
}

async function authPost(
  path: string,
  body: unknown,
): Promise<{ id: string; name: string; token: string } | { error: string }> {
  const base = httpBase();
  if (!base) return { error: "floor server unreachable" };
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { error: "floor server said no" };
    return (await res.json()) as { id: string; name: string; token: string } | { error: string };
  } catch {
    return { error: "floor server unreachable" };
  }
}

export async function register(name: string, password: string): Promise<AuthState | string> {
  const r = await authPost("/auth/register", { name, password });
  if ("error" in r) return r.error;
  setAuth(r);
  return r;
}

export async function login(name: string, password: string): Promise<AuthState | string> {
  const r = await authPost("/auth/login", { name, password });
  if ("error" in r) return r.error;
  setAuth(r);
  return r;
}

export async function logout(): Promise<void> {
  const a = getAuth();
  setAuth(null);
  if (a) await authPost("/auth/logout", { token: a.token });
}

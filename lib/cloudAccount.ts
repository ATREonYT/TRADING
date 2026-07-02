// Supabase-backed accounts: real email/password auth and a cloud-synced paper
// portfolio (one jsonb row per user, guarded by row-level security — see
// SUPABASE.md). Active only when the two NEXT_PUBLIC_SUPABASE_* env vars are
// set; otherwise the app falls back to device-local accounts automatically.

import { createClient, type SupabaseClient, type User as SbUser } from "@supabase/supabase-js";
import {
  ACCOUNT_EVENT,
  applyTrade,
  freshPaper,
  type PaperState,
  type TradeInput,
  type User,
} from "./account";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const cloudEnabled = /^https:\/\/.+\.supabase\.co/.test(URL) && KEY.length > 20;

let client: SupabaseClient | null = null;
const sb = (): SupabaseClient => (client ??= createClient(URL, KEY));

let cached: User | null = null;
let uid: string | null = null;
let initialized = false;

const emit = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ACCOUNT_EVENT));
};

async function loadUser(sbUser: SbUser | null) {
  if (!sbUser) {
    cached = null;
    uid = null;
    emit();
    return;
  }
  uid = sbUser.id;
  let paper: PaperState = freshPaper();
  try {
    const { data } = await sb().from("paper_accounts").select("state").eq("user_id", uid).maybeSingle();
    if (data?.state) paper = data.state as PaperState;
    else await sb().from("paper_accounts").upsert({ user_id: uid, state: paper });
  } catch {
    // Table missing or offline — keep a fresh in-memory portfolio; trades will
    // retry persistence on the next write.
  }
  cached = {
    name: (sbUser.user_metadata?.name as string) ?? sbUser.email ?? "Trader",
    email: sbUser.email ?? "",
    passHash: "",
    salt: "",
    createdAt: sbUser.created_at,
    paper,
  };
  emit();
}

/** Subscribe once to auth state; restores the session on page load. */
export function initCloud() {
  if (!cloudEnabled || initialized || typeof window === "undefined") return;
  initialized = true;
  sb()
    .auth.getSession()
    .then(({ data }) => loadUser(data.session?.user ?? null));
  sb().auth.onAuthStateChange((_event, session) => {
    void loadUser(session?.user ?? null);
  });
}

export const cloudCurrentUser = (): User | null => cached;

export async function cloudSignUp(
  name: string,
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string; needsConfirm?: boolean }> {
  if (!name.trim()) return { ok: false, error: "Please enter your name." };
  const { data, error } = await sb().auth.signUp({
    email: email.trim(),
    password,
    options: { data: { name: name.trim() } },
  });
  if (error) return { ok: false, error: error.message };
  // With email confirmation enabled in Supabase there's no session yet.
  if (!data.session) return { ok: true, needsConfirm: true };
  return { ok: true };
}

export async function cloudSignIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function cloudSignOut() {
  await sb().auth.signOut();
  cached = null;
  uid = null;
  emit();
}

async function persist(): Promise<boolean> {
  if (!cached || !uid) return false;
  const { error } = await sb()
    .from("paper_accounts")
    .upsert({ user_id: uid, state: cached.paper, updated_at: new Date().toISOString() });
  return !error;
}

export async function cloudPlaceTrade(input: TradeInput): Promise<{ ok: boolean; error?: string }> {
  if (!cached || !uid) return { ok: false, error: "Sign in to trade." };
  const res = applyTrade(cached.paper, input);
  if (!res.ok) return res;
  emit(); // optimistic UI
  const saved = await persist();
  return saved ? { ok: true } : { ok: true, error: "Saved locally — cloud sync failed, will retry on next trade." };
}

export async function cloudResetPaper() {
  if (!cached || !uid) return;
  cached.paper = freshPaper();
  emit();
  await persist();
}

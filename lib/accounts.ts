// Unified account API. Components import ONLY from this module — it routes to
// Supabase cloud accounts when configured, or device-local accounts otherwise.

import * as local from "./account";
import * as cloud from "./cloudAccount";

export { cloudEnabled } from "./cloudAccount";
export { ACCOUNT_EVENT, STARTING_CASH, paperEquity, type User, type TradeInput } from "./account";

/** Call once on the client to restore any existing session. */
export function initAccounts() {
  if (cloud.cloudEnabled) cloud.initCloud();
}

export function getCurrentUser(): local.User | null {
  return cloud.cloudEnabled ? cloud.cloudCurrentUser() : local.currentUser();
}

export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string; needsConfirm?: boolean }> {
  return cloud.cloudEnabled ? cloud.cloudSignUp(name, email, password) : local.signUp(name, email, password);
}

export async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  return cloud.cloudEnabled ? cloud.cloudSignIn(email, password) : local.signIn(email, password);
}

export async function signOut() {
  if (cloud.cloudEnabled) await cloud.cloudSignOut();
  else local.signOut();
}

export async function placeTrade(input: local.TradeInput): Promise<{ ok: boolean; error?: string }> {
  return cloud.cloudEnabled ? cloud.cloudPlaceTrade(input) : local.placeTrade(input);
}

export async function resetPaper() {
  if (cloud.cloudEnabled) await cloud.cloudResetPaper();
  else local.resetPaper();
}

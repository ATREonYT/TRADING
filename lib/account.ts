// Device-local accounts + paper trading.
//
// There is no backend in this project, so accounts live in localStorage —
// passwords are salted + SHA-256 hashed via WebCrypto and never leave the
// device. This is honest practice-account auth, NOT production auth: anyone
// with access to the browser profile can read the store. The UI labels it so.

export interface PaperPosition {
  qty: number;
  avgCost: number;
  name: string;
  kind: "equity" | "crypto";
}

export interface PaperTrade {
  id: string;
  time: string; // ISO
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  total: number;
}

export interface PaperState {
  cash: number;
  positions: Record<string, PaperPosition>;
  trades: PaperTrade[];
}

export interface User {
  name: string;
  email: string;
  passHash: string;
  salt: string;
  createdAt: string;
  paper: PaperState;
}

export const STARTING_CASH = 100_000;

const USERS_KEY = "helix:users";
const SESSION_KEY = "helix:session";
export const ACCOUNT_EVENT = "helix:account";

const isBrowser = () => typeof window !== "undefined" && !!window.localStorage;

const emit = () => {
  if (isBrowser()) window.dispatchEvent(new Event(ACCOUNT_EVENT));
};

export const freshPaper = (): PaperState => ({ cash: STARTING_CASH, positions: {}, trades: [] });

function readUsers(): Record<string, User> {
  if (!isBrowser()) return {};
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeUsers(users: Record<string, User>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  emit();
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const randomHex = (bytes: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const normEmail = (email: string) => email.trim().toLowerCase();

// ── Session ──────────────────────────────────────────────────────────────────

export function currentUser(): User | null {
  if (!isBrowser()) return null;
  const email = localStorage.getItem(SESSION_KEY);
  if (!email) return null;
  return readUsers()[email] ?? null;
}

export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const e = normEmail(email);
  if (!name.trim()) return { ok: false, error: "Please enter your name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, error: "That email doesn't look right." };
  if (password.length < 6) return { ok: false, error: "Password needs at least 6 characters." };
  const users = readUsers();
  if (users[e]) return { ok: false, error: "An account with this email already exists on this device." };
  const salt = randomHex(16);
  users[e] = {
    name: name.trim(),
    email: e,
    salt,
    passHash: await hashPassword(password, salt),
    createdAt: new Date().toISOString(),
    paper: freshPaper(),
  };
  writeUsers(users);
  localStorage.setItem(SESSION_KEY, e);
  emit();
  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const e = normEmail(email);
  const user = readUsers()[e];
  if (!user) return { ok: false, error: "No account with this email on this device." };
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passHash) return { ok: false, error: "Wrong password." };
  localStorage.setItem(SESSION_KEY, e);
  emit();
  return { ok: true };
}

export function signOut() {
  if (!isBrowser()) return;
  localStorage.removeItem(SESSION_KEY);
  emit();
}

// ── Paper trading ────────────────────────────────────────────────────────────

export interface TradeInput {
  symbol: string;
  name: string;
  kind: "equity" | "crypto";
  side: "buy" | "sell";
  qty: number;
  price: number;
}

const EPS = 1e-9;

/** Pure trade engine — mutates `paper` in place. Shared by local & cloud modes. */
export function applyTrade(paper: PaperState, input: TradeInput): { ok: boolean; error?: string } {
  const { symbol, name, kind, side, qty, price } = input;
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Enter a quantity above zero." };
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: "No live price for this symbol." };

  const total = qty * price;
  const pos = paper.positions[symbol];

  if (side === "buy") {
    if (total > paper.cash + EPS) return { ok: false, error: "Not enough paper cash for that order." };
    paper.cash -= total;
    if (pos) {
      const newQty = pos.qty + qty;
      pos.avgCost = (pos.qty * pos.avgCost + total) / newQty;
      pos.qty = newQty;
    } else {
      paper.positions[symbol] = { qty, avgCost: price, name, kind };
    }
  } else {
    if (!pos || qty > pos.qty + EPS) return { ok: false, error: "You don't hold that much to sell." };
    paper.cash += total;
    pos.qty -= qty;
    if (pos.qty <= EPS) delete paper.positions[symbol];
  }

  paper.trades.unshift({
    id: randomHex(8),
    time: new Date().toISOString(),
    symbol,
    side,
    qty,
    price,
    total,
  });
  paper.trades = paper.trades.slice(0, 200);
  return { ok: true };
}

export function placeTrade(input: TradeInput): { ok: boolean; error?: string } {
  const user = currentUser();
  if (!user) return { ok: false, error: "Sign in to trade." };
  const res = applyTrade(user.paper, input);
  if (!res.ok) return res;
  const users = readUsers();
  users[user.email] = user;
  writeUsers(users);
  return { ok: true };
}

export function resetPaper() {
  const user = currentUser();
  if (!user) return;
  user.paper = freshPaper();
  const users = readUsers();
  users[user.email] = user;
  writeUsers(users);
}

/** Total account value given a map of live prices (falls back to avg cost). */
export function paperEquity(paper: PaperState, prices: Record<string, number>): number {
  let equity = paper.cash;
  for (const [symbol, pos] of Object.entries(paper.positions)) {
    equity += pos.qty * (prices[symbol] ?? pos.avgCost);
  }
  return equity;
}

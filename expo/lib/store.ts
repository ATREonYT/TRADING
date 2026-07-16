"use client";

/**
 * FounderFloor — SSR-safe client persistence.
 *
 * All app state lives under one localStorage key ("founderfloor:v1") and is
 * shared across every component that calls useAppState() via a module-level
 * store + emitter. Cross-tab consistency comes from the `storage` event.
 *
 * On the server (and during hydration) the hook returns a stable default
 * snapshot; the real persisted state is loaded after mount, so server and
 * client markup always agree.
 */

import { useSyncExternalStore } from "react";
import type {
  AppState,
  AvatarLook,
  Connection,
  Startup,
  SubTier,
} from "@/lib/types";
import { FLOORS } from "@/lib/data/floors";

const STORAGE_KEY = "founderfloor:v1";

export interface StoreActions {
  setName(name: string): void;
  setLook(look: AvatarLook): void;
  setSub(tier: SubTier): void;
  addConnection(c: Omit<Connection, "ts">): void;
  removeConnection(ts: number): void;
  saveMyStartup(s: Startup): void;
  clearMyStartup(): void;
  verifyMyRevenue(monthly: number, goalProgress: number): void;
  /** Claim (or move) your stand on a floor: floorId -> boothSpots index. */
  claimSpot(floorId: string, spotIndex: number): void;
  /** Pack up your stand on a floor. */
  unclaimSpot(floorId: string): void;
}

// ---------- defaults ----------

function defaultState(): AppState {
  return {
    profile: { id: "", name: "", look: { skin: 0, outfit: 0, hair: 0 } },
    sub: "free",
    connections: [],
    claims: {},
  };
}

/** Stable reference for getServerSnapshot — must never change identity. */
const SERVER_SNAPSHOT: AppState = defaultState();

// ---------- module-level store ----------

let state: AppState = defaultState();
let hydrated = false;
let storageListenerAttached = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const cb of Array.from(listeners)) cb();
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be full or blocked (private mode) — state still works in-memory.
  }
}

function setState(next: AppState): void {
  state = next;
  persist();
  emit();
}

// ---------- id + parsing helpers ----------

function makeId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to the hex fallback
  }
  let hex = "";
  for (let i = 0; i < 32; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return hex;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function looksLikeConnection(v: unknown): v is Connection {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.name === "string" &&
    typeof c.ts === "number" &&
    typeof c.floorId === "string"
  );
}

const GLYPHS = ["bolt", "leaf", "coin", "chip", "flask", "rocket", "heart", "cube", "wave", "star"] as const;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Clamp an untrusted value to an integer palette index in [0, max]. */
function lookIndex(v: unknown, max: number): number {
  const n = Math.trunc(numOr(v, 0));
  return Math.min(Math.max(n, 0), max);
}

function sanitizeLook(v: unknown): { skin: number; outfit: number; hair: number } {
  const l = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { skin: lookIndex(l.skin, 5), outfit: lookIndex(l.outfit, 7), hair: lookIndex(l.hair, 7) };
}

function looksLikeStartup(v: unknown): v is Startup {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  if (
    typeof s.id !== "string" ||
    typeof s.name !== "string" ||
    typeof s.goal !== "string" ||
    typeof s.oneLiner !== "string" ||
    typeof s.founder !== "string" ||
    typeof s.booth !== "object" ||
    s.booth === null
  ) {
    return false;
  }
  const b = s.booth as Record<string, unknown>;
  return (
    typeof b.carpet === "string" &&
    HEX_COLOR.test(b.carpet) &&
    typeof b.banner === "string" &&
    HEX_COLOR.test(b.banner) &&
    typeof b.sign === "string" &&
    typeof b.glyph === "string" &&
    (GLYPHS as readonly string[]).includes(b.glyph)
  );
}

/** Defensive re-shape of whatever was in localStorage into a valid AppState. */
function sanitize(raw: unknown): AppState {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;

  const p = r.profile;
  if (p && typeof p === "object") {
    const pr = p as Record<string, unknown>;
    if (typeof pr.id === "string") base.profile.id = pr.id;
    if (typeof pr.name === "string") base.profile.name = pr.name;
    if (pr.look && typeof pr.look === "object") {
      base.profile.look = sanitizeLook(pr.look);
    }
  }

  if (r.sub === "free" || r.sub === "pro" || r.sub === "founder") {
    base.sub = r.sub;
  }

  if (Array.isArray(r.connections)) {
    base.connections = r.connections.filter(looksLikeConnection);
  }

  if (looksLikeStartup(r.myStartup)) {
    const s = r.myStartup;
    base.myStartup = {
      ...s,
      booth: { ...s.booth, sign: s.booth.sign.slice(0, 12) },
      founderLook: sanitizeLook((s as unknown as Record<string, unknown>).founderLook),
      goalProgress: clamp01(numOr(s.goalProgress, 0)),
      verifiedRevenue: Math.max(0, numOr(s.verifiedRevenue, 0)),
    };
  }

  if (r.claims && typeof r.claims === "object" && !Array.isArray(r.claims)) {
    for (const [k, v] of Object.entries(r.claims as Record<string, unknown>)) {
      const idx = Math.trunc(numOr(v, -1));
      if (idx >= 0 && idx <= 63 && k.length <= 64) base.claims[k] = idx;
    }
  } else if (base.myStartup) {
    // Migration from the reserved-spot era: booths used to auto-appear at
    // Indie Alley's front-row-center spot. Keep that stand standing.
    const alley = FLOORS.find((f) => f.id === "indie-alley");
    if (alley?.reservedSpot !== undefined) base.claims["indie-alley"] = alley.reservedSpot;
  }

  return base;
}

// ---------- hydration + cross-tab sync ----------

function ensureClientInit(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;

  let next: AppState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    next = raw ? sanitize(JSON.parse(raw)) : defaultState();
  } catch {
    next = defaultState();
  }

  // First run (or corrupted id): mint and persist a stable profile id.
  if (!next.profile.id) {
    next = { ...next, profile: { ...next.profile, id: makeId() } };
  }

  state = next;
  persist();
  emit();

  if (!storageListenerAttached) {
    storageListenerAttached = true;
    window.addEventListener("storage", (ev: StorageEvent) => {
      if (ev.key !== null && ev.key !== STORAGE_KEY) return;
      try {
        let incoming = ev.newValue
          ? sanitize(JSON.parse(ev.newValue))
          : defaultState();
        if (!incoming.profile.id) {
          incoming = {
            ...incoming,
            profile: { ...incoming.profile, id: makeId() },
          };
        }
        state = incoming;
        emit();
      } catch {
        // Ignore malformed writes from other tabs.
      }
    });
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  ensureClientInit();
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): AppState {
  return state;
}

function getServerSnapshot(): AppState {
  return SERVER_SNAPSHOT;
}

// ---------- actions (module-level, stable identity) ----------

const ACTIONS: StoreActions = {
  setName(name: string): void {
    ensureClientInit();
    setState({ ...state, profile: { ...state.profile, name } });
  },

  setLook(look: AvatarLook): void {
    ensureClientInit();
    setState({ ...state, profile: { ...state.profile, look: { ...look } } });
  },

  setSub(tier: SubTier): void {
    ensureClientInit();
    setState({ ...state, sub: tier });
  },

  addConnection(c: Omit<Connection, "ts">): void {
    ensureClientInit();
    // Dedupe by startupId when present, otherwise by name among
    // connections that also lack a startupId. Re-connecting refreshes ts.
    const isSame = (x: Connection): boolean =>
      c.startupId !== undefined
        ? x.startupId === c.startupId
        : x.startupId === undefined && x.name === c.name;
    const kept = state.connections.filter((x) => !isSame(x));
    // ts doubles as the removal key, so keep it unique even when two
    // connections land in the same millisecond.
    const maxExisting = kept.reduce((m, x) => Math.max(m, x.ts), 0);
    const ts = Math.max(Date.now(), maxExisting + 1);
    setState({ ...state, connections: [{ ...c, ts }, ...kept] });
  },

  removeConnection(ts: number): void {
    ensureClientInit();
    setState({
      ...state,
      connections: state.connections.filter((x) => x.ts !== ts),
    });
  },

  saveMyStartup(s: Startup): void {
    ensureClientInit();
    setState({
      ...state,
      myStartup: {
        ...s,
        goalProgress: clamp01(s.goalProgress),
        verifiedRevenue: Math.max(0, numOr(s.verifiedRevenue, 0)),
      },
    });
  },

  clearMyStartup(): void {
    ensureClientInit();
    const { myStartup: _dropped, ...rest } = state;
    // A startup that no longer exists can't hold stands anywhere.
    setState({ ...rest, claims: {} });
  },

  verifyMyRevenue(monthly: number, goalProgress: number): void {
    ensureClientInit();
    const current = state.myStartup;
    if (!current) return; // no-op without a startup to verify
    setState({
      ...state,
      myStartup: {
        ...current,
        verifiedRevenue: Math.max(0, numOr(monthly, 0)),
        goalProgress: clamp01(goalProgress),
      },
    });
  },

  claimSpot(floorId: string, spotIndex: number): void {
    ensureClientInit();
    if (!state.myStartup) return; // nothing to put on the stand
    const idx = Math.trunc(numOr(spotIndex, -1));
    if (idx < 0) return;
    setState({ ...state, claims: { ...state.claims, [floorId]: idx } });
  },

  unclaimSpot(floorId: string): void {
    ensureClientInit();
    if (state.claims[floorId] === undefined) return;
    const claims = { ...state.claims };
    delete claims[floorId];
    setState({ ...state, claims });
  },
};

// ---------- hook ----------

/**
 * [state, actions] for the local player. Safe to call from any number of
 * components at once — all instances share one store and re-render together.
 */
export function useAppState(): [AppState, StoreActions] {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [snapshot, ACTIONS];
}

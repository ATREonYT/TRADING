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
  OnboardingStep,
  Startup,
  SubTier,
} from "@/lib/types";
import { ONBOARDING_STEPS } from "@/lib/types";
import { FLOORS } from "@/lib/data/floors";
import { getLastSyncTs, pullState, pushState, setLastSyncTs, syncableState } from "@/lib/sync";

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
  /** Set the status line under your name (trimmed, <= 40 chars; empty clears it). */
  setStatus(s: string): void;
  /** Attach a personal note to a connection by its ts key (trimmed, <= 200; empty clears). */
  setConnectionNote(ts: number, note: string): void;
  /** Mark a tutorial step done. Appends once; unknown steps are ignored. */
  completeOnboarding(step: OnboardingStep): void;
  /** Award a badge id (<= 32 chars). Appends once; duplicates are ignored. */
  grantBadge(id: string): void;
  /** Finish (or skip) the guided tour. */
  setTutorialDone(done: boolean): void;
  /** Quest deeds — each appends once / increments and is otherwise a no-op. */
  recordTalkedTo(id: string): void;
  recordSigned(key: string): void;
  recordFloorVisit(floorId: string): void;
  recordEmote(): void;
  /** Mark a quest's reward as granted so it never re-fires. */
  markQuestClaimed(id: string): void;
  /**
   * Count a visit: called on lobby/floor mount. Within 30 minutes of the
   * last call it only refreshes lastSeenAt (same session); after a longer
   * gap it rolls prevSeenAt forward (the "since you were away" mark) and
   * updates the day streak — consecutive calendar days extend it, a gap
   * resets it to 1.
   */
  recordVisit(): void;
  /** Pick an earned title (<= 24 chars; empty clears). Shown on your hover card. */
  setTitle(t: string): void;
  /**
   * Switch to a server-issued identity (sign-in) or back to a fresh guest id
   * (sign-out). Keeps look/status/title and all local progress; the social
   * graph on the server is keyed by the id, so it follows the account.
   */
  setIdentity(id: string, name: string): void;
}

// ---------- defaults ----------

function defaultState(): AppState {
  return {
    profile: { id: "", name: "", look: { skin: 0, outfit: 0, hair: 0 } },
    sub: "free",
    connections: [],
    claims: {},
    onboarding: [],
    tutorialDone: false,
    badges: [],
    quest: { talkedTo: [], signed: [], floors: [], emotes: 0 },
    claimedQuests: [],
    visitStreak: 0,
    bestStreak: 0,
    lastSeenAt: 0,
    prevSeenAt: 0,
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
  scheduleSyncPush();
}

// ---------- cross-device sync ----------

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let lastPushedJson = "";

/** Debounced push of syncable state to the floor server (no-op offline). */
function scheduleSyncPush(): void {
  if (typeof window === "undefined" || !hydrated) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    const me = state.profile.id;
    if (!me || state.profile.name === "") return; // nothing worth syncing yet
    const blob = syncableState(state);
    const json = JSON.stringify(blob);
    if (json === lastPushedJson) return;
    void pushState(me, blob).then((savedAt) => {
      if (savedAt !== null) {
        lastPushedJson = json;
        setLastSyncTs(savedAt);
      }
    });
  }, 2500);
}

/**
 * Apply a pulled blob when it's newer than this device's last sync point.
 * The blob goes through sanitize() — the same defensive gate as
 * localStorage — and never touches the local identity or seen-marks.
 */
function applyRemoteState(remote: { state: unknown; savedAt: number }): boolean {
  if (!remote.state || typeof remote.state !== "object") return false;
  if (remote.savedAt <= getLastSyncTs()) return false;
  const merged = sanitize(remote.state);
  merged.profile.id = state.profile.id;
  if (merged.profile.name === "") merged.profile.name = state.profile.name;
  merged.lastSeenAt = state.lastSeenAt;
  merged.prevSeenAt = state.prevSeenAt;
  state = merged;
  persist();
  emit();
  lastPushedJson = JSON.stringify(syncableState(state));
  setLastSyncTs(remote.savedAt);
  return true;
}

/**
 * Pull-and-apply for the current identity, then push if the server had
 * nothing newer. Called on load and after sign-in; safe to call anytime.
 */
export function syncNow(): void {
  if (typeof window === "undefined") return;
  ensureClientInit();
  const me = state.profile.id;
  if (!me || state.profile.name === "") return;
  void pullState(me).then((remote) => {
    if (remote && remote.state && applyRemoteState(remote)) return;
    scheduleSyncPush();
  });
}

// ---------- id + parsing helpers ----------

/** Fresh guest profile id (used by sign-out to leave the account identity). */
export function makeGuestId(): string {
  return makeId();
}

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

/** Tiny data-URL PNG for a custom booth logo (uploads downscale to 16x16). */
export function isValidLogo(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("data:image/png;base64,") && v.length <= 8000;
}

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
    if (typeof pr.status === "string") {
      const status = pr.status.trim().slice(0, 40);
      if (status) base.profile.status = status;
    }
    if (typeof pr.title === "string") {
      const title = pr.title.trim().slice(0, 24);
      if (title) base.profile.title = title;
    }
  }

  if (r.sub === "free" || r.sub === "pro" || r.sub === "founder") {
    base.sub = r.sub;
  }

  if (Array.isArray(r.connections)) {
    base.connections = r.connections.filter(looksLikeConnection).map((c) => {
      const out: Connection = { name: c.name, ts: c.ts, floorId: c.floorId };
      if (typeof c.startupId === "string") out.startupId = c.startupId;
      if (typeof c.founder === "string") out.founder = c.founder;
      if (typeof c.peerId === "string") {
        const peerId = c.peerId.trim().slice(0, 64);
        if (peerId) out.peerId = peerId;
      }
      const note = typeof c.note === "string" ? c.note.trim().slice(0, 200) : "";
      if (note) out.note = note;
      return out;
    });
  }

  if (looksLikeStartup(r.myStartup)) {
    const s = r.myStartup;
    base.myStartup = {
      ...s,
      booth: {
        ...s.booth,
        sign: s.booth.sign.slice(0, 12),
        logo: isValidLogo((s.booth as { logo?: unknown }).logo)
          ? (s.booth as { logo?: string }).logo
          : undefined,
      },
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

  // Older localStorage snapshots predate onboarding/badges — the defaults
  // above already leave them as empty arrays, so hydration stays clean.
  if (Array.isArray(r.onboarding)) {
    const steps = new Set<OnboardingStep>();
    for (const v of r.onboarding) {
      if (typeof v === "string" && (ONBOARDING_STEPS as readonly string[]).includes(v)) {
        steps.add(v as OnboardingStep);
      }
    }
    base.onboarding = Array.from(steps);
  }

  if (Array.isArray(r.badges)) {
    const ids = new Set<string>();
    for (const v of r.badges) {
      if (typeof v !== "string") continue;
      const id = v.trim();
      if (id && id.length <= 32) ids.add(id);
      if (ids.size >= 20) break;
    }
    base.badges = Array.from(ids);
  }

  base.tutorialDone = r.tutorialDone === true;

  const strList = (v: unknown, maxLen: number, cap: number): string[] => {
    if (!Array.isArray(v)) return [];
    const out = new Set<string>();
    for (const x of v) {
      if (typeof x === "string" && x && x.length <= maxLen) out.add(x);
      if (out.size >= cap) break;
    }
    return Array.from(out);
  };

  if (r.quest && typeof r.quest === "object") {
    const q = r.quest as Record<string, unknown>;
    base.quest = {
      talkedTo: strList(q.talkedTo, 64, 200),
      signed: strList(q.signed, 64, 200),
      floors: strList(q.floors, 64, 32),
      emotes: Math.min(100_000, Math.max(0, Math.trunc(numOr(q.emotes, 0)))),
    };
  }

  base.claimedQuests = strList(r.claimedQuests, 32, 50);

  if (typeof r.lastVisitDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.lastVisitDay)) {
    base.lastVisitDay = r.lastVisitDay;
  }
  base.visitStreak = Math.min(10_000, Math.max(0, Math.trunc(numOr(r.visitStreak, 0))));
  base.bestStreak = Math.max(
    base.visitStreak,
    Math.min(10_000, Math.max(0, Math.trunc(numOr(r.bestStreak, 0)))),
  );
  base.lastSeenAt = Math.max(0, numOr(r.lastSeenAt, 0));
  base.prevSeenAt = Math.max(0, numOr(r.prevSeenAt, 0));

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

  // Pull any newer cross-device state once per load (async; the UI renders
  // from localStorage first and updates if the server has something fresher).
  setTimeout(() => syncNow(), 0);

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
    // Dedupe by peerId when present (names collide between live people),
    // then by startupId, otherwise by name among connections that also lack
    // both ids. Re-connecting refreshes ts.
    const isSame = (x: Connection): boolean =>
      c.peerId !== undefined
        ? x.peerId === c.peerId
        : c.startupId !== undefined
          ? x.startupId === c.startupId
          : x.startupId === undefined && x.peerId === undefined && x.name === c.name;
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

  setStatus(s: string): void {
    ensureClientInit();
    const status = s.trim().slice(0, 40);
    if (status === (state.profile.status ?? "")) return; // no-op, skip a write
    const profile = { ...state.profile };
    if (status) profile.status = status;
    else delete profile.status;
    setState({ ...state, profile });
  },

  setConnectionNote(ts: number, note: string): void {
    ensureClientInit();
    if (!state.connections.some((c) => c.ts === ts)) return;
    const trimmed = note.trim().slice(0, 200);
    const connections = state.connections.map((c) => {
      if (c.ts !== ts) return c;
      if (!trimmed) {
        const { note: _dropped, ...rest } = c;
        return rest;
      }
      return { ...c, note: trimmed };
    });
    setState({ ...state, connections });
  },

  completeOnboarding(step: OnboardingStep): void {
    ensureClientInit();
    // Validate at runtime too — steps can arrive from loosely-typed callers.
    if (!ONBOARDING_STEPS.includes(step)) return;
    if (state.onboarding.includes(step)) return;
    setState({ ...state, onboarding: [...state.onboarding, step] });
  },

  grantBadge(id: string): void {
    ensureClientInit();
    const badge = id.trim();
    if (!badge || badge.length > 32) return;
    if (state.badges.includes(badge)) return;
    if (state.badges.length >= 20) return; // matches the sanitize() cap
    setState({ ...state, badges: [...state.badges, badge] });
  },

  setTutorialDone(done: boolean): void {
    ensureClientInit();
    if (state.tutorialDone === done) return;
    setState({ ...state, tutorialDone: done });
  },

  recordTalkedTo(id: string): void {
    ensureClientInit();
    const key = id.trim().slice(0, 64);
    if (!key || state.quest.talkedTo.includes(key) || state.quest.talkedTo.length >= 200) return;
    setState({ ...state, quest: { ...state.quest, talkedTo: [...state.quest.talkedTo, key] } });
  },

  recordSigned(key: string): void {
    ensureClientInit();
    const k = key.trim().slice(0, 64);
    if (!k || state.quest.signed.includes(k) || state.quest.signed.length >= 200) return;
    setState({ ...state, quest: { ...state.quest, signed: [...state.quest.signed, k] } });
  },

  recordFloorVisit(floorId: string): void {
    ensureClientInit();
    const f = floorId.trim().slice(0, 64);
    if (!f || state.quest.floors.includes(f) || state.quest.floors.length >= 32) return;
    setState({ ...state, quest: { ...state.quest, floors: [...state.quest.floors, f] } });
  },

  recordEmote(): void {
    ensureClientInit();
    if (state.quest.emotes >= 100_000) return;
    setState({ ...state, quest: { ...state.quest, emotes: state.quest.emotes + 1 } });
  },

  markQuestClaimed(id: string): void {
    ensureClientInit();
    const q = id.trim().slice(0, 32);
    if (!q || state.claimedQuests.includes(q) || state.claimedQuests.length >= 50) return;
    setState({ ...state, claimedQuests: [...state.claimedQuests, q] });
  },

  recordVisit(): void {
    ensureClientInit();
    const now = Date.now();
    const sameSession = state.lastSeenAt > 0 && now - state.lastSeenAt < 30 * 60_000;
    // local calendar day, so "come back tomorrow" means the user's tomorrow
    const dayOf = (ms: number): string => {
      const d = new Date(ms);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const today = dayOf(now);
    let { visitStreak, bestStreak, lastVisitDay } = state;
    if (lastVisitDay !== today) {
      const yesterday = dayOf(now - 24 * 60 * 60 * 1000);
      visitStreak = lastVisitDay === yesterday ? visitStreak + 1 : 1;
      bestStreak = Math.max(bestStreak, visitStreak);
      lastVisitDay = today;
    }
    setState({
      ...state,
      visitStreak,
      bestStreak,
      lastVisitDay,
      // a real gap rolls the away-mark forward; same-session visits keep it,
      // so the digest still describes "since you last sat down"
      prevSeenAt: sameSession ? state.prevSeenAt : state.lastSeenAt,
      lastSeenAt: now,
    });
  },

  setTitle(t: string): void {
    ensureClientInit();
    const title = t.trim().slice(0, 24);
    if (title === (state.profile.title ?? "")) return;
    const profile = { ...state.profile };
    if (title) profile.title = title;
    else delete profile.title;
    setState({ ...state, profile });
  },

  setIdentity(id: string, name: string): void {
    ensureClientInit();
    const nextId = id.trim().slice(0, 64) || makeId();
    const nextName = name.trim().slice(0, 24) || state.profile.name;
    if (nextId === state.profile.id && nextName === state.profile.name) return;
    setState({ ...state, profile: { ...state.profile, id: nextId, name: nextName } });
    // Signing in on a second device pulls the account's progress down;
    // a fresh account uploads this device's progress instead.
    setLastSyncTs(0);
    lastPushedJson = "";
    syncNow();
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

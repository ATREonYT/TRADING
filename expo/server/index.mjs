/**
 * FounderFloor — standalone floor server: one port, HTTP + WebSocket.
 *
 * WebSocket rooms are keyed by floor id taken from the connection URL:
 *   ws://host:3001/ws?floor=<id>
 *
 * HTTP routes (JSON, CORS "Access-Control-Allow-Origin: *", 200/404 only):
 *   GET /presence                     -> { floors: { [floorId]: liveCount } }
 *   GET /guestbook?floor=ID&key=KEY   -> { entries: GuestbookEntry[] } (newest first, <= 50)
 *   anything else                     -> 404 text (plain HTTP GET on /ws included)
 *
 * WS protocol (JSON text frames) mirrors NetEvent in lib/types.ts:
 *   client -> server:
 *     { t: "join", player: { id, name, look, status? }, s: MoveState, claim? }  (first frame)
 *     { t: "move", s: MoveState }
 *     { t: "chat", text, scope: "floor" | "dm", peerId? }
 *     { t: "booth_set", claim: { spotIndex, startup } }
 *     { t: "booth_clear" }
 *     { t: "emote", kind }             (one of the five EmoteKinds; 3/s per client)
 *     { t: "sign", key, text, boothName? } (guestbook entry; key <= 64, text <= 200,
 *                                      boothName <= 40 — display name for the ticker line)
 *     { t: "report", targetId, reason } (stored in floor-data.json for the operator; 1/10s)
 *   server -> client:
 *     { t: "welcome", selfId, players, booths, activity }   (activity oldest first;
 *                                      booths = persistent stands with ownerName + online)
 *     { t: "player_join", player: RemotePlayer }
 *     { t: "player_move", id, s: MoveState }
 *     { t: "player_leave", id }        (their stand STAYS, re-announced online:false)
 *     { t: "booth_set", ownerId, ownerName, online, claim }  (ownerId = stable profile id)
 *     { t: "booth_clear", ownerId }
 *
 * Stands persist across owner absence (floor-data.json) and expire after 7
 * days without a visit. A join without a claim from a profile that has a
 * stored stand removes it — the client's saved state is the source of truth.
 *     { t: "booth_denied", spotIndex }  (only to a claimant whose spot was taken)
 *     { t: "emote", id, kind }          (echoed to the sender too)
 *     { t: "guestbook", key, entry }    (a new entry landed at a booth)
 *     { t: "activity", item }           (one new ticker line)
 *     { t: "chat", msg: ChatMsg }
 *     { t: "status", online: true, count }
 *
 * Guestbooks and the activity ticker persist to server/floor-data.json
 * (debounced 2s, atomic tmp+rename; a corrupt file yields one warning and an
 * empty start). Everything else is in-memory only.
 *
 * Run with: node server/index.mjs   (PORT_WS overrides the port, default 3001)
 */

import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { closeSync, copyFileSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT_WS || 3001);

const MAX_NAME_LEN = 24;
const MAX_TEXT_LEN = 500;
const MAX_ID_LEN = 64;
const MAX_KEY_LEN = 64; // guestbook key: startup id or "spot:<n>"
const MAX_SIGN_LEN = 200; // guestbook entry text
const MAX_STATUS_LEN = 40; // profile status line
const MOVES_PER_SEC = 20; // moves beyond this per client per second are dropped
const EMOTES_PER_SEC = 3; // emotes beyond this per client per second are dropped
const SIGNS_PER_SEC = 2; // guestbook signs beyond this per client per second are dropped
const CHATS_PER_SEC = 5; // chat frames beyond this per client per second are dropped
const FRAMES_PER_SEC = 40; // total ws frames per client per second, all types
const BOOTH_SETS_PER_10S = 4; // claim + denial rollback fit; scripted spam doesn't
const GUESTBOOK_KEEP = 50; // entries per guestbook, newest first
const ACTIVITY_KEEP = 20; // ticker items per floor, oldest first
const MAX_KEYS_PER_FLOOR = 128; // distinct guestbook keys per floor
const MAX_FLOORS_TRACKED = 64; // floors with stored guestbooks / activity
const MAX_BOOTH_NAME_LEN = 40; // booth name embedded in a sign ticker line
const WALK_IN_SUPPRESS_MS = 10 * 60_000; // one "walked in" per name per window
const SAVE_DEBOUNCE_MS = 2000;
const HEARTBEAT_MS = 30_000;
const OPEN = 1; // WebSocket.OPEN

const DIRS = new Set(["up", "down", "left", "right"]);
const EMOTE_KINDS = new Set([
  "wave", "laugh", "clap", "heart", "question",
  // quest-reward emotes (unlocks are client-side; the wire accepts all eight)
  "rocket", "fire", "handshake",
]);

const DATA_FILE = join(dirname(fileURLToPath(import.meta.url)), "floor-data.json");

/**
 * rooms: floorId -> Map<playerId, client>
 * client: { ws, id, name, look, s, status, claim }
 * (id/name/look/s/status form the RemotePlayer)
 */
const rooms = new Map();

/** guestbooks: floorId -> Map<key, GuestbookEntry[]> — entries newest first, <= 50. */
const guestbooks = new Map();

/**
 * stands: floorId -> Map<profileId, { claim, ownerName, lastSeen }> — claimed
 * booths persist while their owner is away (shown as "away" stands) and expire
 * after STAND_TTL_MS without a visit. Keyed by the STABLE profile id (rawId),
 * not the per-connection wire id, so reconnects and second tabs re-own them.
 */
const stands = new Map();
const STAND_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_STANDS_PER_FLOOR = 64;

/**
 * profileStates: profileId -> { state, savedAt } — the client's app state
 * (booth, badges, quests, streaks, membership...) so progress follows an
 * identity across devices. The server treats the blob as semi-opaque: it
 * enforces identity, size, and a top-level key allowlist; the CLIENT runs
 * its own defensive sanitize() when applying (the same one that guards
 * localStorage), so a hostile blob can't do more here than there.
 */
const profileStates = new Map();
const MAX_PROFILE_STATES = 5000;
const MAX_STATE_BYTES = 24 * 1024;
const PROFILE_STATE_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const STATE_KEYS = new Set([
  "profile", "sub", "connections", "myStartup", "claims", "onboarding",
  "tutorialDone", "badges", "quest", "claimedQuests", "lastVisitDay",
  "visitStreak", "bestStreak",
]);

/**
 * registry: profileId -> { startup, ts } — startups registered the moment
 * they're created in the profile editor, before (or without) a floor stand.
 * The directory lists them as "no stand yet" and their categories join the
 * filter chips; a claimed stand supersedes its owner's registry entry.
 */
const registry = new Map();
const MAX_REGISTRY = 2000;
const REGISTRY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** reports: flat list for the operator to review by hand, cap 500. */
let reports = [];
const MAX_REPORTS = 500;

/** feedback: beta notes from users ("this broke", "build this"), cap 500. */
let feedback = [];
const MAX_FEEDBACK = 500;

/**
 * accounts: nameLower -> { id: "acct_<uuid>", name, salt, hash } (scrypt).
 * tokens: token -> account id (bearer sessions, persisted; logout deletes).
 * Account ids are server-issued and enforced: a ws join or social POST that
 * claims an "acct_" id must present a matching token, or it's treated as a
 * guest. Guest ids (plain browser uuids) keep working with no auth at all —
 * accounts are opt-in security, not a wall.
 */
const accounts = new Map();
const tokens = new Map();
const MAX_ACCOUNTS = 5000;
const ACCT_PREFIX = "acct_";

// Cost params are stored per account so they can be raised later without
// breaking existing logins (older accounts keep the params they were hashed with).
const SCRYPT = { N: 16384, r: 8, p: 1 };

function hashPassword(password, salt, kdf = SCRYPT) {
  return scryptSync(password, salt, 32, { N: kdf.N, r: kdf.r, p: kdf.p, maxmem: 64 * 1024 * 1024 });
}

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, refreshed on use

function verifyToken(token, profileId) {
  if (typeof token !== "string" || !token) return false;
  const entry = tokens.get(token);
  if (!entry || entry.id !== profileId) return false;
  if (Date.now() - entry.ts > TOKEN_TTL_MS) {
    tokens.delete(token);
    scheduleSave();
    return false;
  }
  entry.ts = Date.now();
  return true;
}

/**
 * guestSecrets: profileId -> { secret, ts } — a browser-held secret that binds
 * a guest id to whoever used it first. Guest ids travel to peers (booth_set
 * ownerId, calling cards, DM envelopes), so without this anyone who saw your
 * id could read your inbox or repossess your stand. First use binds; every
 * later join / social call must present the same secret. Accounts (acct_*)
 * use bearer tokens instead and never touch this map.
 */
const guestSecrets = new Map();
const MAX_GUEST_SECRETS = 20000;
const GUEST_SECRET_TTL_MS = 90 * 24 * 60 * 60 * 1000; // idle guests age out

/**
 * One identity gate for every claimed profile id.
 * acct_ ids: token must back them. Guest ids: first caller with a secret
 * binds it; a bound id then requires the matching secret. A bound id with a
 * missing/wrong secret is an impersonation attempt.
 */
function verifyIdentity(profileId, token, gs) {
  if (typeof profileId !== "string" || !profileId) return false;
  if (profileId.startsWith(ACCT_PREFIX)) return verifyToken(token, profileId);
  const supplied = typeof gs === "string" && gs.length >= 16 && gs.length <= 64 ? gs : null;
  const bound = guestSecrets.get(profileId);
  if (!bound) {
    if (supplied && guestSecrets.size < MAX_GUEST_SECRETS) {
      guestSecrets.set(profileId, { secret: supplied, ts: Date.now() });
      scheduleSave();
    }
    return true; // unbound guest — first use binds (or legacy client, no secret)
  }
  if (!supplied) return false;
  const a = Buffer.from(bound.secret);
  const b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  bound.ts = Date.now();
  return true;
}

/**
 * social: profileId -> { name, requests: ConnectRequest[], outgoing: string[],
 * connections: SocialConnection[] } — the mutual-connection graph.
 * dms: pairKey ("idA|idB", sorted) -> DmMessage[] (oldest first, capped).
 * Both persist to floor-data.json. No auth in this demo: profile ids are
 * client-claimed, so this is a courtesy layer, not a security boundary.
 */
const social = new Map();
const dms = new Map();
const MAX_REQUESTS_PER_USER = 20;
const MAX_CONNECTIONS_PER_USER = 200;
const MAX_DM_PER_THREAD = 100;
const MAX_SOCIAL_USERS = 2000;

/** All live sockets per profile id (across every floor) — for social pushes. */
const socketsByProfile = new Map();

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function socialFor(profileId) {
  let s = social.get(profileId);
  if (!s) {
    if (social.size >= MAX_SOCIAL_USERS) return null;
    s = { name: "", requests: [], outgoing: [], connections: [] };
    social.set(profileId, s);
  }
  return s;
}

function pushToProfile(profileId, ev) {
  const socks = socketsByProfile.get(profileId);
  if (!socks) return;
  const frame = JSON.stringify(ev);
  for (const sock of socks) {
    if (sock.readyState === OPEN) sock.send(frame);
  }
}

/** activity: floorId -> ActivityItem[] — oldest first, <= 20. */
const activity = new Map();

/**
 * Server-assigned, incrementing ChatMsg id, namespaced per boot: clients keep
 * their transcripts across the reconnect window, so a restarted server must
 * never reissue ids that collide with pre-restart messages.
 */
const BOOT = Date.now().toString(36);
let nextMsgId = 1;

/**
 * lastWalkIn: floorId -> Map<name, ts> — suppresses repeat "walked in" ticker
 * lines from flaky connections. Entries older than the window are pruned on
 * every join, so the maps stay small.
 */
const lastWalkIn = new Map();

/** Monotonic ActivityItem id counter; resumed from disk at boot. */
let nextActivityId = 1;

// ---------- persistence (guestbooks + activity) ----------

function loadData() {
  let raw;
  try {
    raw = readFileSync(DATA_FILE, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(`[data] could not read floor-data.json (${err.message}) — starting empty`);
    }
    return; // no file yet — first boot
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("not an object");
  } catch {
    // Move the bad file aside instead of leaving it to be overwritten by the
    // next save — a truncated write must stay recoverable by hand.
    const aside = `${DATA_FILE}.corrupt-${Date.now()}`;
    try {
      renameSync(DATA_FILE, aside);
      console.warn(`[data] floor-data.json is corrupt — moved aside to ${aside}, starting empty`);
    } catch {
      console.warn("[data] floor-data.json is corrupt and could not be moved aside — starting empty");
    }
    return;
  }

  const isEntry = (e) =>
    e && typeof e === "object" && typeof e.from === "string" && typeof e.text === "string" && typeof e.ts === "number";
  const isItem = (it) =>
    it && typeof it === "object" && typeof it.id === "string" && typeof it.text === "string" && typeof it.ts === "number";

  if (parsed.guestbooks && typeof parsed.guestbooks === "object") {
    for (const [floorId, books] of Object.entries(parsed.guestbooks)) {
      if (!books || typeof books !== "object") continue;
      const map = new Map();
      for (const [key, entries] of Object.entries(books)) {
        if (!Array.isArray(entries)) continue;
        const clean = entries
          .filter(isEntry)
          .slice(0, GUESTBOOK_KEEP)
          .map((e) => ({ from: e.from.slice(0, MAX_NAME_LEN), text: e.text.slice(0, MAX_SIGN_LEN), ts: e.ts }));
        if (clean.length) map.set(key.slice(0, MAX_KEY_LEN), clean);
      }
      if (map.size) guestbooks.set(floorId.slice(0, MAX_ID_LEN), map);
    }
  }

  if (parsed.stands && typeof parsed.stands === "object") {
    const cutoff = Date.now() - STAND_TTL_MS;
    for (const [floorId, byOwner] of Object.entries(parsed.stands)) {
      if (!byOwner || typeof byOwner !== "object") continue;
      const map = new Map();
      for (const [ownerId, st] of Object.entries(byOwner)) {
        if (!st || typeof st !== "object" || typeof st.lastSeen !== "number") continue;
        if (st.lastSeen < cutoff) continue; // expired while the server was down
        const claim = sanitizeClaim(st.claim);
        if (!claim) continue;
        map.set(ownerId.slice(0, MAX_ID_LEN), {
          claim,
          ownerName: typeof st.ownerName === "string" ? st.ownerName.slice(0, MAX_NAME_LEN) : "founder",
          lastSeen: st.lastSeen,
        });
      }
      if (map.size) stands.set(floorId.slice(0, MAX_ID_LEN), map);
    }
  }

  if (parsed.accounts && typeof parsed.accounts === "object") {
    for (const [nameLower, a] of Object.entries(parsed.accounts)) {
      if (!a || typeof a !== "object" || accounts.size >= MAX_ACCOUNTS) continue;
      if (typeof a.id !== "string" || typeof a.name !== "string" || typeof a.salt !== "string" || typeof a.hash !== "string") continue;
      const kdf =
        a.kdf && Number.isInteger(a.kdf.N) && Number.isInteger(a.kdf.r) && Number.isInteger(a.kdf.p)
          ? { N: a.kdf.N, r: a.kdf.r, p: a.kdf.p }
          : { ...SCRYPT };
      accounts.set(nameLower.slice(0, MAX_NAME_LEN), { id: a.id, name: a.name, salt: a.salt, hash: a.hash, kdf });
    }
  }
  if (parsed.tokens && typeof parsed.tokens === "object") {
    const cutoff = Date.now() - TOKEN_TTL_MS;
    for (const [tok, v] of Object.entries(parsed.tokens)) {
      if (tok.length !== 64) continue;
      // current format { id, ts }; pre-TTL files stored a bare id string
      if (v && typeof v === "object" && typeof v.id === "string" && typeof v.ts === "number") {
        if (v.ts > cutoff) tokens.set(tok, { id: v.id, ts: v.ts });
      } else if (typeof v === "string") {
        tokens.set(tok, { id: v, ts: Date.now() });
      }
    }
  }

  if (parsed.registry && typeof parsed.registry === "object") {
    const cutoff = Date.now() - REGISTRY_TTL_MS;
    for (const [pid, v] of Object.entries(parsed.registry)) {
      if (registry.size >= MAX_REGISTRY) break;
      if (!v || typeof v !== "object" || typeof v.ts !== "number" || v.ts <= cutoff) continue;
      const startup = sanitizeStartup(v.startup);
      if (startup) registry.set(pid.slice(0, MAX_ID_LEN), { startup, ts: v.ts });
    }
  }

  if (parsed.profileStates && typeof parsed.profileStates === "object") {
    const cutoff = Date.now() - PROFILE_STATE_TTL_MS;
    for (const [pid, v] of Object.entries(parsed.profileStates)) {
      if (profileStates.size >= MAX_PROFILE_STATES) break;
      if (!v || typeof v !== "object" || typeof v.savedAt !== "number" || v.savedAt <= cutoff) continue;
      const state = sanitizeStateBlob(v.state);
      if (state) profileStates.set(pid.slice(0, MAX_ID_LEN), { state, savedAt: v.savedAt });
    }
  }

  if (parsed.guestSecrets && typeof parsed.guestSecrets === "object") {
    const cutoff = Date.now() - GUEST_SECRET_TTL_MS;
    for (const [pid, v] of Object.entries(parsed.guestSecrets)) {
      if (guestSecrets.size >= MAX_GUEST_SECRETS) break;
      if (v && typeof v === "object" && typeof v.secret === "string" && typeof v.ts === "number" && v.ts > cutoff) {
        guestSecrets.set(pid.slice(0, MAX_ID_LEN), { secret: v.secret.slice(0, 64), ts: v.ts });
      }
    }
  }

  if (parsed.social && typeof parsed.social === "object") {
    for (const [pid, s] of Object.entries(parsed.social)) {
      if (!s || typeof s !== "object" || social.size >= MAX_SOCIAL_USERS) continue;
      social.set(pid.slice(0, MAX_ID_LEN), {
        name: typeof s.name === "string" ? s.name.slice(0, MAX_NAME_LEN) : "",
        requests: Array.isArray(s.requests) ? s.requests.slice(0, MAX_REQUESTS_PER_USER) : [],
        outgoing: Array.isArray(s.outgoing) ? s.outgoing.filter((x) => typeof x === "string").slice(0, 50) : [],
        connections: Array.isArray(s.connections) ? s.connections.slice(0, MAX_CONNECTIONS_PER_USER) : [],
      });
    }
  }

  if (parsed.dms && typeof parsed.dms === "object") {
    for (const [key, msgs] of Object.entries(parsed.dms)) {
      if (!Array.isArray(msgs)) continue;
      const clean = msgs
        .filter((m) => m && typeof m === "object" && typeof m.fromId === "string" && typeof m.text === "string" && typeof m.ts === "number")
        .slice(-MAX_DM_PER_THREAD);
      if (clean.length) dms.set(key.slice(0, 2 * MAX_ID_LEN + 1), clean);
    }
  }

  if (Array.isArray(parsed.reports)) {
    reports = parsed.reports
      .filter((r) => r && typeof r === "object" && typeof r.ts === "number")
      .slice(-MAX_REPORTS);
  }

  if (Array.isArray(parsed.feedback)) {
    feedback = parsed.feedback
      .filter((f) => f && typeof f === "object" && typeof f.ts === "number" && typeof f.text === "string")
      .slice(-MAX_FEEDBACK);
  }

  if (parsed.activity && typeof parsed.activity === "object") {
    for (const [floorId, items] of Object.entries(parsed.activity)) {
      if (!Array.isArray(items)) continue;
      const clean = items
        .filter(isItem)
        .slice(-ACTIVITY_KEEP)
        .map((it) => ({ id: it.id, text: it.text, ts: it.ts }));
      if (clean.length) activity.set(floorId.slice(0, MAX_ID_LEN), clean);
      // Resume the id counter past everything already on disk so ids stay
      // monotonic across restarts.
      for (const it of clean) {
        const m = /^a(\d+)$/.exec(it.id);
        if (m) nextActivityId = Math.max(nextActivityId, Number(m[1]) + 1);
      }
    }
  }
}

let saveTimer = null;

/** Coalesce writes: the first change schedules one save 2s out; later changes ride along. */
function scheduleSave() {
  if (saveTimer !== null) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveNow();
  }, SAVE_DEBOUNCE_MS);
}

function saveNow() {
  const data = {
    guestbooks: Object.fromEntries(
      [...guestbooks].map(([floorId, books]) => [floorId, Object.fromEntries(books)]),
    ),
    activity: Object.fromEntries(activity),
    stands: Object.fromEntries(
      [...stands].map(([floorId, byOwner]) => [floorId, Object.fromEntries(byOwner)]),
    ),
    reports,
    feedback,
    social: Object.fromEntries(social),
    dms: Object.fromEntries(dms),
    accounts: Object.fromEntries(accounts),
    tokens: Object.fromEntries(tokens),
    guestSecrets: Object.fromEntries(guestSecrets),
    registry: Object.fromEntries(registry),
    profileStates: Object.fromEntries(profileStates),
  };
  const tmp = `${DATA_FILE}.tmp`;
  try {
    // Atomic on POSIX: readers only ever see the old or the new full file.
    // fsync before rename, or a power loss can leave the rename pointing at
    // an unflushed (empty) file on some filesystems.
    const fd = openSync(tmp, "w");
    try {
      writeSync(fd, JSON.stringify(data));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    rotateBackup();
    renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.warn(`[data] persist failed: ${err.message}`);
  }
}

/**
 * Once per calendar day, keep a copy of the current data file before the
 * first overwrite (floor-data.backup-N.json, newest first, keep 3). Cheap
 * insurance: a bad deploy or bug can't silently eat everyone's stands,
 * accounts, and chats — yesterday is always on disk.
 */
let lastBackupDay = "";
function rotateBackup() {
  const day = new Date().toISOString().slice(0, 10);
  if (day === lastBackupDay) return;
  try {
    readFileSync(DATA_FILE);
  } catch {
    return; // no current file yet — try again on the next save, same day
  }
  try {
    const bak = (n) => `${DATA_FILE.replace(/\.json$/, "")}.backup-${n}.json`;
    for (let n = 2; n >= 1; n--) {
      try {
        renameSync(bak(n), bak(n + 1));
      } catch {
        // that slot didn't exist yet — fine
      }
    }
    copyFileSync(DATA_FILE, bak(1));
    lastBackupDay = day;
  } catch (err) {
    console.warn(`[data] backup rotation failed: ${err.message}`);
  }
}

function flushAndExit() {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
    saveNow(); // a pending debounce means unsaved changes — flush them
  }
  process.exit(0);
}

process.on("SIGINT", flushAndExit);
process.on("SIGTERM", flushAndExit);

// NOTE: loadData() is called below the sanitizer section — sanitizeClaim()
// reads consts (MAX_SPOT_INDEX, GLYPHS, ...) that must be initialized first.

// ---------- sanitizers ----------

function clampIndex(v, max) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : 0;
}

function sanitizeLook(look) {
  return {
    skin: clampIndex(look?.skin, 5),
    outfit: clampIndex(look?.outfit, 7),
    hair: clampIndex(look?.hair, 7),
  };
}

function sanitizeMove(s) {
  const x = Number(s?.x);
  const y = Number(s?.y);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    dir: DIRS.has(s?.dir) ? s.dir : "down",
    moving: s?.moving === true,
  };
}

// Control chars, zero-widths, and bidi overrides (U+202E and friends) enable
// display spoofing in names, chat, and the ticker — strip them everywhere.
// Newlines are preserved only where multi-line input is legit (sanitizeStr).
const CONTROL_RE = /[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

function stripControl(s) {
  return s.replace(CONTROL_RE, "");
}

function sanitizeName(name) {
  const trimmed =
    typeof name === "string" ? stripControl(name).replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LEN) : "";
  return trimmed || "guest";
}

function sanitizeText(text) {
  return typeof text === "string"
    ? stripControl(text).replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LEN)
    : "";
}

const GLYPHS = new Set(["bolt", "leaf", "coin", "chip", "flask", "rocket", "heart", "cube", "wave", "star"]);
const PATTERNS = new Set(["solid", "border", "stripes"]);
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_SPOT_INDEX = 63;

function sanitizeStr(v, max, fallback = "") {
  return typeof v === "string" ? stripControl(v).trim().slice(0, max) : fallback;
}

/**
 * Rebuild a startup object from untrusted input: only known fields survive,
 * all of them clamped. Returns null when structurally unusable. Shared by
 * stand claims (ws) and profile registrations (HTTP).
 */
function sanitizeStartup(s) {
  if (!s || typeof s !== "object") return null;
  const name = sanitizeStr(s.name, 40);
  if (!name) return null;
  const booth = s.booth && typeof s.booth === "object" ? s.booth : {};
  const goalProgress = Number(s.goalProgress);
  const verifiedRevenue = Number(s.verifiedRevenue);
  return {
      id: sanitizeStr(s.id, MAX_ID_LEN, "mine"),
      name,
      oneLiner: sanitizeStr(s.oneLiner, 80),
      pitch: sanitizeStr(s.pitch, 600),
      founder: sanitizeStr(s.founder, MAX_NAME_LEN, "founder"),
      founderLook: sanitizeLook(s.founderLook),
      category: sanitizeStr(s.category, 32),
      goal: sanitizeStr(s.goal, 80),
      goalProgress: Number.isFinite(goalProgress) ? Math.min(1, Math.max(0, goalProgress)) : 0,
      verifiedRevenue: Number.isFinite(verifiedRevenue) ? Math.max(0, verifiedRevenue) : 0,
      seekingCofounder: s.seekingCofounder === true,
      tier: s.tier === "pro" || s.tier === "founder" ? s.tier : undefined,
      booth: {
        carpet: HEX_COLOR.test(booth.carpet) ? booth.carpet : "#C2B8A3",
        banner: HEX_COLOR.test(booth.banner) ? booth.banner : "#5C5548",
        sign: sanitizeStr(booth.sign, 12) || name.slice(0, 12).toUpperCase(),
        glyph: GLYPHS.has(booth.glyph) ? booth.glyph : "star",
        pattern: PATTERNS.has(booth.pattern) ? booth.pattern : "solid",
        // custom banner icon: tiny data-URL PNG, downscaled client-side
        logo:
          typeof booth.logo === "string" &&
          booth.logo.startsWith("data:image/png;base64,") &&
          booth.logo.length <= 8000
            ? booth.logo
            : undefined,
    },
  };
}

/**
 * Keep only the allowlisted top-level keys of a synced app state and enforce
 * the size cap. Deep validation happens client-side on apply (sanitize() in
 * lib/store.ts guards this exactly like it guards localStorage).
 */
function sanitizeStateBlob(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out = {};
  for (const key of Object.keys(v)) {
    if (STATE_KEYS.has(key)) out[key] = v[key];
  }
  try {
    if (JSON.stringify(out).length > MAX_STATE_BYTES) return null;
  } catch {
    return null;
  }
  return out;
}

/**
 * Rebuild a claim from an untrusted frame. Returns null if the claim is
 * structurally unusable.
 */
function sanitizeClaim(claim) {
  if (!claim || typeof claim !== "object") return null;
  const spotIndex = Number(claim.spotIndex);
  if (!Number.isInteger(spotIndex) || spotIndex < 0 || spotIndex > MAX_SPOT_INDEX) return null;
  const startup = sanitizeStartup(claim.startup);
  if (!startup) return null;
  return { spotIndex, startup };
}

/**
 * A guestbook key is either a seed-startup id (slug-ish) or "spot:<n>" for a
 * claimed stand. Anything else is a fabricated frame and is dropped.
 */
const SPOT_KEY = /^spot:(\d{1,3})$/;
const ID_KEY = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
function isValidGuestbookKey(key) {
  const m = SPOT_KEY.exec(key);
  if (m) return Number(m[1]) <= MAX_SPOT_INDEX;
  return ID_KEY.test(key);
}

/** Is any live client in the room connected under this profile id? */
function ownerOnline(room, profileId) {
  if (!room) return false;
  for (const c of room.values()) {
    if (c.rawId === profileId) return true;
  }
  return false;
}

/** All persistent stands on a floor, excluding one profile — with liveness. */
function floorBooths(floorId, room, exceptProfileId) {
  const byOwner = stands.get(floorId);
  if (!byOwner) return [];
  const out = [];
  for (const [ownerId, st] of byOwner) {
    if (ownerId === exceptProfileId) continue;
    out.push({ ownerId, ownerName: st.ownerName, online: ownerOnline(room, ownerId), claim: st.claim });
  }
  return out;
}

/** Which profile holds this spot (live or away), excluding one profile. */
function spotTakenBy(floorId, spotIndex, exceptProfileId) {
  const byOwner = stands.get(floorId);
  if (!byOwner) return null;
  for (const [ownerId, st] of byOwner) {
    if (ownerId !== exceptProfileId && st.claim.spotIndex === spotIndex) return ownerId;
  }
  return null;
}

/** Drop stands whose owner hasn't visited in STAND_TTL_MS. Runs hourly. */
function pruneStands() {
  const cutoff = Date.now() - STAND_TTL_MS;
  for (const [floorId, byOwner] of stands) {
    const room = rooms.get(floorId);
    for (const [ownerId, st] of byOwner) {
      if (st.lastSeen < cutoff && !ownerOnline(room, ownerId)) {
        byOwner.delete(ownerId);
        if (room) broadcast(room, { t: "booth_clear", ownerId });
        scheduleSave();
      }
    }
    if (byOwner.size === 0) stands.delete(floorId);
  }
}
/** Hourly sweep: expired bearer tokens and long-idle guest secrets. */
function pruneCredentials() {
  const now = Date.now();
  let changed = false;
  for (const [tok, v] of tokens) {
    if (now - v.ts > TOKEN_TTL_MS) {
      tokens.delete(tok);
      changed = true;
    }
  }
  for (const [pid, v] of guestSecrets) {
    if (now - v.ts > GUEST_SECRET_TTL_MS) {
      guestSecrets.delete(pid);
      changed = true;
    }
  }
  for (const [pid, v] of registry) {
    if (now - v.ts > REGISTRY_TTL_MS) {
      registry.delete(pid);
      changed = true;
    }
  }
  for (const [pid, v] of profileStates) {
    if (now - v.savedAt > PROFILE_STATE_TTL_MS) {
      profileStates.delete(pid);
      changed = true;
    }
  }
  if (changed) scheduleSave();
}

setInterval(pruneStands, 60 * 60 * 1000).unref();
setInterval(pruneCredentials, 60 * 60 * 1000).unref();

loadData();

// ---------- wire helpers ----------

function send(ws, ev) {
  if (ws.readyState === OPEN) ws.send(JSON.stringify(ev));
}

function broadcast(room, ev, exceptId) {
  const frame = JSON.stringify(ev);
  for (const client of room.values()) {
    if (client.id === exceptId) continue;
    if (client.ws.readyState === OPEN) client.ws.send(frame);
  }
}

function asRemotePlayer(client) {
  return {
    id: client.id,
    name: client.name,
    look: client.look,
    s: client.s,
    // JSON.stringify drops the key when undefined — absent status stays absent.
    status: client.status || undefined,
    title: client.title || undefined,
  };
}

// ---------- activity ticker ----------

/** Append one pre-rendered ticker line for a floor, cap 20, broadcast it. */
function pushActivity(room, floorId, text) {
  const item = { id: `a${nextActivityId++}`, text, ts: Date.now() };
  let items = activity.get(floorId);
  if (!items) {
    // Cap the number of floors that persist activity — random ?floor= ids
    // must not grow memory/disk without bound. The line still broadcasts.
    if (activity.size >= MAX_FLOORS_TRACKED) {
      broadcast(room, { t: "activity", item });
      return item;
    }
    items = [];
    activity.set(floorId, items);
  }
  items.push(item);
  if (items.length > ACTIVITY_KEEP) items.splice(0, items.length - ACTIVITY_KEEP);
  broadcast(room, { t: "activity", item });
  scheduleSave();
  return item;
}

// ---------- http ----------

function sendJson(res, body) {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}

/** Read a JSON POST body, capped at 32KB; resolves null on any problem. */
function readJson(req) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > 32 * 1024) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

/** Requester calling card, rebuilt from an untrusted body. */
function sanitizeCard(card) {
  if (!card || typeof card !== "object") return null;
  const id = sanitizeStr(card.id, MAX_ID_LEN);
  const name = sanitizeStr(card.name, MAX_NAME_LEN);
  if (!id || !name) return null;
  const badges = Array.isArray(card.badges)
    ? card.badges.filter((b) => typeof b === "string").map((b) => b.slice(0, 32)).slice(0, 20)
    : [];
  const rev = Number(card.startupRevenue);
  return {
    id,
    name,
    title: sanitizeStr(card.title, 24) || undefined,
    status: sanitizeStr(card.status, MAX_STATUS_LEN) || undefined,
    badges,
    connections: Math.min(9999, Math.max(0, Math.trunc(Number(card.connections) || 0))),
    startupName: sanitizeStr(card.startupName, 40) || undefined,
    startupRevenue: Number.isFinite(rev) ? Math.max(0, rev) : undefined,
    floorsVisited: Math.min(99, Math.max(0, Math.trunc(Number(card.floorsVisited) || 0))),
  };
}

/** Resolve a target that may be a live wire id (from a DM thread) to a profile id. */
function resolveProfileId(target) {
  for (const room of rooms.values()) {
    const c = room.get(target);
    if (c) return c.rawId;
  }
  return target;
}

/** POST /auth/*: register, login, logout. Fixed-window rate limit per IP. */
const authAttempts = new Map(); // ip -> { windowStart, count }
function authRateLimited(req) {
  const ip = req.socket.remoteAddress ?? "?";
  const now = Date.now();
  let a = authAttempts.get(ip);
  if (!a || now - a.windowStart >= 60_000) {
    a = { windowStart: now, count: 0 };
    authAttempts.set(ip, a);
    if (authAttempts.size > 1000) {
      // evict expired windows only — a blanket clear() would let an attacker
      // reset everyone's counters by cycling 1000 IPs
      for (const [k, v] of authAttempts) {
        if (now - v.windowStart >= 60_000) authAttempts.delete(k);
      }
    }
  }
  return ++a.count > 10;
}

async function handleAuthPost(req, res, pathname) {
  if (authRateLimited(req)) {
    sendJson(res, { error: "slow down — try again in a minute" });
    return;
  }
  const body = await readJson(req);
  if (!body) {
    notFound(res);
    return;
  }

  if (pathname === "/auth/register") {
    const name = sanitizeStr(body.name, MAX_NAME_LEN);
    const password = typeof body.password === "string" ? body.password : "";
    if (name.length < 3) {
      sendJson(res, { error: "name needs at least 3 characters" });
      return;
    }
    if (password.length < 6) {
      sendJson(res, { error: "password needs at least 6 characters" });
      return;
    }
    const key = name.toLowerCase();
    if (accounts.has(key)) {
      sendJson(res, { error: "that name is taken" });
      return;
    }
    if (accounts.size >= MAX_ACCOUNTS) {
      sendJson(res, { error: "the hall is full — no new accounts right now" });
      return;
    }
    const salt = randomBytes(16).toString("hex");
    const acct = {
      id: `${ACCT_PREFIX}${randomUUID()}`,
      name,
      salt,
      hash: hashPassword(password, salt).toString("hex"),
      kdf: { ...SCRYPT },
    };
    accounts.set(key, acct);
    const token = randomBytes(32).toString("hex");
    tokens.set(token, { id: acct.id, ts: Date.now() });
    scheduleSave();
    console.log(`[auth] register name="${name}" id=${acct.id}`);
    sendJson(res, { id: acct.id, name: acct.name, token });
    return;
  }

  if (pathname === "/auth/login") {
    const name = sanitizeStr(body.name, MAX_NAME_LEN);
    const password = typeof body.password === "string" ? body.password : "";
    const acct = accounts.get(name.toLowerCase());
    // Constant-shape compare either way, so login can't probe for names.
    const salt = acct?.salt ?? "0".repeat(32);
    const expected = Buffer.from(acct?.hash ?? "0".repeat(64), "hex");
    const got = hashPassword(password, salt, acct?.kdf ?? SCRYPT);
    if (!acct || expected.length !== got.length || !timingSafeEqual(expected, got)) {
      sendJson(res, { error: "wrong name or password" });
      return;
    }
    const token = randomBytes(32).toString("hex");
    tokens.set(token, { id: acct.id, ts: Date.now() });
    scheduleSave();
    sendJson(res, { id: acct.id, name: acct.name, token });
    return;
  }

  if (pathname === "/auth/logout") {
    const token = typeof body.token === "string" ? body.token : "";
    if (tokens.delete(token)) scheduleSave();
    sendJson(res, { ok: true });
    return;
  }

  notFound(res);
}

/** POST /social/*: the mutual-connection and off-floor DM API. */
async function handleSocialPost(req, res, pathname) {
  const body = await readJson(req);
  if (!body) {
    notFound(res);
    return;
  }

  // Account ids must be backed by a token; bound guest ids by their secret.
  const actor =
    pathname === "/social/request" ? body.card?.id : pathname === "/social/dm" ? body.from : body.me;
  if (!verifyIdentity(actor, body.token, body.gs)) {
    notFound(res);
    return;
  }

  if (pathname === "/social/request") {
    const card = sanitizeCard(body.card);
    const to = resolveProfileId(sanitizeStr(body.to, MAX_ID_LEN));
    if (!card || !to || to === card.id) {
      notFound(res);
      return;
    }
    const sender = socialFor(card.id);
    const recipient = socialFor(to);
    if (!sender || !recipient) {
      notFound(res);
      return;
    }
    sender.name = card.name;
    const already =
      sender.connections.some((c) => c.peerId === to) ||
      sender.outgoing.includes(to) ||
      recipient.requests.some((r) => r.from.id === card.id);
    if (!already) {
      // A crossing request (they asked you first) auto-accepts — you both want it.
      const crossing = sender.requests.findIndex((r) => r.from.id === to);
      if (crossing >= 0) {
        const theirs = sender.requests.splice(crossing, 1)[0];
        acceptPair(card.id, card.name, to, theirs.from.name, card.startupName, theirs.from.startupName);
      } else if (recipient.requests.length < MAX_REQUESTS_PER_USER && sender.outgoing.length < 50) {
        recipient.requests.push({ from: card, ts: Date.now() });
        sender.outgoing.push(to);
        pushToProfile(to, { t: "connect_request", req: { from: card, ts: Date.now() } });
      }
      scheduleSave();
    }
    sendJson(res, { ok: true });
    return;
  }

  if (pathname === "/social/respond") {
    const me = sanitizeStr(body.me, MAX_ID_LEN);
    const meName = sanitizeStr(body.meName, MAX_NAME_LEN) || "founder";
    const peer = sanitizeStr(body.peer, MAX_ID_LEN);
    const mine = me && social.get(me);
    if (!mine || !peer) {
      notFound(res);
      return;
    }
    const idx = mine.requests.findIndex((r) => r.from.id === peer);
    if (idx < 0) {
      sendJson(res, { ok: true }); // already handled elsewhere
      return;
    }
    const reqEntry = mine.requests.splice(idx, 1)[0];
    const theirs = social.get(peer);
    if (theirs) theirs.outgoing = theirs.outgoing.filter((x) => x !== me);
    if (body.accept === true) {
      acceptPair(me, meName, peer, reqEntry.from.name, body.meStartup, reqEntry.from.startupName);
    }
    scheduleSave();
    sendJson(res, { ok: true });
    return;
  }

  if (pathname === "/social/dm") {
    const from = sanitizeStr(body.from, MAX_ID_LEN);
    const fromName = sanitizeStr(body.fromName, MAX_NAME_LEN) || "founder";
    const to = sanitizeStr(body.to, MAX_ID_LEN);
    const text = sanitizeText(body.text);
    const mine = from && social.get(from);
    if (!mine || !to || !text || !mine.connections.some((c) => c.peerId === to)) {
      notFound(res); // DMs only flow between connected profiles
      return;
    }
    mine.name = fromName;
    const key = pairKey(from, to);
    let thread = dms.get(key);
    if (!thread) {
      thread = [];
      dms.set(key, thread);
    }
    const msg = { fromId: from, text, ts: Date.now() };
    thread.push(msg);
    if (thread.length > MAX_DM_PER_THREAD) thread.splice(0, thread.length - MAX_DM_PER_THREAD);
    scheduleSave();
    // Live delivery: both parties' sockets everywhere (floors, inbox tabs) —
    // a message sent from the Connections screen pops up on the recipient's
    // floor immediately, and the sender's other tabs stay in sync.
    const toName = social.get(to)?.name || "connection";
    const ev = { t: "social_dm", from, fromName, to, toName, text, ts: msg.ts };
    pushToProfile(to, ev);
    pushToProfile(from, ev);
    sendJson(res, { ok: true });
    return;
  }

  notFound(res);
}

/**
 * Store the mutual connection both ways and tell the requester if online.
 * Startup names ride along (when known) so chat lists can show "name · company".
 */
function acceptPair(aId, aName, bId, bName, aStartup, bStartup) {
  const a = socialFor(aId);
  const b = socialFor(bId);
  if (!a || !b) return;
  const now = Date.now();
  const aCo = sanitizeStr(aStartup, 40) || undefined;
  const bCo = sanitizeStr(bStartup, 40) || undefined;
  if (!a.connections.some((c) => c.peerId === bId) && a.connections.length < MAX_CONNECTIONS_PER_USER) {
    a.connections.push({ peerId: bId, peerName: bName, peerStartup: bCo, ts: now });
  }
  if (!b.connections.some((c) => c.peerId === aId) && b.connections.length < MAX_CONNECTIONS_PER_USER) {
    b.connections.push({ peerId: aId, peerName: aName, peerStartup: aCo, ts: now });
  }
  a.outgoing = a.outgoing.filter((x) => x !== bId);
  b.outgoing = b.outgoing.filter((x) => x !== aId);
  pushToProfile(bId, { t: "connect_accept", peerId: aId, peerName: aName });
  pushToProfile(aId, { t: "connect_accept", peerId: bId, peerName: bName });
}

function notFound(res) {
  res.writeHead(404, {
    "Content-Type": "text/plain",
    "Access-Control-Allow-Origin": "*",
  });
  res.end("not found");
}

const server = createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url ?? "/", "http://internal");
  } catch {
    notFound(res);
    return;
  }

  // CORS preflight for the JSON POST routes
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-FF-GS",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/social") {
    const me = (url.searchParams.get("me") || "").slice(0, MAX_ID_LEN);
    // Bearer material belongs in headers (query strings leak via logs and
    // Referer); the query params remain as a fallback for older clients.
    const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : (url.searchParams.get("token") ?? "");
    const gsHeader = req.headers["x-ff-gs"];
    const gs = typeof gsHeader === "string" && gsHeader ? gsHeader : (url.searchParams.get("gs") ?? "");
    if (!me || !verifyIdentity(me, token, gs)) {
      notFound(res);
      return;
    }
    const s = social.get(me) ?? { requests: [], outgoing: [], connections: [] };
    const threads = {};
    for (const c of s.connections) {
      threads[c.peerId] = dms.get(pairKey(me, c.peerId)) ?? [];
    }
    sendJson(res, {
      requests: s.requests,
      outgoing: s.outgoing,
      connections: s.connections,
      threads,
    });
    return;
  }

  if (req.method === "POST" && url.pathname.startsWith("/social/")) {
    void handleSocialPost(req, res, url.pathname);
    return;
  }

  if (req.method === "POST" && url.pathname.startsWith("/auth/")) {
    void handleAuthPost(req, res, url.pathname);
    return;
  }

  // Uptime monitoring target: cheap, no auth, no data.
  if (req.method === "GET" && url.pathname === "/health") {
    let online = 0;
    for (const room of rooms.values()) online += room.size;
    sendJson(res, { ok: true, online, uptimeSec: Math.floor(process.uptime()) });
    return;
  }

  // Beta feedback: free-text notes from anyone, stored for the operator.
  if (req.method === "POST" && url.pathname === "/feedback") {
    void (async () => {
      if (authRateLimited(req)) {
        sendJson(res, { error: "slow down — try again in a minute" });
        return;
      }
      const body = await readJson(req);
      const text = body ? sanitizeStr(body.text, 1000) : "";
      if (!text) {
        notFound(res);
        return;
      }
      feedback.push({
        ts: Date.now(),
        from: sanitizeStr(body.from, MAX_NAME_LEN) || "anonymous",
        page: sanitizeStr(body.page, 100),
        text,
      });
      if (feedback.length > MAX_FEEDBACK) feedback = feedback.slice(-MAX_FEEDBACK);
      scheduleSave();
      sendJson(res, { ok: true });
    })();
    return;
  }

  if (req.method === "GET" && url.pathname === "/presence") {
    const floors = {};
    for (const [floorId, room] of rooms) floors[floorId] = room.size;
    sendJson(res, { floors });
    return;
  }

  // Every community startup on the site: claimed stands across all floors
  // (live or away) plus registry entries for founders who created a startup
  // but haven't claimed a spot yet. Everything was sanitized on the way in,
  // so this is a straight read — the directory merges it with the seed
  // startups and grows its category chips from whatever founders typed.
  if (req.method === "GET" && url.pathname === "/startups") {
    const out = [];
    const standOwners = new Set();
    for (const [floorId, byOwner] of stands) {
      if (floorId === "__inbox") continue;
      const room = rooms.get(floorId);
      for (const [ownerId, st] of byOwner) {
        standOwners.add(ownerId);
        out.push({
          floorId,
          spotIndex: st.claim.spotIndex,
          online: ownerOnline(room, ownerId),
          lastSeen: st.lastSeen,
          startup: st.claim.startup,
        });
        if (out.length >= 512) break; // plenty for a directory page
      }
      if (out.length >= 512) break;
    }
    for (const [ownerId, entry] of registry) {
      if (out.length >= 512) break;
      if (standOwners.has(ownerId)) continue; // their stand supersedes this
      out.push({
        floorId: null,
        spotIndex: -1,
        online: false,
        lastSeen: entry.ts,
        startup: entry.startup,
      });
    }
    sendJson(res, { startups: out });
    return;
  }

  // Cross-device progress: an identity's app state (booth, badges, quests,
  // streaks, membership) saved by one browser and pulled by another.
  if (req.method === "GET" && url.pathname === "/state") {
    const me = (url.searchParams.get("me") || "").slice(0, MAX_ID_LEN);
    const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const gsHeader = req.headers["x-ff-gs"];
    const gs = typeof gsHeader === "string" ? gsHeader : "";
    if (!me || !verifyIdentity(me, token, gs)) {
      notFound(res);
      return;
    }
    const entry = profileStates.get(me);
    sendJson(res, entry ? { state: entry.state, savedAt: entry.savedAt } : { state: null, savedAt: 0 });
    return;
  }

  if (req.method === "POST" && url.pathname === "/state/save") {
    void (async () => {
      const body = await readJson(req);
      const me = body ? sanitizeStr(body.me, MAX_ID_LEN) : "";
      if (!body || !me || !verifyIdentity(me, body.token, body.gs)) {
        notFound(res);
        return;
      }
      const state = sanitizeStateBlob(body.state);
      if (!state) {
        notFound(res);
        return;
      }
      if (!profileStates.has(me) && profileStates.size >= MAX_PROFILE_STATES) {
        sendJson(res, { error: "state store full" });
        return;
      }
      const savedAt = Date.now();
      profileStates.set(me, { state, savedAt });
      scheduleSave();
      sendJson(res, { ok: true, savedAt });
    })();
    return;
  }

  // Register/unregister a startup from the profile editor — this is what
  // makes a newly created startup (and its category) appear in the
  // directory before its founder ever claims a floor stand.
  if (req.method === "POST" && url.pathname.startsWith("/startups/")) {
    void (async () => {
      if (authRateLimited(req)) {
        sendJson(res, { error: "slow down — try again in a minute" });
        return;
      }
      const body = await readJson(req);
      const me = body ? sanitizeStr(body.me, MAX_ID_LEN) : "";
      if (!body || !me || !verifyIdentity(me, body.token, body.gs)) {
        notFound(res);
        return;
      }
      if (url.pathname === "/startups/register") {
        const startup = sanitizeStartup(body.startup);
        if (!startup) {
          notFound(res);
          return;
        }
        if (!registry.has(me) && registry.size >= MAX_REGISTRY) {
          sendJson(res, { error: "registry full" });
          return;
        }
        // Rekeyed by owner like stand claims — every client calls its own
        // startup "mine", which would collide in directory listings.
        startup.id = `reg:${me}`;
        registry.set(me, { startup, ts: Date.now() });
        scheduleSave();
        sendJson(res, { ok: true });
        return;
      }
      if (url.pathname === "/startups/unregister") {
        if (registry.delete(me)) scheduleSave();
        sendJson(res, { ok: true });
        return;
      }
      notFound(res);
    })();
    return;
  }

  if (req.method === "GET" && url.pathname === "/guestbook") {
    const floorId = (url.searchParams.get("floor") || "").slice(0, MAX_ID_LEN);
    const key = (url.searchParams.get("key") || "").slice(0, MAX_KEY_LEN);
    if (!floorId || !key) {
      notFound(res);
      return;
    }
    const entries = guestbooks.get(floorId)?.get(key) ?? [];
    sendJson(res, { entries }); // stored newest first, already capped at 50
    return;
  }

  // Everything else — including a plain HTTP GET on the ws path — is a 404.
  // WebSocket upgrades never reach this handler; ws owns the upgrade event.
  notFound(res);
});

// ---------- websocket ----------

const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });

server.on("error", (err) => {
  console.error(`[server] error: ${err.message}`);
  process.exit(1);
});

wss.on("error", (err) => {
  console.error(`[ws] server error: ${err.message}`);
  process.exit(1);
});

wss.on("connection", (ws, req) => {
  let floorId = "lobby";
  try {
    const url = new URL(req.url ?? "/", "ws://internal");
    floorId = (url.searchParams.get("floor") || "lobby").slice(0, MAX_ID_LEN);
  } catch {
    ws.close(1008, "bad request url");
    return;
  }

  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  /** Set once a valid join arrives; also stored in the room map. */
  let client = null;
  let room = null;

  // move rate limiting: fixed 1s window per client
  let moveWindowStart = 0;
  let movesInWindow = 0;

  // emote rate limiting: same fixed-window scheme, 3/s
  let emoteWindowStart = 0;
  let emotesInWindow = 0;

  // guestbook sign rate limiting: same fixed-window scheme, 2/s
  let signWindowStart = 0;
  let signsInWindow = 0;

  // chat rate limiting: same fixed-window scheme, 5/s
  let chatWindowStart = 0;
  let chatsInWindow = 0;

  // global frame limiting: every message type counts, so unknown-type floods
  // and verbs without their own limiter can't burn CPU / broadcast bandwidth
  let frameWindowStart = 0;
  let framesInWindow = 0;

  // booth_set limiting: a claim plus its denial-rollback re-claim is 2 frames
  // in quick succession, so allow a small burst over a longer window
  let boothWindowStart = 0;
  let boothSetsInWindow = 0;

  function handleJoin(msg) {
    const p = msg.player;
    let rawId =
      typeof p?.id === "string" && p.id.trim()
        ? p.id.trim().slice(0, MAX_ID_LEN)
        : randomUUID();
    // An id that fails the identity gate (account without its token, or a
    // bound guest id without its secret) is an impersonation attempt — the
    // connection still works, but as an anonymous guest.
    if (!verifyIdentity(rawId, msg.token, msg.gs)) {
      console.log(`[auth] rejected impersonation of ${rawId} — downgraded to guest`);
      rawId = randomUUID();
    }
    const name = sanitizeName(p?.name);
    const look = sanitizeLook(p?.look);
    const status = sanitizeStr(p?.status, MAX_STATUS_LEN);
    const title = sanitizeStr(p?.title, 24);
    const s = sanitizeMove(msg.s);

    room = rooms.get(floorId);
    if (!room) {
      room = new Map();
      rooms.set(floorId, room);
    }

    // Keep player ids unique within the room; the joiner learns the final id
    // via welcome.selfId.
    let id = rawId;
    for (let n = 2; room.has(id); n++) id = `${rawId}-${n}`;

    client = { ws, id, rawId, name, look, s, status, title, claim: null };
    room.set(id, client);

    // social push registry + keep the display name fresh for inboxes
    let socks = socketsByProfile.get(rawId);
    if (!socks) {
      socks = new Set();
      socketsByProfile.set(rawId, socks);
    }
    socks.add(ws);
    // Keep the display name fresh for inboxes — but not from "__inbox" joins,
    // whose placeholder name ("inbox") would overwrite the real one that DM
    // recipients see.
    if (floorId !== "__inbox") {
      const soc = socialFor(rawId);
      if (soc) soc.name = name;
    }

    const others = [...room.values()].filter((c) => c.id !== id).map(asRemotePlayer);
    send(ws, {
      t: "welcome",
      selfId: id,
      players: others,
      booths: floorBooths(floorId, room, rawId),
      activity: activity.get(floorId) ?? [], // oldest first, <= 20
    });
    broadcast(room, { t: "player_join", player: asRemotePlayer(client) }, id);
    broadcast(room, { t: "status", online: true, count: room.size });
    // After welcome, so the joiner sees their own arrival arrive live like
    // everyone else does (welcome carries only the items before it). A repeat
    // arrival within the window (flaky connection, floor-hopping) is silent.
    let seen = lastWalkIn.get(floorId);
    if (!seen) {
      if (lastWalkIn.size >= MAX_FLOORS_TRACKED) lastWalkIn.clear();
      seen = new Map();
      lastWalkIn.set(floorId, seen);
    }
    const now = Date.now();
    for (const [n2, ts] of seen) {
      if (now - ts >= WALK_IN_SUPPRESS_MS) seen.delete(n2);
    }
    const suppressed = seen.has(name);
    seen.set(name, now);
    // "__inbox" is the invisible room the Connections screen joins for live
    // pushes — no ticker lines for it, nobody "walks into" their own inbox.
    if (!suppressed && floorId !== "__inbox") pushActivity(room, floorId, `${name} walked in`);
    console.log(`[ws] join  floor=${floorId} id=${id} name="${name}" (${room.size} online)`);

    // A stand carried in with the join frame goes through the same arbitration.
    // A join WITHOUT a claim from a profile that has a stored stand means the
    // owner packed up while away (or wiped their browser) — the client's saved
    // state is the source of truth, so the stand comes down.
    if (msg.claim !== undefined) {
      handleBoothSet({ claim: msg.claim }, { silentActivity: standFor(rawId) !== null });
    } else if (standFor(rawId)) {
      removeStand(rawId);
    }
  }

  /** The joining profile's stored stand on this floor, if any. */
  function standFor(profileId) {
    return stands.get(floorId)?.get(profileId) ?? null;
  }

  function removeStand(profileId) {
    const byOwner = stands.get(floorId);
    if (!byOwner?.delete(profileId)) return;
    if (byOwner.size === 0) stands.delete(floorId);
    broadcast(room, { t: "booth_clear", ownerId: profileId }, client.id);
    scheduleSave();
  }

  function handleBoothSet(msg, opts = {}) {
    const claim = sanitizeClaim(msg.claim);
    if (!claim) return;
    const holder = spotTakenBy(floorId, claim.spotIndex, client.rawId);
    if (holder) {
      // First claim wins — including stands whose owner is merely away.
      send(ws, { t: "booth_denied", spotIndex: claim.spotIndex });
      return;
    }
    // Every client saves its own startup under the same local id ("mine"), so
    // relayed claims must be re-keyed by owner or they collide in receivers'
    // startup lookups and connection records. Keyed by the stable profile id.
    claim.startup.id = `claim:${client.rawId}`;
    client.claim = claim;
    let byOwner = stands.get(floorId);
    if (!byOwner) {
      byOwner = new Map();
      stands.set(floorId, byOwner);
    }
    if (!byOwner.has(client.rawId) && byOwner.size >= MAX_STANDS_PER_FLOOR) {
      // Tell the claimant, or their client keeps a ghost stand nobody else sees.
      send(ws, { t: "booth_denied", spotIndex: claim.spotIndex });
      return;
    }
    byOwner.set(client.rawId, { claim, ownerName: client.name, lastSeen: Date.now() });
    scheduleSave();
    broadcast(
      room,
      { t: "booth_set", ownerId: client.rawId, ownerName: client.name, online: true, claim },
      client.id,
    );
    // Re-raising your existing stand on rejoin is routine, not news.
    if (!opts.silentActivity) pushActivity(room, floorId, `${client.name} set up a stand`);
  }

  function handleBoothClear() {
    client.claim = null;
    removeStand(client.rawId);
    // deliberately no activity item — pack-ups are noise
  }

  function handleMove(msg) {
    const now = Date.now();
    if (now - moveWindowStart >= 1000) {
      moveWindowStart = now;
      movesInWindow = 0;
    }
    if (++movesInWindow > MOVES_PER_SEC) return; // drop excess moves silently

    const s = sanitizeMove(msg.s);
    client.s = s;
    broadcast(room, { t: "player_move", id: client.id, s }, client.id);
  }

  function handleEmote(msg) {
    if (!EMOTE_KINDS.has(msg.kind)) return; // unknown kinds are dropped
    const now = Date.now();
    if (now - emoteWindowStart >= 1000) {
      emoteWindowStart = now;
      emotesInWindow = 0;
    }
    if (++emotesInWindow > EMOTES_PER_SEC) return; // drop excess emotes silently

    // Echo to the sender too — one render path for local and remote bubbles.
    broadcast(room, { t: "emote", id: client.id, kind: msg.kind });
  }

  function handleSign(msg) {
    const now = Date.now();
    if (now - signWindowStart >= 1000) {
      signWindowStart = now;
      signsInWindow = 0;
    }
    if (++signsInWindow > SIGNS_PER_SEC) return; // drop excess signs silently

    const key = sanitizeStr(msg.key, MAX_KEY_LEN);
    const text = sanitizeStr(msg.text, MAX_SIGN_LEN);
    if (!key || !text) return; // drop empty keys / empty or whitespace-only text
    if (!isValidGuestbookKey(key)) return; // fabricated key shapes are dropped

    const entry = { from: client.name, text, ts: now };
    let books = guestbooks.get(floorId);
    if (!books) {
      if (guestbooks.size >= MAX_FLOORS_TRACKED) return; // floor cap
      books = new Map();
      guestbooks.set(floorId, books);
    }
    let entries = books.get(key);
    if (!entries) {
      if (books.size >= MAX_KEYS_PER_FLOOR) return; // per-floor key cap
      entries = [];
      books.set(key, entries);
    }
    entries.unshift(entry); // newest first
    if (entries.length > GUESTBOOK_KEEP) entries.length = GUESTBOOK_KEEP;

    broadcast(room, { t: "guestbook", key, entry }); // sender included
    // The client names the booth (the server only knows the opaque key);
    // sanitized and length-capped like every other client string.
    const boothName = sanitizeStr(msg.boothName, MAX_BOOTH_NAME_LEN);
    pushActivity(
      room,
      floorId,
      boothName
        ? `${client.name} signed ${boothName}'s guestbook`
        : `${client.name} signed a guestbook`,
    );
    scheduleSave();
  }

  function handleChat(msg) {
    const now = Date.now();
    if (now - chatWindowStart >= 1000) {
      chatWindowStart = now;
      chatsInWindow = 0;
    }
    if (++chatsInWindow > CHATS_PER_SEC) return; // drop excess chat silently

    const text = sanitizeText(msg.text);
    if (!text) return; // drop empty / whitespace-only messages
    const scope = msg.scope === "dm" ? "dm" : "floor";
    const base = {
      id: `m${BOOT}-${nextMsgId++}`,
      fromId: client.id,
      from: client.name,
      text,
      ts: Date.now(),
    };

    if (scope === "floor") {
      // Broadcast to the whole room INCLUDING the sender — the echo gives
      // every client the same message ordering.
      broadcast(room, { t: "chat", msg: { ...base, scope: "floor" } });
      return;
    }

    // dm: msg.peerId is always the OTHER party from the recipient's view.
    const peerId = typeof msg.peerId === "string" ? msg.peerId.slice(0, MAX_ID_LEN) : "";
    if (!peerId) return;
    const peer = room.get(peerId);
    // Echo to the sender even if the peer has already left, so the sender's
    // transcript stays consistent with what they typed.
    send(ws, { t: "chat", msg: { ...base, scope: "dm", peerId } });
    if (peer && peer.id !== client.id) {
      send(peer.ws, { t: "chat", msg: { ...base, scope: "dm", peerId: client.id } });
    }
  }

  ws.on("message", (data, isBinary) => {
    if (isBinary) return;
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return; // malformed JSON is ignored, never fatal
    }
    if (!msg || typeof msg !== "object" || typeof msg.t !== "string") return;

    const now = Date.now();
    if (now - frameWindowStart >= 1000) {
      frameWindowStart = now;
      framesInWindow = 0;
    }
    if (++framesInWindow > FRAMES_PER_SEC) {
      if (framesInWindow > FRAMES_PER_SEC * 5) ws.close(1008, "flood"); // gross abuse
      return; // drop excess frames of every type silently
    }

    if (!client) {
      if (msg.t === "join") handleJoin(msg);
      return; // anything before a valid join is ignored
    }

    switch (msg.t) {
      case "move":
        handleMove(msg);
        break;
      case "chat":
        handleChat(msg);
        break;
      case "booth_set":
        if (now - boothWindowStart >= 10_000) {
          boothWindowStart = now;
          boothSetsInWindow = 0;
        }
        if (++boothSetsInWindow > BOOTH_SETS_PER_10S) break;
        handleBoothSet(msg);
        break;
      case "booth_clear":
        handleBoothClear();
        break;
      case "emote":
        handleEmote(msg);
        break;
      case "sign":
        handleSign(msg);
        break;
      case "report":
        handleReport(msg);
        break;
      default:
        break; // unknown frame types are ignored
    }
  });

  // report rate limiting: one per 10s per client
  let lastReportAt = 0;
  function handleReport(msg) {
    const now = Date.now();
    if (now - lastReportAt < 10_000) return;
    lastReportAt = now;
    const targetId = sanitizeStr(msg.targetId, MAX_ID_LEN);
    if (!targetId) return;
    reports.push({
      ts: now,
      floor: floorId,
      fromId: client.rawId,
      fromName: client.name,
      targetId,
      reason: sanitizeStr(msg.reason, 200) || "unspecified",
    });
    if (reports.length > MAX_REPORTS) reports = reports.slice(-MAX_REPORTS);
    scheduleSave();
    console.log(`[report] floor=${floorId} from="${client.name}" target=${targetId}`);
  }

  ws.on("close", () => {
    if (!client || !room) return;
    const socks = socketsByProfile.get(client.rawId);
    if (socks) {
      socks.delete(ws);
      if (socks.size === 0) socketsByProfile.delete(client.rawId);
    }
    room.delete(client.id);
    broadcast(room, { t: "player_leave", id: client.id });
    broadcast(room, { t: "status", online: true, count: room.size });
    // Their stand stays up. If this was the owner's last connection on the
    // floor, tell everyone it just went "away" (and stamp lastSeen for expiry).
    const st = stands.get(floorId)?.get(client.rawId);
    if (st && !ownerOnline(room, client.rawId)) {
      st.lastSeen = Date.now();
      scheduleSave();
      broadcast(room, {
        t: "booth_set",
        ownerId: client.rawId,
        ownerName: st.ownerName,
        online: false,
        claim: st.claim,
      });
    }
    console.log(`[ws] leave floor=${floorId} id=${client.id} (${room.size} online)`);
    if (room.size === 0) rooms.delete(floorId);
    client = null;
    room = null;
  });

  ws.on("error", () => {
    // Socket-level errors (reset, protocol violation) — drop the connection;
    // the close handler performs room cleanup.
    ws.terminate();
  });
});

// Heartbeat: ping every 30s; terminate sockets that missed the previous ping.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_MS);

wss.on("close", () => clearInterval(heartbeat));

server.listen(PORT, () => {
  console.log(`[server] FounderFloor floor server (http+ws) listening on :${PORT}`);
});

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
 *   server -> client:
 *     { t: "welcome", selfId, players, booths, activity }   (activity oldest first)
 *     { t: "player_join", player: RemotePlayer }
 *     { t: "player_move", id, s: MoveState }
 *     { t: "player_leave", id }        (a leaver's stand packs up with them)
 *     { t: "booth_set", ownerId, claim }
 *     { t: "booth_clear", ownerId }
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

import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
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
const EMOTE_KINDS = new Set(["wave", "laugh", "clap", "heart", "question"]);

const DATA_FILE = join(dirname(fileURLToPath(import.meta.url)), "floor-data.json");

/**
 * rooms: floorId -> Map<playerId, client>
 * client: { ws, id, name, look, s, status, claim }
 * (id/name/look/s/status form the RemotePlayer)
 */
const rooms = new Map();

/** guestbooks: floorId -> Map<key, GuestbookEntry[]> — entries newest first, <= 50. */
const guestbooks = new Map();

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
    console.warn("[data] floor-data.json is corrupt — starting with empty guestbooks and activity");
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
  };
  const tmp = `${DATA_FILE}.tmp`;
  try {
    // Atomic on POSIX: readers only ever see the old or the new full file.
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.warn(`[data] persist failed: ${err.message}`);
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

loadData();

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

function sanitizeName(name) {
  const trimmed = typeof name === "string" ? name.trim().slice(0, MAX_NAME_LEN) : "";
  return trimmed || "guest";
}

function sanitizeText(text) {
  return typeof text === "string" ? text.trim().slice(0, MAX_TEXT_LEN) : "";
}

const GLYPHS = new Set(["bolt", "leaf", "coin", "chip", "flask", "rocket", "heart", "cube", "wave", "star"]);
const PATTERNS = new Set(["solid", "border", "stripes"]);
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_SPOT_INDEX = 63;

function sanitizeStr(v, max, fallback = "") {
  return typeof v === "string" ? v.trim().slice(0, max) : fallback;
}

/**
 * Rebuild a claim from an untrusted frame: only known fields survive, all of
 * them clamped. Returns null if the claim is structurally unusable.
 */
function sanitizeClaim(claim) {
  if (!claim || typeof claim !== "object") return null;
  const spotIndex = Number(claim.spotIndex);
  if (!Number.isInteger(spotIndex) || spotIndex < 0 || spotIndex > MAX_SPOT_INDEX) return null;
  const s = claim.startup;
  if (!s || typeof s !== "object") return null;
  const name = sanitizeStr(s.name, 40);
  if (!name) return null;
  const booth = s.booth && typeof s.booth === "object" ? s.booth : {};
  const goalProgress = Number(s.goalProgress);
  const verifiedRevenue = Number(s.verifiedRevenue);
  return {
    spotIndex,
    startup: {
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
      booth: {
        carpet: HEX_COLOR.test(booth.carpet) ? booth.carpet : "#C2B8A3",
        banner: HEX_COLOR.test(booth.banner) ? booth.banner : "#5C5548",
        sign: sanitizeStr(booth.sign, 12) || name.slice(0, 12).toUpperCase(),
        glyph: GLYPHS.has(booth.glyph) ? booth.glyph : "star",
        pattern: PATTERNS.has(booth.pattern) ? booth.pattern : "solid",
      },
    },
  };
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

/** All live claims in a room, excluding one player. */
function roomBooths(room, exceptId) {
  const out = [];
  for (const c of room.values()) {
    if (c.id !== exceptId && c.claim) out.push({ ownerId: c.id, claim: c.claim });
  }
  return out;
}

function spotTakenBy(room, spotIndex, exceptId) {
  for (const c of room.values()) {
    if (c.id !== exceptId && c.claim && c.claim.spotIndex === spotIndex) return c.id;
  }
  return null;
}

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

  if (req.method === "GET" && url.pathname === "/presence") {
    const floors = {};
    for (const [floorId, room] of rooms) floors[floorId] = room.size;
    sendJson(res, { floors });
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

  function handleJoin(msg) {
    const p = msg.player;
    const rawId =
      typeof p?.id === "string" && p.id.trim()
        ? p.id.trim().slice(0, MAX_ID_LEN)
        : randomUUID();
    const name = sanitizeName(p?.name);
    const look = sanitizeLook(p?.look);
    const status = sanitizeStr(p?.status, MAX_STATUS_LEN);
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

    client = { ws, id, name, look, s, status, claim: null };
    room.set(id, client);

    const others = [...room.values()].filter((c) => c.id !== id).map(asRemotePlayer);
    send(ws, {
      t: "welcome",
      selfId: id,
      players: others,
      booths: roomBooths(room, id),
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
    if (!suppressed) pushActivity(room, floorId, `${name} walked in`);
    console.log(`[ws] join  floor=${floorId} id=${id} name="${name}" (${room.size} online)`);

    // a stand carried in with the join frame goes through the same arbitration
    if (msg.claim !== undefined) handleBoothSet({ claim: msg.claim });
  }

  function handleBoothSet(msg) {
    const claim = sanitizeClaim(msg.claim);
    if (!claim) return;
    const holder = spotTakenBy(room, claim.spotIndex, client.id);
    if (holder) {
      // first claim wins; the loser's UI reverts and explains
      send(ws, { t: "booth_denied", spotIndex: claim.spotIndex });
      return;
    }
    // Every client saves its own startup under the same local id ("mine"), so
    // relayed claims must be re-keyed by owner or they collide in receivers'
    // startup lookups and connection records.
    claim.startup.id = `claim:${client.id}`;
    client.claim = claim;
    broadcast(room, { t: "booth_set", ownerId: client.id, claim }, client.id);
    pushActivity(room, floorId, `${client.name} set up a stand`);
  }

  function handleBoothClear() {
    if (!client.claim) return;
    client.claim = null;
    broadcast(room, { t: "booth_clear", ownerId: client.id }, client.id);
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
      default:
        break; // unknown frame types are ignored
    }
  });

  ws.on("close", () => {
    if (!client || !room) return;
    room.delete(client.id);
    broadcast(room, { t: "player_leave", id: client.id });
    broadcast(room, { t: "status", online: true, count: room.size });
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

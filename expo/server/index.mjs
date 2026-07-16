/**
 * FounderFloor — standalone WebSocket floor server.
 *
 * Rooms are keyed by floor id taken from the connection URL:
 *   ws://host:3001/ws?floor=<id>
 *
 * Protocol (JSON text frames) mirrors NetEvent in lib/types.ts:
 *   client -> server:
 *     { t: "join", player: { id, name, look }, s: MoveState, claim? }  (first frame)
 *     { t: "move", s: MoveState }
 *     { t: "chat", text, scope: "floor" | "dm", peerId? }
 *     { t: "booth_set", claim: { spotIndex, startup } }
 *     { t: "booth_clear" }
 *   server -> client:
 *     { t: "welcome", selfId, players: RemotePlayer[], booths: [{ ownerId, claim }] }
 *     { t: "player_join", player: RemotePlayer }
 *     { t: "player_move", id, s: MoveState }
 *     { t: "player_leave", id }        (a leaver's stand packs up with them)
 *     { t: "booth_set", ownerId, claim }
 *     { t: "booth_clear", ownerId }
 *     { t: "booth_denied", spotIndex }  (only to a claimant whose spot was taken)
 *     { t: "chat", msg: ChatMsg }
 *     { t: "status", online: true, count }
 *
 * Run with: node server/index.mjs   (PORT_WS overrides the port, default 3001)
 */

import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT_WS || 3001);

const MAX_NAME_LEN = 24;
const MAX_TEXT_LEN = 500;
const MAX_ID_LEN = 64;
const MOVES_PER_SEC = 20; // moves beyond this per client per second are dropped
const HEARTBEAT_MS = 30_000;
const OPEN = 1; // WebSocket.OPEN

const DIRS = new Set(["up", "down", "left", "right"]);

/**
 * rooms: floorId -> Map<playerId, client>
 * client: { ws, id, name, look, s }  (id/name/look/s form the RemotePlayer)
 */
const rooms = new Map();

/** Server-assigned, incrementing ChatMsg id. */
let nextMsgId = 1;

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
  return { id: client.id, name: client.name, look: client.look, s: client.s };
}

// ---------- server ----------

const wss = new WebSocketServer({ port: PORT, maxPayload: 16 * 1024 });

wss.on("listening", () => {
  console.log(`[ws] FounderFloor floor server listening on :${PORT}`);
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

  function handleJoin(msg) {
    const p = msg.player;
    const rawId =
      typeof p?.id === "string" && p.id.trim()
        ? p.id.trim().slice(0, MAX_ID_LEN)
        : randomUUID();
    const name = sanitizeName(p?.name);
    const look = sanitizeLook(p?.look);
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

    client = { ws, id, name, look, s, claim: null };
    room.set(id, client);

    const others = [...room.values()].filter((c) => c.id !== id).map(asRemotePlayer);
    send(ws, { t: "welcome", selfId: id, players: others, booths: roomBooths(room, id) });
    broadcast(room, { t: "player_join", player: asRemotePlayer(client) }, id);
    broadcast(room, { t: "status", online: true, count: room.size });
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
    client.claim = claim;
    broadcast(room, { t: "booth_set", ownerId: client.id, claim }, client.id);
  }

  function handleBoothClear() {
    if (!client.claim) return;
    client.claim = null;
    broadcast(room, { t: "booth_clear", ownerId: client.id }, client.id);
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

  function handleChat(msg) {
    const text = sanitizeText(msg.text);
    if (!text) return; // drop empty / whitespace-only messages
    const scope = msg.scope === "dm" ? "dm" : "floor";
    const base = {
      id: `m${nextMsgId++}`,
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

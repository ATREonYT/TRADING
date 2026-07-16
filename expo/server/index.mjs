/**
 * FounderFloor — standalone WebSocket floor server.
 *
 * Rooms are keyed by floor id taken from the connection URL:
 *   ws://host:3001/ws?floor=<id>
 *
 * Protocol (JSON text frames) mirrors NetEvent in lib/types.ts:
 *   client -> server:
 *     { t: "join", player: { id, name, look }, s: MoveState }   (first frame)
 *     { t: "move", s: MoveState }
 *     { t: "chat", text, scope: "floor" | "dm", peerId? }
 *   server -> client:
 *     { t: "welcome", selfId, players: RemotePlayer[] }
 *     { t: "player_join", player: RemotePlayer }
 *     { t: "player_move", id, s: MoveState }
 *     { t: "player_leave", id }
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
  const url = new URL(req.url ?? "/", "ws://internal");
  const floorId = (url.searchParams.get("floor") || "lobby").slice(0, MAX_ID_LEN);

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

    client = { ws, id, name, look, s };
    room.set(id, client);

    const others = [...room.values()].filter((c) => c.id !== id).map(asRemotePlayer);
    send(ws, { t: "welcome", selfId: id, players: others });
    broadcast(room, { t: "player_join", player: asRemotePlayer(client) }, id);
    broadcast(room, { t: "status", online: true, count: room.size });
    console.log(`[ws] join  floor=${floorId} id=${id} name="${name}" (${room.size} online)`);
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

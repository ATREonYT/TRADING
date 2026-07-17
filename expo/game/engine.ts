/**
 * FounderFloor — canvas game engine.
 * Owns the render loop, input, collision, camera, remote players and
 * founder NPCs. Pixel art is rendered at 2x world zoom with image
 * smoothing off; UI text (name labels, chat bubbles, the "!" nudge,
 * the minimap) is drawn in screen space so it stays sharp.
 *
 * Liveness layer: chat/emote bubbles, click/tap-to-walk pathfinding,
 * hover cards, a bottom-right minimap, and ambient NPC chatter.
 */

import { TILE } from "../lib/types";
import type {
  BoothClaim,
  BoothInstance,
  Dir,
  EmoteKind,
  GameHandle,
  GameOptions,
  HoverTarget,
  MoveState,
  NetEvent,
  RemotePlayer,
} from "../lib/types";
import { SPRITE_H, SPRITE_W, SpriteBank } from "./sprites";
import type { AvatarFrames } from "./sprites";
import { buildFloor } from "./tilemap";
import type { Cam, ClaimEntry, Drawable } from "./tilemap";
import { AmbientDirector, makeNpcs, updateNpcs } from "./npc";
import type { Npc } from "./npc";
import { BubbleManager } from "./bubbles";
import { findPath } from "./path";

const ZOOM = 2; // world px -> screen px
/** Snap a world coordinate to the screen-pixel grid (1/ZOOM world px). Sprites
 * and camera both live on this grid, so nothing shimmers against the floor. */
const snapW = (v: number): number => Math.round(v * ZOOM) / ZOOM;
const SPEED = 140; // player px/s
const LERP_RATE = 12; // remote interpolation, fraction/s
const SEND_INTERVAL = 0.1; // 10 packets/s while moving
const WALK_FPS = 7;
const HOVER_INTERVAL_MS = 66; // hover hit-tests at ~15/s
const REPATH_COOLDOWN_MS = 400;
const MINIMAP_MAX_W = 160;
const MINIMAP_MAX_H = 120;
const MINIMAP_INSET = 12;
const MINIMAP_BOTTOM = 56; // keep clear of the controls hint (fine pointers)
const MINIMAP_TOP_COARSE = 148; // below the top bar + ticker; the mobile HUD owns the bottom
const LABEL_H = 14;
const LABEL_H_STATUS = 25;

interface Remote {
  name: string;
  status?: string;
  title?: string;
  frames: AvatarFrames;
  x: number;
  y: number;
  target: MoveState;
  animT: number;
  movingVis: boolean;
}

export function createGame(opts: GameOptions): GameHandle {
  const { canvas, floor, me, net, cb } = opts;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("FounderFloor: 2d canvas context unavailable");

  // ---------- floor build (rebuilt whenever a stand is claimed / packed up) ----------

  let myClaim: BoothClaim | null = opts.myClaim ?? null;
  /** ownerId (stable profile id) -> stand; survives the owner leaving ("away"). */
  const remoteClaims = new Map<string, { claim: BoothClaim; ownerName: string; online: boolean }>();

  const claimEntries = (): ClaimEntry[] => {
    const list: ClaimEntry[] = [];
    if (myClaim) list.push({ claim: myClaim, isYours: true, ownerId: me.id, ownerName: me.name });
    for (const [ownerId, st] of remoteClaims) {
      if (ownerId === me.id) continue;
      list.push({ claim: st.claim, isYours: false, ownerId, ownerName: st.ownerName, online: st.online });
    }
    return list;
  };

  const bank = new SpriteBank();
  const myFrames = bank.makeAvatar(me.look);
  let built = buildFloor(floor, opts.startups, claimEntries());
  let npcs: Npc[] = makeNpcs(built.booths, bank);
  const mapW = built.widthPx;
  const mapH = built.heightPx;

  // ---------- liveness: bubbles + ambient NPC chatter ----------

  const bubbles = new BubbleManager();
  const director = new AmbientDirector(opts.idleLines ?? {}, {
    say: (npc, line) => bubbles.showChat(npc.bubbleId, line, performance.now()),
    emote: (npc, kind) => bubbles.showEmote(npc.bubbleId, kind, performance.now()),
  });

  let firstMoveDone = false;
  let firstEmoteDone = false;

  /** Wire ids whose bubbles/emotes are hidden (session mute list, set by the UI). */
  const muted = new Set<string>();

  // ---------- collision ----------

  // feet box: 12px wide, 8px tall, anchored at the feet point (x, y)
  const blocked = (cx: number, cy: number): boolean => {
    const x0 = Math.floor((cx - 6) / TILE);
    const x1 = Math.floor((cx + 6) / TILE);
    const y0 = Math.floor((cy - 5) / TILE);
    const y1 = Math.floor((cy + 3) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (built.solid(tx, ty)) return true;
      }
    }
    return false;
  };

  // ---------- spawn: bottom-center, nearest walkable tile ----------

  const findNearestWalkable = (cx: number, cy: number): { x: number; y: number } => {
    const maxR = Math.max(floor.width, floor.height);
    for (let r = 0; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = cx + dx;
          const ty = cy + dy;
          if (!built.solid(tx, ty)) {
            return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE - 8 };
          }
        }
      }
    }
    return { x: mapW / 2, y: mapH / 2 }; // pathological map; land somewhere
  };

  const spawn = findNearestWalkable(Math.floor(floor.width / 2), floor.height - 2);
  const player: MoveState = { x: spawn.x, y: spawn.y, dir: "up", moving: false };
  let playerAnimT = 0;

  // ---------- click/tap-to-walk path ----------

  let path: { x: number; y: number }[] | null = null;
  let pathIdx = 0;
  let pathGoal: { x: number; y: number } | null = null;
  let lastRepathMs = -1e9;

  const clearPath = (): void => {
    path = null;
    pathIdx = 0;
    pathGoal = null;
  };

  const startPathTo = (tx: number, ty: number): void => {
    const p = findPath(
      floor.width,
      floor.height,
      built.solid,
      { x: Math.floor(player.x / TILE), y: Math.floor(player.y / TILE) },
      { x: tx, y: ty }
    );
    if (p && p.length > 0) {
      path = p;
      pathIdx = 0;
      pathGoal = { x: tx, y: ty };
    } else {
      clearPath();
    }
  };

  // the current segment turned out blocked (rare; e.g. mid-rebuild) — try once
  const repath = (): void => {
    const goal = pathGoal;
    const now = performance.now();
    clearPath();
    if (!goal || now - lastRepathMs < REPATH_COOLDOWN_MS) return;
    lastRepathMs = now;
    startPathTo(goal.x, goal.y);
  };

  /** Walk toward the next waypoint; returns whether the player moved. */
  const followPath = (dt: number): boolean => {
    if (!path) return false;
    const wp = path[pathIdx];
    const wpx = wp.x * TILE + TILE / 2;
    const wpy = wp.y * TILE + TILE / 2;
    const dx = wpx - player.x;
    const dy = wpy - player.y;
    const stepLen = SPEED * dt;
    let moved = false;
    if (Math.abs(dx) > 0.5) {
      const mv = Math.sign(dx) * Math.min(stepLen, Math.abs(dx));
      if (blocked(player.x + mv, player.y)) {
        repath();
        return false;
      }
      player.x += mv;
      player.dir = dx > 0 ? "right" : "left";
      moved = true;
    } else if (Math.abs(dy) > 0.5) {
      const mv = Math.sign(dy) * Math.min(stepLen, Math.abs(dy));
      if (blocked(player.x, player.y + mv)) {
        repath();
        return false;
      }
      player.y += mv;
      player.dir = dy > 0 ? "down" : "up";
      moved = true;
    }
    if (path && Math.abs(wpx - player.x) <= 0.5 && Math.abs(wpy - player.y) <= 0.5) {
      pathIdx++;
      if (pathIdx >= path.length) clearPath();
    }
    return moved;
  };

  // ---------- net ----------

  const remotes = new Map<string, Remote>();
  const presence = (): void => cb.onPresence(1 + remotes.size, net.online);
  /**
   * Wire ids this client has held before (a reconnect can be re-suffixed by
   * the server while the old socket awaits the heartbeat reaper). Only these
   * are dropped as our own ghosts — another tab sharing the profile id is a
   * real, visible player.
   */
  const prevSelfIds = new Set<string>();
  const addRemote = (p: RemotePlayer): void => {
    if (p.id === net.selfId || prevSelfIds.has(p.id)) return;
    remotes.set(p.id, {
      name: p.name,
      status: p.status,
      title: p.title,
      frames: bank.makeAvatar(p.look),
      x: p.s.x,
      y: p.s.y,
      target: { ...p.s },
      animT: 0,
      movingVis: false,
    });
  };
  const unsubNet = net.on((ev: NetEvent): void => {
    switch (ev.t) {
      case "welcome":
        remotes.clear();
        for (const p of ev.players) addRemote(p);
        remoteClaims.clear();
        for (const b of ev.booths) {
          // stands are keyed by stable profile id — mine is rendered via myClaim
          if (b.ownerId !== me.id) {
            remoteClaims.set(b.ownerId, { claim: b.claim, ownerName: b.ownerName, online: b.online });
          }
        }
        prevSelfIds.add(net.selfId); // a later reconnect can filter this ghost
        rebuild();
        presence();
        break;
      case "player_join":
        addRemote(ev.player);
        presence();
        break;
      case "player_move": {
        const r = remotes.get(ev.id);
        if (r) r.target = { ...ev.s };
        break;
      }
      case "player_leave":
        remotes.delete(ev.id);
        bubbles.remove(ev.id);
        // their stand STAYS — the server re-announces it as away (booth_set)
        presence();
        break;
      case "booth_set":
        if (ev.ownerId !== me.id) {
          remoteClaims.set(ev.ownerId, { claim: ev.claim, ownerName: ev.ownerName, online: ev.online });
          rebuild();
        }
        break;
      case "booth_clear":
        if (remoteClaims.delete(ev.ownerId)) rebuild();
        break;
      case "booth_denied":
        break; // the UI reverts the claim and explains
      case "emote":
        // own emotes are rendered at send time; the echo must not double-render
        if (ev.id !== net.selfId && remotes.has(ev.id) && !muted.has(ev.id)) {
          bubbles.showEmote(ev.id, ev.kind, performance.now());
        }
        break;
      case "status":
        if (!ev.online) {
          remotes.clear();
          if (remoteClaims.size > 0) {
            remoteClaims.clear();
            rebuild();
          }
        }
        presence();
        break;
      case "chat":
        // remote floor chat auto-bubbles; the transcript is the UI's problem
        if (ev.msg.scope === "floor" && remotes.has(ev.msg.fromId) && !muted.has(ev.msg.fromId)) {
          bubbles.showChat(ev.msg.fromId, ev.msg.text, performance.now());
        }
        break;
      case "guestbook":
      case "activity":
        break; // surfaced by the UI, not the canvas
    }
  });
  net.connect(floor.id, me, { ...player }, myClaim ?? undefined);

  let sendAcc = 0;
  let wasMoving = false;

  // ---------- input ----------

  let inputEnabled = true;
  let minimapOn = false; // real default set after the first resize below
  const coarsePointer =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const keys = new Set<string>();
  const keyOf = (k: string): string | null => {
    switch (k) {
      case "w":
      case "W":
      case "ArrowUp":
        return "up";
      case "s":
      case "S":
      case "ArrowDown":
        return "down";
      case "a":
      case "A":
      case "ArrowLeft":
        return "left";
      case "d":
      case "D":
      case "ArrowRight":
        return "right";
      default:
        return null;
    }
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (!inputEnabled) return;
    if (e.key === "m" || e.key === "M") {
      minimapOn = !minimapOn;
      return;
    }
    if (e.key === "e" || e.key === "E" || e.key === "Enter") {
      if (nearBooth) {
        e.preventDefault();
        cb.onInteract(nearBooth);
      }
      return;
    }
    const k = keyOf(e.key);
    if (k) {
      e.preventDefault();
      keys.add(k);
      clearPath(); // manual steering always wins over tap-to-walk
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const k = keyOf(e.key);
    if (k) keys.delete(k);
  };
  const onBlur = (): void => keys.clear();

  // ---------- booth proximity ----------

  const withinRing = (b: BoothInstance, tx: number, ty: number): boolean =>
    tx >= b.spot.x - 1 && tx <= b.spot.x + 4 && ty >= b.spot.y - 1 && ty <= b.spot.y + 3;

  let nearBooth: BoothInstance | null = null;
  const computeNear = (): BoothInstance | null => {
    const tx = Math.floor(player.x / TILE);
    const ty = Math.floor(player.y / TILE);
    let best: BoothInstance | null = null;
    let bestD = Infinity;
    for (const b of built.booths) {
      if (!withinRing(b, tx, ty)) continue;
      const cx = (b.spot.x + 2) * TILE;
      const cy = (b.spot.y + 1.5) * TILE;
      const d = (player.x - cx) ** 2 + (player.y - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  };

  // ---------- floor rebuild (claims changed) ----------

  function rebuild(): void {
    built = buildFloor(floor, opts.startups, claimEntries());
    npcs = makeNpcs(built.booths, bank);
    // unstick the player if a stand just appeared underfoot
    if (blocked(player.x, player.y)) {
      const p = findNearestWalkable(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
      player.x = p.x;
      player.y = p.y;
    }
    // a rebuild can invalidate the walking path — re-route to the same goal
    if (path && pathGoal) {
      let ok = true;
      for (let i = pathIdx; i < path.length; i++) {
        if (built.solid(path[i].x, path[i].y)) {
          ok = false;
          break;
        }
      }
      if (!ok) {
        const goal = pathGoal;
        clearPath();
        startPathTo(goal.x, goal.y);
      }
    }
    // old BoothInstance references are stale — recompute and re-announce
    const prevIdx = nearBooth ? nearBooth.spotIndex : -1;
    nearBooth = computeNear();
    const newIdx = nearBooth ? nearBooth.spotIndex : -1;
    if (nearBooth || newIdx !== prevIdx) cb.onNearBooth(nearBooth);
  }

  // ---------- pointer: tap-to-walk, player taps, hover cards ----------

  const hitAvatar = (wx: number, wy: number, ax: number, ay: number): boolean =>
    wx >= ax - SPRITE_W / 2 - 1 &&
    wx <= ax + SPRITE_W / 2 + 1 &&
    wy >= ay - SPRITE_H - 2 &&
    wy <= ay + 2;

  const boothAtTile = (tx: number, ty: number): BoothInstance | null => {
    for (const b of built.booths) {
      if (tx >= b.spot.x && tx < b.spot.x + 4 && ty >= b.spot.y && ty < b.spot.y + 3) return b;
    }
    return null;
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Gate EVERY step, not just walking — a stray tap while the chat input
    // is focused must not switch DM tabs or swap the active booth card.
    if (!inputEnabled) return;
    const rct = canvas.getBoundingClientRect();
    const wx = cam.x + (e.clientX - rct.left) / ZOOM;
    const wy = cam.y + (e.clientY - rct.top) / ZOOM;
    // 1) a remote player's avatar -> open a DM
    for (const [id, r] of remotes) {
      if (hitAvatar(wx, wy, r.x, r.y)) {
        cb.onPlayerClick?.({ id, name: r.name });
        return;
      }
    }
    // 2) a booth you're already close to -> interact
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const b = boothAtTile(tx, ty);
    if (b) {
      const ptx = Math.floor(player.x / TILE);
      const pty = Math.floor(player.y / TILE);
      if (withinRing(b, ptx, pty)) {
        clearPath();
        cb.onInteract(b);
        return;
      }
    }
    // 3) anywhere else -> walk there (solid tiles resolve to the nearest
    //    reachable neighbor, so tapping a far booth walks you up to it)
    startPathTo(tx, ty);
  };

  let hoverKey = "";
  let hoverAnchorX = 0;
  let hoverAnchorY = 0;
  let lastHoverMs = 0;

  const hoverAt = (cx: number, cy: number): HoverTarget | null => {
    const wx = cam.x + cx / ZOOM;
    const wy = cam.y + cy / ZOOM;
    for (const [id, r] of remotes) {
      if (hitAvatar(wx, wy, r.x, r.y)) {
        return {
          kind: "player",
          id,
          name: r.name,
          status: r.status,
          title: r.title,
          x: (r.x - cam.x) * ZOOM,
          y: (r.y - SPRITE_H - cam.y) * ZOOM,
        };
      }
    }
    for (const n of npcs) {
      if (hitAvatar(wx, wy, n.x, n.y)) {
        return {
          kind: "npc",
          startupId: n.startupId,
          name: n.name,
          x: (n.x - cam.x) * ZOOM,
          y: (n.y - SPRITE_H - cam.y) * ZOOM,
        };
      }
    }
    const b = boothAtTile(Math.floor(wx / TILE), Math.floor(wy / TILE));
    if (b) {
      return {
        kind: "booth",
        booth: b,
        x: ((b.spot.x + 2) * TILE - cam.x) * ZOOM,
        y: (b.spot.y * TILE - 8 - cam.y) * ZOOM,
      };
    }
    return null;
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === "touch") return; // no hover on coarse pointers
    const now = performance.now();
    if (now - lastHoverMs < HOVER_INTERVAL_MS) return;
    lastHoverMs = now;
    const rct = canvas.getBoundingClientRect();
    const t = hoverAt(e.clientX - rct.left, e.clientY - rct.top);
    const key =
      t === null
        ? ""
        : t.kind === "player"
          ? `p:${t.id}`
          : t.kind === "npc"
            ? `n:${t.startupId}`
            : `b:${t.booth.spotIndex}`;
    const drifted =
      t !== null && (Math.abs(t.x - hoverAnchorX) > 2 || Math.abs(t.y - hoverAnchorY) > 2);
    if (key !== hoverKey || drifted) {
      hoverKey = key;
      if (t) {
        hoverAnchorX = t.x;
        hoverAnchorY = t.y;
      }
      cb.onHover?.(t);
      canvas.style.cursor = t ? "pointer" : "";
    }
  };

  const onPointerLeave = (): void => {
    if (hoverKey !== "") {
      hoverKey = "";
      cb.onHover?.(null);
    }
    canvas.style.cursor = "";
  };

  // ---------- canvas sizing ----------

  let dpr = 1;
  let cssW = canvas.clientWidth || 640;
  let cssH = canvas.clientHeight || 480;
  const resize = (): void => {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    cssW = canvas.clientWidth || cssW;
    cssH = canvas.clientHeight || cssH;
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.imageSmoothingEnabled = false;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // minimap defaults ON only when there's more hall than viewport
  minimapOn = mapW > cssW / ZOOM || mapH > cssH / ZOOM;

  // ---------- camera ----------

  const cam: Cam = { x: 0, y: 0, w: cssW / ZOOM, h: cssH / ZOOM };
  const clampAxis = (want: number, map: number, view: number): number =>
    map <= view ? (map - view) / 2 : Math.max(0, Math.min(map - view, want));

  // ---------- per-frame update ----------

  const step = (dt: number): void => {
    // player movement: keys first; otherwise follow the tapped path
    let vx = 0;
    let vy = 0;
    if (inputEnabled) {
      if (keys.has("left")) vx -= 1;
      if (keys.has("right")) vx += 1;
      if (keys.has("up")) vy -= 1;
      if (keys.has("down")) vy += 1;
    }
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }
    const keyMoving = vx !== 0 || vy !== 0;
    let moving = keyMoving;
    if (keyMoving) {
      if (path) clearPath();
      const nd: Dir = vx < 0 ? "left" : vx > 0 ? "right" : vy < 0 ? "up" : "down";
      player.dir = nd;
      const nx = player.x + vx * SPEED * dt;
      if (!blocked(nx, player.y)) player.x = nx;
      const ny = player.y + vy * SPEED * dt;
      if (!blocked(player.x, ny)) player.y = ny;
    } else if (path && inputEnabled) {
      moving = followPath(dt);
    }
    if (moving) playerAnimT += dt;
    player.moving = moving;
    if (moving && !firstMoveDone) {
      firstMoveDone = true;
      cb.onFirstAction?.("move");
    }

    // movement packets: 10/s while moving, one final packet on stop
    if (moving) {
      sendAcc += dt;
      if (sendAcc >= SEND_INTERVAL) {
        sendAcc = 0;
        net.sendMove({ ...player });
      }
    } else if (wasMoving) {
      sendAcc = 0;
      net.sendMove({ ...player });
    }
    wasMoving = moving;

    // remote interpolation
    const k = Math.min(1, LERP_RATE * dt);
    for (const r of remotes.values()) {
      const dx = r.target.x - r.x;
      const dy = r.target.y - r.y;
      if (dx * dx + dy * dy > (3 * TILE) ** 2) {
        r.x = r.target.x;
        r.y = r.target.y;
      } else {
        r.x += dx * k;
        r.y += dy * k;
      }
      r.movingVis = r.target.moving || Math.abs(dx) + Math.abs(dy) > 2;
      if (r.movingVis) r.animT += dt;
    }

    updateNpcs(npcs, dt, player.x, player.y);
    director.update(dt, npcs);

    // proximity
    const nb = computeNear();
    if (nb !== nearBooth) {
      nearBooth = nb;
      cb.onNearBooth(nb);
    }
  };

  // ---------- drawing ----------

  const drawAvatar = (
    frames: AvatarFrames,
    x: number,
    y: number,
    dir: Dir,
    frame: number
  ): void => {
    const px = snapW(x);
    const py = snapW(y);
    ctx.fillStyle = "rgba(35,32,26,0.16)";
    ctx.beginPath();
    ctx.ellipse(px, py - 1, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(frames[dir][frame], px - SPRITE_W / 2, py - SPRITE_H);
  };

  const pillPath = (bx: number, by: number, bw: number, bh: number): void => {
    const r = Math.min(7, bh / 2);
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
    ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
    ctx.arcTo(bx, by + bh, bx, by, r);
    ctx.arcTo(bx, by, bx + bw, by, r);
    ctx.closePath();
  };

  const drawLabel = (name: string, status: string | undefined, wx: number, wy: number): void => {
    const sx = Math.round((wx - cam.x) * ZOOM);
    const sy = Math.round((wy - SPRITE_H - cam.y) * ZOOM - 8);
    if (sx < -90 || sx > cssW + 90 || sy < -40 || sy > cssH + 40) return;
    const st = status ? status.trim() : "";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "10px system-ui, -apple-system, Segoe UI, sans-serif";
    let w = ctx.measureText(name).width;
    if (st) {
      ctx.font = "9px system-ui, -apple-system, Segoe UI, sans-serif";
      w = Math.max(w, Math.min(ctx.measureText(st).width, 140));
    }
    const bw = Math.ceil(w) + 12;
    const bh = st ? LABEL_H_STATUS : LABEL_H;
    const bx = Math.round(sx - bw / 2);
    const by = sy - bh;
    ctx.fillStyle = "rgba(35,32,26,0.84)";
    pillPath(bx, by, bw, bh);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "10px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(name, sx, by + 7.5);
    if (st) {
      ctx.fillStyle = "rgba(242,239,231,0.7)";
      ctx.font = "9px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(st, sx, by + 18, 140);
    }
  };

  /** Screen-space y of a bubble's tail tip, sitting just above the name pill. */
  const bubbleTailY = (wy: number, labelH: number): number => {
    const headTop = (wy - SPRITE_H - cam.y) * ZOOM;
    return labelH > 0 ? headTop - 11 - labelH : headTop - 4;
  };

  const drawMinimap = (): void => {
    const k = Math.min(MINIMAP_MAX_W / mapW, MINIMAP_MAX_H / mapH);
    const mw = mapW * k;
    const mh = mapH * k;
    const mx = cssW - MINIMAP_INSET - mw;
    // Coarse pointers: the mobile HUD column (chat bar, emotes, hints) owns
    // the bottom of the screen, so the map anchors top-right instead.
    const my = coarsePointer ? MINIMAP_TOP_COARSE : cssH - MINIMAP_BOTTOM - mh;
    // paper backing
    ctx.fillStyle = "rgba(242,239,231,0.92)";
    ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.strokeStyle = "#E4DFD3";
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - 3.5, my - 3.5, mw + 7, mh + 7);
    // floor rectangle
    ctx.fillStyle = floor.theme.floorA;
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);
    // booth zones (4x3 blocks)
    for (const b of built.booths) {
      const bx = mx + b.spot.x * TILE * k;
      const by = my + b.spot.y * TILE * k;
      const bw = 4 * TILE * k;
      const bh = 3 * TILE * k;
      ctx.fillStyle = b.startup ? b.startup.booth.banner : "#B9B2A2";
      ctx.fillRect(bx, by, bw, bh);
      if (b.isYours) {
        ctx.strokeStyle = "#B08D2E";
        ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, bh + 1);
        ctx.strokeStyle = "#E4DFD3";
      }
    }
    // people
    ctx.fillStyle = "#23201A";
    for (const r of remotes.values()) ctx.fillRect(mx + r.x * k - 1, my + r.y * k - 1, 2, 2);
    for (const n of npcs) ctx.fillRect(mx + n.x * k - 1, my + n.y * k - 1, 2, 2);
    ctx.fillStyle = "#D9480F";
    ctx.fillRect(mx + player.x * k - 1.5, my + player.y * k - 1.5, 3, 3);
    // camera viewport
    const vx0 = Math.max(0, cam.x);
    const vy0 = Math.max(0, cam.y);
    const vx1 = Math.min(mapW, cam.x + cam.w);
    const vy1 = Math.min(mapH, cam.y + cam.h);
    if (vx1 > vx0 && vy1 > vy0) {
      ctx.strokeStyle = "rgba(35,32,26,0.35)";
      ctx.strokeRect(mx + vx0 * k + 0.5, my + vy0 * k + 0.5, (vx1 - vx0) * k - 1, (vy1 - vy0) * k - 1);
    }
  };

  const render = (nowMs: number): void => {
    const t = nowMs / 1000;
    cam.w = cssW / ZOOM;
    cam.h = cssH / ZOOM;
    cam.x = clampAxis(player.x - cam.w / 2, mapW, cam.w);
    cam.y = clampAxis(player.y - cam.h / 2, mapH, cam.h);
    // Snap the camera to the device-pixel grid — fractional camera positions
    // make the floor shimmer against pixel-snapped sprites (the "buggy walk").
    const grid = ZOOM * dpr;
    cam.x = Math.round(cam.x * grid) / grid;
    cam.y = Math.round(cam.y * grid) / grid;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = floor.theme.wall; // letterbox in wall color
    ctx.fillRect(0, 0, cssW, cssH);

    const s = dpr * ZOOM;
    ctx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
    built.drawUnder(ctx, cam);

    // dynamic drawables (player, remotes, NPCs) merged with static scenery
    const dyn: Drawable[] = [];
    const playerFrame = player.moving ? 1 + (Math.floor(playerAnimT * WALK_FPS) % 2) : 0;
    dyn.push({
      sortY: player.y,
      draw: () => drawAvatar(myFrames, player.x, player.y, player.dir, playerFrame),
    });
    for (const r of remotes.values()) {
      const frame = r.movingVis ? 1 + (Math.floor(r.animT * WALK_FPS) % 2) : 0;
      dyn.push({
        sortY: r.y,
        draw: () => drawAvatar(r.frames, r.x, r.y, r.target.dir, frame),
      });
    }
    for (const n of npcs) {
      dyn.push({ sortY: n.sortY, draw: (c) => n.draw(c, t) });
    }
    dyn.sort((a, b) => a.sortY - b.sortY);

    const lo = cam.y - 3 * TILE;
    const hi = cam.y + cam.h + 4 * TILE;
    const statics = built.drawables;
    let i = 0;
    let j = 0;
    while (i < statics.length || j < dyn.length) {
      const a = i < statics.length ? statics[i] : null;
      const b = j < dyn.length ? dyn[j] : null;
      const pick = !b || (a !== null && a.sortY <= b.sortY) ? a : b;
      if (pick === a) i++;
      else j++;
      if (pick && pick.sortY >= lo && pick.sortY <= hi) pick.draw(ctx);
    }

    // screen-space pass: labels, bubbles, interaction nudge, minimap
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const r of remotes.values()) drawLabel(r.name, r.status, r.x, r.y);
    for (const n of npcs) drawLabel(n.name, undefined, n.x, n.y);
    if (me.status) drawLabel(me.name, me.status, player.x, player.y);

    // chat / emote bubbles sit above the name pills
    bubbles.prune(nowMs);
    bubbles.draw(
      ctx,
      "me",
      (player.x - cam.x) * ZOOM,
      bubbleTailY(player.y, me.status ? LABEL_H_STATUS : 0),
      nowMs,
      cssW,
      cssH
    );
    for (const [id, r] of remotes) {
      bubbles.draw(
        ctx,
        id,
        (r.x - cam.x) * ZOOM,
        bubbleTailY(r.y, r.status ? LABEL_H_STATUS : LABEL_H),
        nowMs,
        cssW,
        cssH
      );
    }
    for (const n of npcs) {
      bubbles.draw(ctx, n.bubbleId, (n.x - cam.x) * ZOOM, bubbleTailY(n.y, LABEL_H), nowMs, cssW, cssH);
    }

    if (nearBooth) {
      const wx = (nearBooth.spot.x + 2) * TILE;
      const wy = nearBooth.spot.y * TILE - 12;
      const bx = (wx - cam.x) * ZOOM;
      const by = (wy - cam.y) * ZOOM + Math.sin(t * 3) * 3;
      ctx.fillStyle = "rgba(255,253,245,0.95)";
      ctx.strokeStyle = "#E4DFD3";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bx, by, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#D9480F";
      ctx.font = "700 12px Georgia, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", bx, by + 0.5);
    }

    if (minimapOn) drawMinimap();
  };

  // ---------- loop / lifecycle ----------

  let raf = 0;
  let last = performance.now();
  let destroyed = false;
  const tick = (now: number): void => {
    if (destroyed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    render(now);
  };
  raf = requestAnimationFrame(tick);

  const prevTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = "manipulation";

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);

  return {
    setInputEnabled(v: boolean): void {
      inputEnabled = v;
      if (!v) keys.clear();
    },
    setMyBooth(claim: BoothClaim | null): void {
      myClaim = claim;
      rebuild();
    },
    emote(kind: EmoteKind): void {
      bubbles.showEmote("me", kind, performance.now());
      net.sendEmote(kind); // the echo is ignored above, so no double-render
      director.onPlayerEmote(kind, player.x, player.y, npcs);
      if (!firstEmoteDone) {
        firstEmoteDone = true;
        cb.onFirstAction?.("emote");
      }
    },
    showBubble(entityId: string, text: string): void {
      bubbles.showChat(entityId, text, performance.now());
    },
    setMinimap(v: boolean): void {
      minimapOn = v;
    },
    setMuted(ids: string[]): void {
      muted.clear();
      for (const id of ids) {
        muted.add(id);
        bubbles.remove(id); // anything they're mid-saying disappears too
      }
    },
    walkToBooth(spotIndex: number): void {
      const b = built.booths.find((x) => x.spotIndex === spotIndex);
      if (!b) return;
      // Aim at the booth's center; findPath resolves solid targets to the
      // nearest reachable tile, so this walks up to the entrance.
      startPathTo(b.spot.x + 2, b.spot.y + 1);
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.style.cursor = "";
      canvas.style.touchAction = prevTouchAction;
      ro.disconnect();
      unsubNet();
      bubbles.clear();
    },
  };
}

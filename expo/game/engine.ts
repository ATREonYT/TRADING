/**
 * FounderFloor — canvas game engine.
 * Owns the render loop, input, collision, camera, remote players and
 * founder NPCs. Pixel art is rendered at 2x world zoom with image
 * smoothing off; UI text (name labels, the "!" nudge) is drawn in
 * screen space so it stays sharp.
 */

import { TILE } from "../lib/types";
import type {
  BoothInstance,
  Dir,
  GameHandle,
  GameOptions,
  MoveState,
  NetEvent,
  RemotePlayer,
} from "../lib/types";
import { SPRITE_H, SPRITE_W, SpriteBank } from "./sprites";
import type { AvatarFrames } from "./sprites";
import { buildFloor } from "./tilemap";
import type { Cam, Drawable } from "./tilemap";
import { makeNpcs, updateNpcs } from "./npc";

const ZOOM = 2; // world px -> screen px
const SPEED = 140; // player px/s
const LERP_RATE = 12; // remote interpolation, fraction/s
const SEND_INTERVAL = 0.1; // 10 packets/s while moving
const WALK_FPS = 7;

interface Remote {
  name: string;
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

  const built = buildFloor(floor, opts.startups, opts.myStartup);
  const bank = new SpriteBank();
  const myFrames = bank.makeAvatar(me.look);
  const npcs = makeNpcs(built.booths, bank);
  const mapW = built.widthPx;
  const mapH = built.heightPx;

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

  const findSpawn = (): { x: number; y: number } => {
    const cx = Math.floor(floor.width / 2);
    const cy = floor.height - 2;
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

  const spawn = findSpawn();
  const player: MoveState = { x: spawn.x, y: spawn.y, dir: "up", moving: false };
  let playerAnimT = 0;

  // ---------- net ----------

  const remotes = new Map<string, Remote>();
  const presence = (): void => cb.onPresence(1 + remotes.size, net.online);
  const addRemote = (p: RemotePlayer): void => {
    if (p.id === net.selfId || p.id === me.id) return;
    remotes.set(p.id, {
      name: p.name,
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
        presence();
        break;
      case "status":
        if (!ev.online) remotes.clear();
        presence();
        break;
      case "chat":
        break; // chat is the UI's problem
    }
  });
  net.connect(floor.id, me, { ...player });

  let sendAcc = 0;
  let wasMoving = false;

  // ---------- input ----------

  let inputEnabled = true;
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

  const onClick = (e: MouseEvent): void => {
    const r = canvas.getBoundingClientRect();
    const wx = cam.x + (e.clientX - r.left) / ZOOM;
    const wy = cam.y + (e.clientY - r.top) / ZOOM;
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const ptx = Math.floor(player.x / TILE);
    const pty = Math.floor(player.y / TILE);
    for (const b of built.booths) {
      const inRect =
        tx >= b.spot.x && tx < b.spot.x + 4 && ty >= b.spot.y && ty < b.spot.y + 3;
      if (!inRect) continue;
      // walking over is the point: clicks only land if you're already close
      if (withinRing(b, ptx, pty)) cb.onInteract(b);
      return;
    }
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

  // ---------- camera ----------

  const cam: Cam = { x: 0, y: 0, w: cssW / ZOOM, h: cssH / ZOOM };
  const clampAxis = (want: number, map: number, view: number): number =>
    map <= view ? (map - view) / 2 : Math.max(0, Math.min(map - view, want));

  // ---------- per-frame update ----------

  const step = (dt: number): void => {
    // player movement
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
    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      const nd: Dir =
        vx < 0 ? "left" : vx > 0 ? "right" : vy < 0 ? "up" : "down";
      player.dir = nd;
      const nx = player.x + vx * SPEED * dt;
      if (!blocked(nx, player.y)) player.x = nx;
      const ny = player.y + vy * SPEED * dt;
      if (!blocked(player.x, ny)) player.y = ny;
      playerAnimT += dt;
    }
    player.moving = moving;

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
    ctx.fillStyle = "rgba(35,32,26,0.16)";
    ctx.beginPath();
    ctx.ellipse(x, y - 1, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(
      frames[dir][frame],
      Math.round(x - SPRITE_W / 2),
      Math.round(y - SPRITE_H)
    );
  };

  const drawLabel = (text: string, wx: number, wy: number): void => {
    const sx = (wx - cam.x) * ZOOM;
    const sy = (wy - SPRITE_H - cam.y) * ZOOM - 8;
    if (sx < -80 || sx > cssW + 80 || sy < -30 || sy > cssH + 30) return;
    ctx.font = "10px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(text).width;
    const bw = tw + 12;
    const bx = sx - bw / 2;
    const by = sy - 14;
    ctx.fillStyle = "rgba(35,32,26,0.84)";
    ctx.beginPath();
    ctx.moveTo(bx + 7, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + 14, 7);
    ctx.arcTo(bx + bw, by + 14, bx, by + 14, 7);
    ctx.arcTo(bx, by + 14, bx, by, 7);
    ctx.arcTo(bx, by, bx + bw, by, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(text, sx, by + 7.5);
  };

  const render = (nowMs: number): void => {
    const t = nowMs / 1000;
    cam.w = cssW / ZOOM;
    cam.h = cssH / ZOOM;
    cam.x = clampAxis(player.x - cam.w / 2, mapW, cam.w);
    cam.y = clampAxis(player.y - cam.h / 2, mapH, cam.h);

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

    // screen-space pass: labels + interaction nudge
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const r of remotes.values()) drawLabel(r.name, r.x, r.y);
    for (const n of npcs) drawLabel(n.name, n.x, n.y);

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

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  canvas.addEventListener("click", onClick);

  return {
    setInputEnabled(v: boolean): void {
      inputEnabled = v;
      if (!v) keys.clear();
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("click", onClick);
      ro.disconnect();
      unsubNet();
    },
  };
}

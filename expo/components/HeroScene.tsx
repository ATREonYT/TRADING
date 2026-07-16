"use client";

/**
 * HeroScene — a live ambient slice of the Main Hall, drawn on the landing
 * page with the game's real sprite system (SpriteBank avatars + glyphs) and
 * the tilemap's booth proportions. Founders stand at their counters; a few
 * attendees drift through the aisle. Purely decorative — the real floor is
 * walkable at /floor/main-hall.
 *
 * Renders nothing during SSR; all canvas work happens in an effect.
 * Respects prefers-reduced-motion by drawing a single static frame.
 */

import { useEffect, useRef } from "react";
import { TILE } from "@/lib/types";
import type { AvatarLook, Dir, GlyphId } from "@/lib/types";
import {
  SPRITE_H,
  SPRITE_W,
  SpriteBank,
  drawGlyph,
  luma,
  shade,
} from "@/game/sprites";
import type { AvatarFrames } from "@/game/sprites";

const ZOOM = 2; // world px -> css px, same as the game engine
const WALK_FPS = 7;

// Main Hall theme (lib/data/floors.ts) + the tilemap's fixed prop palette.
const THEME = {
  floorA: "#D8D2C4",
  floorB: "#D1CABA",
  wall: "#8A8272",
  trim: "#6F6A5E",
};
const WOOD_TOP = "#D9C79B";
const WOOD_FRONT = "#A28457";
const POT = "#A6633C";
const LEAF_A = "#4C7A4F";
const LEAF_B = "#3A6440";
const CARD = "#FAF7EF";
const CARD_LINE = "#C6BCA4";
const INK = "#23201A";

// Real Main Hall exhibitors (lib/data/startups.ts), so the vignette matches
// what you actually find inside.
interface BoothSpec {
  sign: string;
  glyph: GlyphId;
  banner: string;
  carpet: string;
  founder: AvatarLook;
}

const BOOTH_SPECS: BoothSpec[] = [
  {
    sign: "SOUP TICKET",
    glyph: "flask",
    banner: "#D97742",
    carpet: "#9E3B2B",
    founder: { skin: 3, outfit: 2, hair: 5 },
  },
  {
    sign: "GUTTERBALL",
    glyph: "star",
    banner: "#D9A13B",
    carpet: "#3E5A8C",
    founder: { skin: 0, outfit: 1, hair: 3 },
  },
  {
    sign: "FERNWORKS",
    glyph: "leaf",
    banner: "#7FA65A",
    carpet: "#3F6B4F",
    founder: { skin: 2, outfit: 3, hair: 6 },
  },
];

// Counter clutter slots per booth: [laptop, flyers, mug] in tile slots 0..3.
const SLOT_SETS: [number, number, number][] = [
  [0, 2, 3],
  [3, 1, 0],
  [1, 3, 2],
];

const WANDER_LOOKS: AvatarLook[] = [
  { skin: 1, outfit: 0, hair: 2 },
  { skin: 4, outfit: 5, hair: 7 },
  { skin: 0, outfit: 6, hair: 4 },
  { skin: 5, outfit: 3, hair: 0 },
];

// Booth zone occupies tile rows 1-3 (row 0 is the wall), apron is row 4.
const ZONE_Y = TILE;
const COUNTER_Y = ZONE_Y + 2 * TILE;
const APRON_BOTTOM = ZONE_Y + 4 * TILE;

interface PlacedBooth {
  spec: BoothSpec;
  x: number; // world px, left edge of the 4-tile zone
  slots: [number, number, number];
  founderFrames: AvatarFrames;
  founderX: number;
  founderY: number;
}

interface Npc {
  frames: AvatarFrames;
  x: number;
  y: number; // feet, world px
  tx: number;
  ty: number;
  speed: number;
  dir: Dir;
  moving: boolean;
  animT: number;
  waitUntil: number;
}

interface Plant {
  x: number;
  y: number; // top-left of its tile box, world px
  tall: boolean;
}

export default function HeroScene({ className = "" }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Deterministic tiny PRNG so the reduced-motion still frame is stable.
    let seed = 0x9e3779b9;
    const rand = (): number => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const bank = new SpriteBank();
    const wallDark = shade(THEME.wall, -0.2);

    let dpr = 1;
    let worldW = 0;
    let worldH = 0;
    let bandTop = 0;
    let bandBot = 0;
    let booths: PlacedBooth[] = [];
    let plants: Plant[] = [];
    const npcs: Npc[] = [];
    let raf = 0;

    const pickTarget = (n: Npc): void => {
      n.tx = 16 + rand() * Math.max(1, worldW - 32);
      n.ty = bandTop + rand() * Math.max(1, bandBot - bandTop);
    };

    const layout = (): void => {
      const rect = wrap.getBoundingClientRect();
      const cssW = Math.max(1, Math.floor(rect.width));
      const cssH = Math.max(1, Math.floor(rect.height));
      dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      worldW = cssW / ZOOM;
      worldH = cssH / ZOOM;
      bandTop = APRON_BOTTOM + 8;
      bandBot = Math.max(bandTop + 10, worldH - 8);

      // Booths: 4-tile zones with 4-tile gaps, like the real hall.
      const tilesW = worldW / TILE;
      const xs: number[] = [];
      for (let tx = 2; tx + 4 <= tilesW - 1.5; tx += 8) xs.push(tx);
      if (xs.length === 0) xs.push(Math.max(0, Math.round((tilesW - 4) / 2)));
      booths = xs.map((tx, i) => {
        const spec = BOOTH_SPECS[i % BOOTH_SPECS.length];
        const x = tx * TILE;
        return {
          spec,
          x,
          slots: SLOT_SETS[i % SLOT_SETS.length],
          founderFrames: bank.makeAvatar(spec.founder),
          founderX: x + 2 * TILE + (i % 2 === 0 ? -8 : 10),
          founderY: COUNTER_Y - 4,
        };
      });

      // A potted plant in each gap along the wall, plus the flanks.
      plants = [];
      const plantY = ZONE_Y + 6;
      const first = booths[0];
      if (first && first.x >= 52) plants.push({ x: first.x - 46, y: plantY, tall: true });
      booths.forEach((b, i) => {
        const next = booths[i + 1];
        const gapEnd = next ? next.x : worldW - 8;
        const px = b.x + 4 * TILE + (gapEnd - (b.x + 4 * TILE) - TILE) / 2;
        if (gapEnd - (b.x + 4 * TILE) >= TILE + 16) {
          plants.push({ x: px, y: plantY, tall: i % 2 === 1 });
        }
      });

      if (npcs.length === 0) {
        for (const look of WANDER_LOOKS) {
          const n: Npc = {
            frames: bank.makeAvatar(look),
            x: 0,
            y: 0,
            tx: 0,
            ty: 0,
            speed: 26 + rand() * 18,
            dir: "down",
            moving: false,
            animT: 0,
            waitUntil: rand() * 2,
          };
          n.x = 16 + rand() * Math.max(1, worldW - 32);
          n.y = bandTop + rand() * Math.max(1, bandBot - bandTop);
          pickTarget(n);
          npcs.push(n);
        }
      } else {
        for (const n of npcs) {
          n.x = Math.min(Math.max(n.x, 16), Math.max(16, worldW - 16));
          n.y = Math.min(Math.max(n.y, bandTop), bandBot);
          pickTarget(n);
        }
      }
    };

    const updateNpcs = (dt: number, t: number): void => {
      for (const n of npcs) {
        if (t < n.waitUntil) {
          n.moving = false;
          continue;
        }
        const dx = n.tx - n.x;
        const dy = n.ty - n.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 2) {
          n.moving = false;
          n.waitUntil = t + 1 + rand() * 2.5;
          pickTarget(n);
          continue;
        }
        const step = Math.min(dist, n.speed * dt);
        n.x += (dx / dist) * step;
        n.y += (dy / dist) * step;
        n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
        n.moving = true;
        n.animT += dt;
      }
    };

    // ---------- drawing (all in world px; transform handles dpr * ZOOM) ----------

    const drawAvatar = (
      frames: AvatarFrames,
      x: number,
      y: number,
      dir: Dir,
      frame: number,
    ): void => {
      ctx.fillStyle = "rgba(35,32,26,0.16)";
      ctx.beginPath();
      ctx.ellipse(x, y - 1, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(frames[dir][frame], Math.round(x - SPRITE_W / 2), Math.round(y - SPRITE_H));
    };

    const drawCarpet = (b: PlacedBooth): void => {
      ctx.fillStyle = b.spec.carpet;
      ctx.fillRect(b.x, ZONE_Y, 4 * TILE, 4 * TILE);
      ctx.strokeStyle = shade(b.spec.carpet, -0.16);
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, ZONE_Y + 1, 4 * TILE - 2, 4 * TILE - 2);
    };

    const drawBanner = (b: PlacedBooth): void => {
      const face = b.spec.banner;
      const dark = shade(face, -0.42);
      const fg = luma(face) > 0.62 ? INK : "#FFFDF5";
      ctx.fillStyle = dark;
      ctx.fillRect(b.x, ZONE_Y, 4 * TILE, TILE);
      ctx.fillStyle = face;
      ctx.fillRect(b.x + 3, ZONE_Y - 8, 4 * TILE - 6, TILE + 4);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 4, ZONE_Y - 7, 4 * TILE - 8, TILE + 2);
      drawGlyph(ctx, b.spec.glyph, b.x + 10, ZONE_Y + 1, 14, fg);
      ctx.fillStyle = fg;
      ctx.font = "700 9px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.spec.sign, b.x + 2 * TILE + 7, ZONE_Y + 9, 4 * TILE - 44);
    };

    const drawCounter = (b: PlacedBooth): void => {
      const y0 = COUNTER_Y;
      ctx.fillStyle = WOOD_FRONT;
      ctx.fillRect(b.x, y0 + 12, 4 * TILE, TILE - 12);
      ctx.fillStyle = shade(WOOD_FRONT, -0.24);
      ctx.fillRect(b.x, y0 + TILE - 3, 4 * TILE, 3);
      ctx.fillStyle = WOOD_TOP;
      ctx.fillRect(b.x, y0, 4 * TILE, 12);
      ctx.fillStyle = shade(WOOD_TOP, -0.2);
      ctx.fillRect(b.x, y0 + 12, 4 * TILE, 2);
      const [laptopSlot, flyerSlot, mugSlot] = b.slots;
      const mugColor = shade(b.spec.banner, -0.1);
      // closed laptop
      const lx = b.x + laptopSlot * TILE;
      ctx.fillStyle = "#33302A";
      ctx.fillRect(lx + 8, y0 - 2, 16, 10);
      ctx.fillStyle = "#4A463E";
      ctx.fillRect(lx + 8, y0 - 2, 16, 2);
      ctx.fillStyle = mugColor;
      ctx.fillRect(lx + 15, y0 + 2, 2, 2);
      // flyer stack
      const fx = b.x + flyerSlot * TILE;
      ctx.fillStyle = CARD;
      ctx.fillRect(fx + 10, y0 + 1, 14, 9);
      ctx.strokeStyle = CARD_LINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(fx + 10.5, y0 + 1.5, 13, 8);
      ctx.fillStyle = "#D9480F";
      ctx.fillRect(fx + 12, y0 + 3, 10, 1);
      ctx.fillStyle = "#6F6A5E";
      ctx.fillRect(fx + 12, y0 + 5, 8, 1);
      ctx.fillRect(fx + 12, y0 + 7, 9, 1);
      // mug
      const mx = b.x + mugSlot * TILE;
      ctx.fillStyle = mugColor;
      ctx.fillRect(mx + 13, y0 - 1, 6, 7);
      ctx.fillRect(mx + 19, y0 + 1, 2, 3);
    };

    const drawPlant = (p: Plant): void => {
      const { x, y } = p;
      ctx.fillStyle = shade(POT, -0.25);
      ctx.fillRect(x + 9, y + 24, 14, 3);
      ctx.fillStyle = POT;
      ctx.fillRect(x + 10, y + 17, 12, 8);
      ctx.fillStyle = shade(POT, 0.15);
      ctx.fillRect(x + 8, y + 15, 16, 3);
      const top = p.tall ? y - 2 : y + 3;
      ctx.fillStyle = LEAF_B;
      ctx.fillRect(x + 10, top + 4, 12, 10);
      ctx.fillStyle = LEAF_A;
      ctx.fillRect(x + 12, top, 8, 8);
      ctx.fillRect(x + 7, top + 6, 7, 6);
      ctx.fillRect(x + 18, top + 6, 7, 6);
      ctx.fillStyle = shade(LEAF_A, 0.18);
      ctx.fillRect(x + 14, top + 2, 3, 3);
    };

    const draw = (): void => {
      const s = dpr * ZOOM;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const tilesX = Math.ceil(worldW / TILE);
      const tilesY = Math.ceil(worldH / TILE);
      for (let ty = 0; ty < tilesY; ty++) {
        for (let tx = 0; tx < tilesX; tx++) {
          ctx.fillStyle = (tx + ty) & 1 ? THEME.floorB : THEME.floorA;
          ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
        }
      }
      // back wall
      for (let tx = 0; tx < tilesX; tx++) {
        ctx.fillStyle = THEME.wall;
        ctx.fillRect(tx * TILE, 0, TILE, TILE);
        ctx.fillStyle = THEME.trim;
        ctx.fillRect(tx * TILE, 0, TILE, 5);
        ctx.fillStyle = wallDark;
        ctx.fillRect(tx * TILE, TILE - 3, TILE, 3);
      }
      for (const b of booths) drawCarpet(b);

      const items: { sortY: number; paint(): void }[] = [];
      for (const b of booths) {
        items.push(
          { sortY: ZONE_Y + TILE, paint: () => drawBanner(b) },
          { sortY: COUNTER_Y + TILE, paint: () => drawCounter(b) },
          {
            sortY: b.founderY,
            paint: () => drawAvatar(b.founderFrames, b.founderX, b.founderY, "down", 0),
          },
        );
      }
      for (const p of plants) items.push({ sortY: p.y + TILE, paint: () => drawPlant(p) });
      for (const n of npcs) {
        const frame = n.moving ? 1 + (Math.floor(n.animT * WALK_FPS) % 2) : 0;
        items.push({ sortY: n.y, paint: () => drawAvatar(n.frames, n.x, n.y, n.dir, frame) });
      }
      items.sort((a, b) => a.sortY - b.sortY);
      for (const it of items) it.paint();
    };

    // ---------- loop / lifecycle ----------

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let last = 0;

    const loop = (now: number): void => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      updateNpcs(dt, now / 1000);
      draw();
      raf = requestAnimationFrame(loop);
    };

    const start = (): void => {
      cancelAnimationFrame(raf);
      if (reduceMotion.matches) {
        draw();
      } else {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    const onMotionChange = (): void => start();

    layout();
    start();

    const ro = new ResizeObserver(() => {
      layout();
      if (reduceMotion.matches) draw();
    });
    ro.observe(wrap);
    if (typeof reduceMotion.addEventListener === "function") {
      reduceMotion.addEventListener("change", onMotionChange);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (typeof reduceMotion.removeEventListener === "function") {
        reduceMotion.removeEventListener("change", onMotionChange);
      }
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className={`relative h-[320px] w-full overflow-hidden rounded-md border border-line bg-[#D8D2C4] sm:h-[368px] ${className}`}
    >
      <canvas ref={canvasRef} className="pixelated absolute inset-0 h-full w-full" />
    </div>
  );
}

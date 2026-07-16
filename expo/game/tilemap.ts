/**
 * FounderFloor — tile map builder.
 * Turns a FloorDef + startup roster into collision data and draw lists:
 * checkerboard floor, perimeter walls, booth stalls per the 4x3 convention
 * (banner wall / founder lane / counter, facing down), and deterministic
 * ambient props (plants, benches, a coffee cart, floor mats) seeded from
 * the floor id so every visitor sees the same hall.
 */

import { TILE } from "../lib/types";
import type { BoothInstance, FloorDef, GlyphId, Startup } from "../lib/types";
import { drawGlyph, luma, shade } from "./sprites";

// ---------- shared shapes ----------

/** Camera rect in world px. */
export interface Cam {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A y-sortable world object; the engine merges these with avatars. */
export interface Drawable {
  sortY: number;
  draw(ctx: CanvasRenderingContext2D): void;
}

export interface BuiltFloor {
  widthPx: number;
  heightPx: number;
  /** Occupied booths only (vacant stalls are scenery, not interactable). */
  booths: BoothInstance[];
  /** Tile-coordinate walkability. Out-of-bounds counts as solid. */
  solid(tx: number, ty: number): boolean;
  /** Floor, carpets and mats — everything avatars stand on. */
  drawUnder(ctx: CanvasRenderingContext2D, cam: Cam): void;
  /** Walls, banners, counters, props — pre-sorted by sortY ascending. */
  drawables: Drawable[];
}

// ---------- deterministic randomness ----------

/** FNV-1a string hash -> uint32. */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Tiny seeded PRNG (mulberry32). Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- fixed prop palette (theme-agnostic, warm) ----------

const WOOD_TOP = "#D9C79B";
const WOOD_FRONT = "#A28457";
const POT = "#A6633C";
const LEAF_A = "#4C7A4F";
const LEAF_B = "#3A6440";
const CARD = "#FAF7EF";
const CARD_LINE = "#C6BCA4";
const VACANT_FACE = "#CFC8B8";
const INK = "#23201A";
const MUTED = "#6F6A5E";
const GOLD = "#B08D2E";
const ACCENT = "#D9480F";

const T = TILE;

interface VacantSpot {
  x: number;
  y: number;
  open: boolean; // reserved spot without a user startup -> "OPEN SPOT" sign
}

// ---------- builder ----------

export function buildFloor(
  floor: FloorDef,
  startups: Record<string, Startup>,
  myStartup?: Startup
): BuiltFloor {
  const w = floor.width;
  const h = floor.height;
  const grid = new Uint8Array(w * h); // 1 = solid
  const mark = (tx: number, ty: number): void => {
    if (tx >= 0 && ty >= 0 && tx < w && ty < h) grid[ty * w + tx] = 1;
  };
  const drawables: Drawable[] = [];

  // ----- perimeter walls -----
  const wallTiles: { x: number; y: number }[] = [];
  for (let x = 0; x < w; x++) {
    wallTiles.push({ x, y: 0 }, { x, y: h - 1 });
  }
  for (let y = 1; y < h - 1; y++) {
    wallTiles.push({ x: 0, y }, { x: w - 1, y });
  }
  const wallBody = floor.theme.wall;
  const wallDark = shade(wallBody, -0.2);
  for (const wt of wallTiles) {
    mark(wt.x, wt.y);
    drawables.push({
      sortY: (wt.y + 1) * T,
      draw(ctx) {
        ctx.fillStyle = wallBody;
        ctx.fillRect(wt.x * T, wt.y * T, T, T);
        ctx.fillStyle = floor.theme.trim;
        ctx.fillRect(wt.x * T, wt.y * T, T, 5);
        ctx.fillStyle = wallDark;
        ctx.fillRect(wt.x * T, wt.y * T + T - 3, T, 3);
      },
    });
  }

  // ----- booth assignment -----
  const booths: BoothInstance[] = [];
  const vacants: VacantSpot[] = [];
  let nextStartup = 0;
  floor.boothSpots.forEach((spot, i) => {
    // solid: banner wall, founder lane (players keep out) and counter
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 4; dx++) mark(spot.x + dx, spot.y + dy);
    if (i === floor.reservedSpot) {
      if (myStartup) booths.push({ spot: { x: spot.x, y: spot.y }, startup: myStartup, isYours: true });
      else vacants.push({ x: spot.x, y: spot.y, open: true });
      return;
    }
    const id = floor.startupIds[nextStartup++];
    const s = id !== undefined ? startups[id] : undefined;
    if (s) booths.push({ spot: { x: spot.x, y: spot.y }, startup: s, isYours: false });
    else vacants.push({ x: spot.x, y: spot.y, open: false });
  });

  for (const b of booths) {
    drawables.push(bannerDrawable(b), counterDrawable(b));
  }
  for (const v of vacants) {
    drawables.push(vacantBannerDrawable(v), vacantCounterDrawable(v));
  }

  // ----- ambient props, seeded from floor.id -----
  // Keep clear of: booth rects + their 1-tile interaction ring, the border,
  // and a 2-tile aisle lattice (tiles with x%4<2 or y%4<2 stay empty) so
  // every part of the hall remains reachable on foot.
  const nearBoothRing = (tx: number, ty: number): boolean => {
    for (const s of floor.boothSpots) {
      if (tx >= s.x - 1 && tx <= s.x + 4 && ty >= s.y - 1 && ty <= s.y + 3) return true;
    }
    return false;
  };
  const taken = new Set<number>();
  const canProp = (tx: number, ty: number): boolean =>
    tx >= 1 &&
    ty >= 1 &&
    tx < w - 1 &&
    ty < h - 1 &&
    tx % 4 >= 2 &&
    ty % 4 >= 2 &&
    !nearBoothRing(tx, ty) &&
    grid[ty * w + tx] === 0 &&
    !taken.has(ty * w + tx);

  const rng = mulberry32(hashStr(floor.id));
  const tryPlace = (tw: number, tries: number): { x: number; y: number } | null => {
    for (let i = 0; i < tries; i++) {
      const tx = 1 + Math.floor(rng() * (w - 2));
      const ty = 1 + Math.floor(rng() * (h - 2));
      let ok = true;
      for (let d = 0; d < tw; d++) if (!canProp(tx + d, ty)) ok = false;
      if (!ok) continue;
      for (let d = 0; d < tw; d++) taken.add(ty * w + tx + d);
      return { x: tx, y: ty };
    }
    return null;
  };

  const mats: { x: number; y: number }[] = [];
  const area = w * h;

  // one coffee cart per floor, if it fits
  const cart = tryPlace(2, 60);
  if (cart) {
    mark(cart.x, cart.y);
    mark(cart.x + 1, cart.y);
    drawables.push(cartDrawable(cart.x, cart.y));
  }
  const benchCount = Math.max(1, Math.min(3, Math.floor(area / 260)));
  for (let i = 0; i < benchCount; i++) {
    const p = tryPlace(2, 40);
    if (!p) break;
    mark(p.x, p.y);
    mark(p.x + 1, p.y);
    drawables.push(benchDrawable(p.x, p.y));
  }
  const plantCount = Math.max(2, Math.min(8, Math.floor(area / 110)));
  for (let i = 0; i < plantCount; i++) {
    const p = tryPlace(1, 40);
    if (!p) break;
    mark(p.x, p.y);
    drawables.push(plantDrawable(p.x, p.y, rng()));
  }
  const matCount = Math.max(1, Math.min(4, Math.floor(area / 240)));
  for (let i = 0; i < matCount; i++) {
    const p = tryPlace(2, 40);
    if (!p) break;
    mats.push(p); // walkable — no mark()
  }

  drawables.sort((a, b) => a.sortY - b.sortY);

  // ----- under-layer -----
  const matFill = shade(floor.theme.floorB, -0.1);
  const matLine = shade(floor.theme.floorB, -0.26);
  const drawUnder = (ctx: CanvasRenderingContext2D, cam: Cam): void => {
    const x0 = Math.max(0, Math.floor(cam.x / T));
    const y0 = Math.max(0, Math.floor(cam.y / T));
    const x1 = Math.min(w - 1, Math.floor((cam.x + cam.w) / T));
    const y1 = Math.min(h - 1, Math.floor((cam.y + cam.h) / T));
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        ctx.fillStyle = (tx + ty) & 1 ? floor.theme.floorB : floor.theme.floorA;
        ctx.fillRect(tx * T, ty * T, T, T);
      }
    }
    // carpets: booth zone + 1-tile apron row below (4 x 4 tiles)
    for (const b of booths) drawCarpet(ctx, b.spot.x, b.spot.y, b.startup.booth.carpet);
    for (const v of vacants) drawCarpet(ctx, v.x, v.y, VACANT_FACE);
    // mats
    for (const m of mats) {
      ctx.fillStyle = matFill;
      ctx.fillRect(m.x * T + 3, m.y * T + 4, 2 * T - 6, T - 8);
      ctx.strokeStyle = matLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(m.x * T + 3.5, m.y * T + 4.5, 2 * T - 7, T - 9);
    }
  };

  return {
    widthPx: w * T,
    heightPx: h * T,
    booths,
    solid: (tx: number, ty: number): boolean =>
      tx < 0 || ty < 0 || tx >= w || ty >= h || grid[ty * w + tx] === 1,
    drawUnder,
    drawables,
  };
}

// ---------- booth pieces ----------

function drawCarpet(ctx: CanvasRenderingContext2D, sx: number, sy: number, color: string): void {
  const x = sx * T;
  const y = sy * T;
  const cw = 4 * T;
  const ch = 4 * T; // 3 booth rows + 1 apron row
  ctx.fillStyle = color;
  ctx.fillRect(x, y, cw, ch);
  ctx.strokeStyle = shade(color, -0.16);
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, cw - 2, ch - 2);
}

function bannerDrawable(b: BoothInstance): Drawable {
  const { x: sx, y: sy } = b.spot;
  const th = b.startup.booth;
  const bx = sx * T;
  const by = sy * T;
  const face = th.banner;
  const dark = shade(face, -0.42);
  const fg = luma(face) > 0.62 ? INK : "#FFFDF5";
  const sign = th.sign.toUpperCase();
  const glyph: GlyphId = th.glyph;
  const yours = b.isYours;
  return {
    sortY: (sy + 1) * T,
    draw(ctx) {
      // structural back wall
      ctx.fillStyle = dark;
      ctx.fillRect(bx, by, 4 * T, T);
      // banner face, hung slightly proud of the wall
      ctx.fillStyle = face;
      ctx.fillRect(bx + 3, by - 8, 4 * T - 6, T + 4);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 4, by - 7, 4 * T - 8, T + 2);
      drawGlyph(ctx, glyph, bx + 10, by + 1, 14, fg);
      ctx.fillStyle = fg;
      ctx.font = "700 9px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(sign, bx + 2 * T + 7, by + 9, 4 * T - 44);
      if (yours) {
        ctx.fillStyle = GOLD;
        ctx.fillRect(bx + 3, by + T - 7, 4 * T - 6, 3);
      }
    },
  };
}

function counterDrawable(b: BoothInstance): Drawable {
  const { x: sx, y: sy } = b.spot;
  const bx = sx * T;
  const y0 = (sy + 2) * T;
  const r = mulberry32(hashStr(b.startup.id) ^ 0x9e3779b9);
  const laptopSlot = Math.floor(r() * 4);
  const flyerSlot = (laptopSlot + 1 + Math.floor(r() * 3)) % 4;
  const hasMug = r() < 0.75;
  const mugSlot = (flyerSlot + 1 + Math.floor(r() * 2)) % 4;
  const mugColor = shade(b.startup.booth.banner, -0.1);
  return {
    sortY: (sy + 3) * T,
    draw(ctx) {
      drawCounterBase(ctx, bx, y0);
      // laptop, closed, small badge in booth accent
      const lx = bx + laptopSlot * T;
      ctx.fillStyle = "#33302A";
      ctx.fillRect(lx + 8, y0 - 2, 16, 10);
      ctx.fillStyle = "#4A463E";
      ctx.fillRect(lx + 8, y0 - 2, 16, 2);
      ctx.fillStyle = mugColor;
      ctx.fillRect(lx + 15, y0 + 2, 2, 2);
      // flyer stack
      const fx = bx + flyerSlot * T;
      ctx.fillStyle = CARD;
      ctx.fillRect(fx + 10, y0 + 1, 14, 9);
      ctx.strokeStyle = CARD_LINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(fx + 10.5, y0 + 1.5, 13, 8);
      ctx.fillStyle = ACCENT;
      ctx.fillRect(fx + 12, y0 + 3, 10, 1);
      ctx.fillStyle = MUTED;
      ctx.fillRect(fx + 12, y0 + 5, 8, 1);
      ctx.fillRect(fx + 12, y0 + 7, 9, 1);
      if (hasMug) {
        const mx = bx + mugSlot * T;
        ctx.fillStyle = mugColor;
        ctx.fillRect(mx + 13, y0 - 1, 6, 7);
        ctx.fillRect(mx + 19, y0 + 1, 2, 3);
      }
    },
  };
}

function drawCounterBase(ctx: CanvasRenderingContext2D, bx: number, y0: number): void {
  ctx.fillStyle = WOOD_FRONT;
  ctx.fillRect(bx, y0 + 12, 4 * T, T - 12);
  ctx.fillStyle = shade(WOOD_FRONT, -0.24);
  ctx.fillRect(bx, y0 + T - 3, 4 * T, 3);
  ctx.fillStyle = WOOD_TOP;
  ctx.fillRect(bx, y0, 4 * T, 12);
  ctx.fillStyle = shade(WOOD_TOP, -0.2);
  ctx.fillRect(bx, y0 + 12, 4 * T, 2);
}

function vacantBannerDrawable(v: VacantSpot): Drawable {
  const bx = v.x * T;
  const by = v.y * T;
  const dark = shade(VACANT_FACE, -0.35);
  return {
    sortY: (v.y + 1) * T,
    draw(ctx) {
      ctx.fillStyle = dark;
      ctx.fillRect(bx, by, 4 * T, T);
      ctx.fillStyle = VACANT_FACE;
      ctx.fillRect(bx + 3, by - 8, 4 * T - 6, T + 4);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 4, by - 7, 4 * T - 8, T + 2);
      if (v.open) {
        ctx.fillStyle = INK;
        ctx.font = "700 8px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("OPEN SPOT", bx + 2 * T, by + 9, 4 * T - 20);
      } else {
        ctx.fillStyle = shade(VACANT_FACE, -0.22);
        ctx.fillRect(bx + 2 * T - 8, by + 8, 16, 2);
      }
    },
  };
}

function vacantCounterDrawable(v: VacantSpot): Drawable {
  const bx = v.x * T;
  const y0 = (v.y + 2) * T;
  return {
    sortY: (v.y + 3) * T,
    draw(ctx) {
      drawCounterBase(ctx, bx, y0);
      // a single leftover flyer
      ctx.fillStyle = CARD;
      ctx.fillRect(bx + 2 * T + 6, y0 + 2, 12, 8);
      ctx.strokeStyle = CARD_LINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 2 * T + 6.5, y0 + 2.5, 11, 7);
    },
  };
}

// ---------- props ----------

function plantDrawable(tx: number, ty: number, variant: number): Drawable {
  const x = tx * T;
  const y = ty * T;
  const tall = variant > 0.5;
  return {
    sortY: (ty + 1) * T,
    draw(ctx) {
      // pot
      ctx.fillStyle = shade(POT, -0.25);
      ctx.fillRect(x + 9, y + 24, 14, 3);
      ctx.fillStyle = POT;
      ctx.fillRect(x + 10, y + 17, 12, 8);
      ctx.fillStyle = shade(POT, 0.15);
      ctx.fillRect(x + 8, y + 15, 16, 3);
      // foliage
      const top = tall ? y - 2 : y + 3;
      ctx.fillStyle = LEAF_B;
      ctx.fillRect(x + 10, top + 4, 12, 10);
      ctx.fillStyle = LEAF_A;
      ctx.fillRect(x + 12, top, 8, 8);
      ctx.fillRect(x + 7, top + 6, 7, 6);
      ctx.fillRect(x + 18, top + 6, 7, 6);
      ctx.fillStyle = shade(LEAF_A, 0.18);
      ctx.fillRect(x + 14, top + 2, 3, 3);
    },
  };
}

function benchDrawable(tx: number, ty: number): Drawable {
  const x = tx * T;
  const y = ty * T;
  return {
    sortY: (ty + 1) * T,
    draw(ctx) {
      ctx.fillStyle = shade(WOOD_FRONT, -0.3);
      ctx.fillRect(x + 5, y + 20, 3, 7);
      ctx.fillRect(x + 2 * T - 8, y + 20, 3, 7);
      ctx.fillStyle = WOOD_TOP;
      ctx.fillRect(x + 2, y + 12, 2 * T - 4, 7);
      ctx.fillStyle = shade(WOOD_TOP, -0.2);
      ctx.fillRect(x + 2, y + 19, 2 * T - 4, 2);
      // slat lines
      ctx.fillStyle = shade(WOOD_TOP, -0.12);
      ctx.fillRect(x + 2, y + 15, 2 * T - 4, 1);
    },
  };
}

function cartDrawable(tx: number, ty: number): Drawable {
  const x = tx * T;
  const y = ty * T;
  return {
    sortY: (ty + 1) * T,
    draw(ctx) {
      // awning
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i & 1 ? "#F2EFE7" : ACCENT;
        ctx.fillRect(x + i * 8, y - 8, 8, 7);
      }
      ctx.fillStyle = shade(ACCENT, -0.35);
      ctx.fillRect(x, y - 2, 2 * T, 1);
      // body
      ctx.fillStyle = "#8A6F4B";
      ctx.fillRect(x + 3, y + 6, 2 * T - 6, 18);
      ctx.fillStyle = shade("#8A6F4B", -0.25);
      ctx.fillRect(x + 3, y + 22, 2 * T - 6, 2);
      ctx.fillStyle = WOOD_TOP;
      ctx.fillRect(x + 1, y + 2, 2 * T - 2, 6);
      // kettle + cup on the counter
      ctx.fillStyle = "#3B382F";
      ctx.fillRect(x + 10, y - 4, 8, 7);
      ctx.fillStyle = CARD;
      ctx.fillRect(x + 2 * T - 18, y - 2, 5, 5);
      ctx.fillStyle = MUTED;
      ctx.fillRect(x + 2 * T - 13, y - 1, 2, 2);
      // wheels
      ctx.fillStyle = "#2B2620";
      ctx.fillRect(x + 8, y + 24, 5, 4);
      ctx.fillRect(x + 2 * T - 13, y + 24, 5, 4);
    },
  };
}

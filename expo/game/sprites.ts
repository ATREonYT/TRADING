/**
 * FounderFloor — procedural pixel art.
 * Everything here is drawn once, at init, onto small offscreen canvases.
 * No assets, no dependencies. Flat pixel style with a 1px darker
 * "selective outline" (edge pixels of each shape are shaded down).
 */

import { TILE } from "../lib/types";
import type { AvatarLook, Dir, GlyphId } from "../lib/types";

export const SPRITE_W = 20; // logical px
export const SPRITE_H = 28;

/** Per direction: [idle, stepA, stepB]. */
export type AvatarFrames = Record<Dir, HTMLCanvasElement[]>;

// ---------- palettes (indexed by AvatarLook) ----------

export const SKIN_TONES: string[] = [
  "#F3D3B3", // fair
  "#E9BC93", // light
  "#D3A075", // tan
  "#B27E55", // olive-brown
  "#8C5B3A", // brown
  "#5F3D27", // deep
];

export const OUTFIT_COLORS: string[] = [
  "#D9480F", // persimmon
  "#2F3B52", // ink navy
  "#33623A", // forest
  "#B08D2E", // mustard gold
  "#A85560", // dusty rose
  "#2E6E6A", // teal
  "#3B382F", // charcoal
  "#CFC2A4", // oat cream
];

export const HAIR_COLORS: string[] = [
  "#241F1C", // black       (crop)
  "#4A3120", // chestnut    (long)
  "#C9A24B", // blonde      (bob)
  "#8A4B23", // auburn      (spiky)
  "#1F2A38", // blue-black  (bun)
  "#7A2E1C", // rust        (side sweep)
  "#8C8578", // grey        (buzz)
  "#3A2A20", // dark brown  (curly)
];

// ---------- small color utilities (shared with tilemap) ----------

/** Lighten (amt > 0) or darken (amt < 0) a #RRGGBB hex. amt in -1..1. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (c: number): number => {
    const v = amt >= 0 ? c + (255 - c) * amt : c * (1 + amt);
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Perceptual-ish luminance 0..1 of a #RRGGBB hex. */
export function luma(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// ---------- pixel grid painter ----------

type Grid = (string | null)[];

function newGrid(): Grid {
  return new Array<string | null>(SPRITE_W * SPRITE_H).fill(null);
}

function put(g: Grid, x: number, y: number, c: string): void {
  if (x >= 0 && y >= 0 && x < SPRITE_W && y < SPRITE_H) g[y * SPRITE_W + x] = c;
}

function rect(g: Grid, x: number, y: number, w: number, h: number, c: string): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(g, xx, yy, c);
}

function clr(g: Grid, x: number, y: number): void {
  if (x >= 0 && y >= 0 && x < SPRITE_W && y < SPRITE_H) g[y * SPRITE_W + x] = null;
}

/** Render a grid to a canvas; edge pixels get a darker outline shade. flip mirrors horizontally. */
function renderGrid(g: Grid, flip: boolean): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SPRITE_W;
  c.height = SPRITE_H;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.imageSmoothingEnabled = false;
  const at = (x: number, y: number): string | null =>
    x < 0 || y < 0 || x >= SPRITE_W || y >= SPRITE_H ? null : g[y * SPRITE_W + x];
  for (let y = 0; y < SPRITE_H; y++) {
    for (let x = 0; x < SPRITE_W; x++) {
      const col = at(x, y);
      if (!col) continue;
      const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      ctx.fillStyle = edge ? shade(col, -0.38) : col;
      ctx.fillRect(flip ? SPRITE_W - 1 - x : x, y, 1, 1);
    }
  }
  return c;
}

// ---------- avatar assembly ----------

const SHOE = "#2B2620";
const EYE = "#2A241D";

function paintHair(g: Grid, style: number, dir: Dir, c: string): void {
  const side = dir === "left" || dir === "right";
  const up = dir === "up";
  const cap = (): void => {
    rect(g, 4, 1, 12, 3, c);
    clr(g, 4, 1);
    clr(g, 15, 1);
  };
  switch (style) {
    case 0: // crop
      cap();
      rect(g, 4, 4, 1, 2, c);
      rect(g, 15, 4, 1, 2, c);
      if (up) rect(g, 5, 4, 10, 4, c);
      if (side) rect(g, 4, 3, 3, 3, c);
      break;
    case 1: // long
      cap();
      rect(g, 3, 3, 2, 11, c);
      rect(g, 15, 3, 2, 11, c);
      if (up) rect(g, 4, 4, 12, 10, c);
      if (side) rect(g, 3, 3, 3, 11, c);
      break;
    case 2: // bob with fringe
      cap();
      rect(g, 3, 3, 2, 7, c);
      rect(g, 15, 3, 2, 7, c);
      if (!up) rect(g, 5, 4, 10, 1, c);
      if (up) rect(g, 4, 4, 12, 6, c);
      if (side) {
        rect(g, 3, 3, 3, 7, c);
        rect(g, 12, 3, 3, 2, c);
      }
      break;
    case 3: // spiky
      cap();
      put(g, 5, 0, c);
      put(g, 8, 0, c);
      put(g, 11, 0, c);
      put(g, 14, 0, c);
      if (up) rect(g, 5, 4, 10, 3, c);
      if (side) rect(g, 4, 3, 2, 3, c);
      break;
    case 4: // bun
      cap();
      rect(g, 8, 0, 4, 1, c);
      if (up) {
        rect(g, 5, 4, 10, 4, c);
        rect(g, 8, 0, 4, 2, c);
      }
      if (side) rect(g, 3, 2, 3, 3, c);
      break;
    case 5: // side sweep
      cap();
      rect(g, 9, 4, 7, 2, c);
      rect(g, 15, 6, 1, 2, c);
      if (up) rect(g, 5, 4, 10, 5, c);
      if (side) rect(g, 11, 3, 4, 3, c);
      break;
    case 6: // buzz
      rect(g, 5, 2, 10, 2, shade(c, 0.06));
      if (up) rect(g, 5, 4, 10, 3, shade(c, 0.06));
      if (side) rect(g, 5, 2, 9, 2, shade(c, 0.06));
      break;
    default: // 7 curly
      rect(g, 3, 1, 14, 4, c);
      clr(g, 3, 1);
      clr(g, 16, 1);
      put(g, 6, 0, c);
      put(g, 10, 0, c);
      put(g, 13, 0, c);
      rect(g, 3, 5, 2, 3, c);
      rect(g, 15, 5, 2, 3, c);
      if (up) rect(g, 4, 4, 12, 6, c);
      if (side) rect(g, 3, 3, 4, 6, c);
      break;
  }
}

/**
 * Build one pose. `dir` "left" is drawn as "right" and mirrored at render time.
 * frame: 0 idle, 1 stepA, 2 stepB.
 */
function buildGrid(look: AvatarLook, dir: Dir, frame: number): Grid {
  const g = newGrid();
  const skin = SKIN_TONES[((look.skin % 6) + 6) % 6];
  const outfitIdx = ((look.outfit % 8) + 8) % 8;
  const hairIdx = ((look.hair % 8) + 8) % 8;
  const outfit = OUTFIT_COLORS[outfitIdx];
  const hair = HAIR_COLORS[hairIdx];
  const pants = shade(outfit, -0.42);
  const isSide = dir === "left" || dir === "right";

  if (!isSide) {
    // ---- front / back ----
    const liftL = frame === 1 ? 2 : 0;
    const liftR = frame === 2 ? 2 : 0;
    rect(g, 6, 21, 3, 5 - liftL, pants);
    rect(g, 6, 26 - liftL, 3, 2, SHOE);
    rect(g, 11, 21, 3, 5 - liftR, pants);
    rect(g, 11, 26 - liftR, 3, 2, SHOE);
    // torso
    rect(g, 5, 12, 10, 9, outfit);
    rect(g, 5, 12, 10, 1, shade(outfit, 0.18));
    // arms (opposite swing to legs)
    const swing = frame === 1 ? -1 : frame === 2 ? 1 : 0;
    rect(g, 3, 13 + swing, 2, 6, outfit);
    rect(g, 3, 19 + swing, 2, 2, skin);
    rect(g, 15, 13 - swing, 2, 6, outfit);
    rect(g, 15, 19 - swing, 2, 2, skin);
    // head
    rect(g, 5, 3, 10, 9, skin);
    clr(g, 5, 3);
    clr(g, 14, 3);
    clr(g, 5, 11);
    clr(g, 14, 11);
    if (dir === "down") {
      rect(g, 7, 7, 1, 2, EYE);
      rect(g, 12, 7, 1, 2, EYE);
      rect(g, 9, 10, 2, 1, shade(skin, -0.22));
    }
  } else {
    // ---- profile, facing right (mirrored later for "left") ----
    const back = frame === 1 ? 5 : frame === 2 ? 9 : 7;
    const front = frame === 1 ? 12 : frame === 2 ? 9 : 10;
    rect(g, back, 21, 3, 5, shade(pants, -0.14));
    rect(g, back, 26, 3, 2, shade(SHOE, -0.1));
    rect(g, front, 21, 3, 5, pants);
    rect(g, front, 26, 4, 2, SHOE);
    // torso
    rect(g, 6, 12, 9, 9, outfit);
    rect(g, 6, 12, 9, 1, shade(outfit, 0.18));
    // visible arm swings fore/aft
    const armX = frame === 1 ? 12 : frame === 2 ? 8 : 10;
    rect(g, armX, 13, 2, 6, shade(outfit, 0.1));
    rect(g, armX, 19, 2, 2, skin);
    // head
    rect(g, 5, 3, 10, 9, skin);
    clr(g, 5, 3);
    clr(g, 14, 3);
    clr(g, 5, 11);
    clr(g, 14, 11);
    put(g, 15, 7, skin); // nose
    put(g, 15, 8, skin);
    rect(g, 12, 7, 1, 2, EYE);
  }

  paintHair(g, hairIdx, dir, hair);
  return g;
}

// ---------- sprite bank ----------

const DIRS: Dir[] = ["down", "up", "left", "right"];

export class SpriteBank {
  private cache = new Map<string, AvatarFrames>();

  /** Build (or fetch cached) idle + 2 walk frames for all four directions. */
  makeAvatar(look: AvatarLook): AvatarFrames {
    const key = `${look.skin}|${look.outfit}|${look.hair}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const frames = {} as AvatarFrames;
    for (const dir of DIRS) {
      const src: Dir = dir === "left" ? "right" : dir;
      frames[dir] = [0, 1, 2].map((f) => renderGrid(buildGrid(look, src, f), dir === "left"));
    }
    this.cache.set(key, frames);
    return frames;
  }
}

// ---------- glyphs (8x8 bitmaps) ----------

const GLYPHS: Record<GlyphId, string[]> = {
  bolt: [
    "....XXX.",
    "...XXX..",
    "..XXX...",
    ".XXXXXX.",
    "...XXX..",
    "..XXX...",
    ".XXX....",
    ".XX.....",
  ],
  leaf: [
    "......X.",
    "....XXX.",
    "..XXXXX.",
    ".XXXXXX.",
    ".XXXXX..",
    ".XXXX...",
    "X.X.....",
    ".X......",
  ],
  coin: [
    "..XXXX..",
    ".X....X.",
    ".X.XX.X.",
    ".X.XX.X.",
    ".X.XX.X.",
    ".X.XX.X.",
    ".X....X.",
    "..XXXX..",
  ],
  chip: [
    "X..XX..X",
    "XXXXXXXX",
    ".X....X.",
    "XX.XX.XX",
    "XX.XX.XX",
    ".X....X.",
    "XXXXXXXX",
    "X..XX..X",
  ],
  flask: [
    "..XXXX..",
    "...XX...",
    "...XX...",
    "..X..X..",
    ".X....X.",
    ".X.XX.X.",
    ".XXXXXX.",
    "..XXXX..",
  ],
  rocket: [
    "...XX...",
    "..XXXX..",
    "..XXXX..",
    "..X..X..",
    "..XXXX..",
    ".XXXXXX.",
    "XX.XX.XX",
    "...XX...",
  ],
  heart: [
    ".XX..XX.",
    "XXXXXXXX",
    "XXXXXXXX",
    "XXXXXXXX",
    ".XXXXXX.",
    "..XXXX..",
    "...XX...",
    "........",
  ],
  cube: [
    "XXXXXXXX",
    "X..XX..X",
    "X..XX..X",
    "XXXXXXXX",
    "X..XX..X",
    "X..XX..X",
    "X..XX..X",
    "XXXXXXXX",
  ],
  wave: [
    "........",
    ".XX..XX.",
    "X..XX..X",
    "........",
    ".XX..XX.",
    "X..XX..X",
    "........",
    "........",
  ],
  star: [
    "...XX...",
    "...XX...",
    "XXXXXXXX",
    ".XXXXXX.",
    "..XXXX..",
    ".XXXXXX.",
    ".XX..XX.",
    "XX....XX",
  ],
};

/** Draw one of the ten glyphs from its 8x8 bitmap into a size x size box. */
export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: GlyphId,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  const rows = GLYPHS[glyph];
  const s = size / 8;
  ctx.fillStyle = color;
  for (let r = 0; r < 8; r++) {
    const row = rows[r];
    for (let c = 0; c < 8; c++) {
      if (row.charAt(c) === "X") ctx.fillRect(x + c * s, y + r * s, s, s);
    }
  }
}

/** Re-exported so callers sizing glyphs against tiles don't need two imports. */
export { TILE };

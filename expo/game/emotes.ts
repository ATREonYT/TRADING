/**
 * FounderFloor — hand-drawn pixel reactions.
 * Each emote is a 10x10 bitmap in the game's own palette, drawn the same way
 * the avatars and booths are — so reactions look like they belong to this
 * world instead of whatever emoji font the OS ships. Used by the in-world
 * bubble renderer (canvas) and the emote bar (data-URL <img>).
 */

import type { EmoteKind } from "../lib/types";

/** Shared palette. '.' = transparent. Warm outline, not pure black. */
const PAL: Record<string, string> = {
  d: "#3B3226", // outline
  s: "#E8B88A", // skin
  S: "#C98F5F", // skin shade
  l: "#8A8272", // motion line
  y: "#F2C14E", // face yellow
  k: "#23201A", // ink (eyes/mouth)
  w: "#FFFDF5", // white
  h: "#C92A2A", // heart red
  H: "#E5636B", // heart highlight
  q: "#D9480F", // accent (question mark)
  r: "#57829B", // rocket window
  f: "#C4562B", // flame outer
  o: "#F2A93B", // flame mid
  Y: "#FFF3BF", // flame core
  a: "#3B5B92", // sleeve blue
  b: "#4E6E4E", // sleeve green
  g: "#B9B2A2", // rocket body shade
};

/** 10 rows x 10 cols. Drawn top to bottom. */
const ART: Record<EmoteKind, string[]> = {
  wave: [
    "..d.d.d...",
    ".dsdsdsd.l",
    ".dsssssdl.",
    "dsdsssssd.",
    "dssssssdl.",
    ".dssssssd.",
    ".dsssssd..",
    "..dssssd..",
    "...dssd...",
    "....dd....",
  ],
  laugh: [
    "..dddddd..",
    ".dyyyyyyd.",
    "dyyyyyyyyd",
    "dykyyyykyd",
    "dyyyyyyyyd",
    "dykkkkkkyd",
    "dykwwwwkyd",
    ".dykkkkyd.",
    "..dyyyyd..",
    "...dddd...",
  ],
  clap: [
    ".l..ll..l.",
    "..l.ll.l..",
    "..dsddsd..",
    ".dssdsssd.",
    ".dssdsssd.",
    ".dsssdssd.",
    ".dssdsssd.",
    "..dsddsd..",
    "..dSddSd..",
    "...d..d...",
  ],
  heart: [
    ".dd....dd.",
    "dhhd..dhhd",
    "dhHhddhhhd",
    "dHhhhhhhhd",
    "dhhhhhhhhd",
    ".dhhhhhhd.",
    "..dhhhhd..",
    "...dhhd...",
    "....dd....",
    "..........",
  ],
  question: [
    "..ddddd...",
    ".dqqqqqd..",
    ".dqdddqqd.",
    "..d..dqqd.",
    "....dqqd..",
    "...dqqd...",
    "...dqd....",
    "...ddd....",
    "...dqd....",
    "...ddd....",
  ],
  rocket: [
    "....dd....",
    "...dwwd...",
    "...dwwd...",
    "..dwwwwd..",
    "..dwrrwd..",
    "..dwwwwd..",
    ".ddgwwgdd.",
    "dffdwwdffd",
    "..dfoofd..",
    "...oYYo...",
  ],
  fire: [
    "....df....",
    "...dff.f..",
    "..dfffdfd.",
    ".dffoffff.",
    ".dfooooff.",
    "dfoooooofd",
    "dfooYYoofd",
    ".dfoYYoof.",
    "..dfYYfd..",
    "...dffd...",
  ],
  handshake: [
    "..........",
    "aad....dbb",
    "aaad..dbbb",
    ".aadddddb.",
    ".adssssdb.",
    "..dsSssd..",
    ".adssssdb.",
    ".aadddddb.",
    "aaad..dbbb",
    "aad....dbb",
  ],
};

export const EMOTE_PX = 10; // native bitmap size

/** Draw an emote icon with its top-left at (x, y), scaled to `size` px. */
export function drawEmoteIcon(
  ctx: CanvasRenderingContext2D,
  kind: EmoteKind,
  x: number,
  y: number,
  size: number,
): void {
  const rows = ART[kind];
  const px = size / EMOTE_PX;
  for (let r = 0; r < EMOTE_PX; r++) {
    const row = rows[r];
    for (let c = 0; c < EMOTE_PX; c++) {
      const color = PAL[row[c]];
      if (!color) continue;
      ctx.fillStyle = color;
      // overlap by a hair to avoid seams at fractional scales
      ctx.fillRect(x + c * px, y + r * px, px + 0.02, px + 0.02);
    }
  }
}

/** Cached data-URL renders for DOM <img> use (emote bar, tooltips). */
const urlCache = new Map<string, string>();

export function emoteDataUrl(kind: EmoteKind, size = 20): string {
  if (typeof document === "undefined") return "";
  const key = `${kind}:${size}`;
  const hit = urlCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  // render at 2x for crispness on hidpi screens
  canvas.width = size * 2;
  canvas.height = size * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.imageSmoothingEnabled = false;
  drawEmoteIcon(ctx, kind, 0, 0, size * 2);
  const url = canvas.toDataURL();
  urlCache.set(key, url);
  return url;
}

"use client";

/**
 * Pixel-accurate booth preview for the customization menu — draws the same
 * banner / counter / carpet the tilemap renders in-game, plus the founder
 * standing in their lane, so what you save is exactly what the floor shows.
 */

import { useEffect, useRef } from "react";
import type { AvatarLook, CarpetPattern, GlyphId } from "@/lib/types";
import { TILE } from "@/lib/types";
import { SPRITE_H, SPRITE_W, SpriteBank, drawGlyph, luma, shade } from "@/game/sprites";

const INK = "#23201A";
const WOOD_TOP = "#C9B990";
const WOOD_FRONT = "#A08B62";

export interface BoothPreviewProps {
  carpet: string;
  banner: string;
  sign: string;
  glyph: GlyphId;
  pattern: CarpetPattern;
  /** Custom banner icon (tiny data-URL PNG). Replaces the glyph when set. */
  logo?: string;
  founderLook: AvatarLook;
  /** Hall floor colors behind the stand (defaults: Main Hall). */
  floorA?: string;
  floorB?: string;
}

export default function BoothPreview({
  carpet,
  banner,
  sign,
  glyph,
  pattern,
  logo,
  founderLook,
  floorA = "#D8D2C4",
  floorB = "#D1CABA",
}: BoothPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bankRef = useRef<SpriteBank | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!bankRef.current) bankRef.current = new SpriteBank();

    // world: 6 tiles wide (booth + 1 tile margin each side), 5.5 tiles tall
    const worldW = 6 * TILE;
    const worldH = 5.5 * TILE;
    const cssW = canvas.clientWidth || 240;
    const zoom = cssW / worldW;
    const cssH = Math.round(worldH * zoom);
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = `${cssH}px`;

    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // hall floor checker behind the stand
    for (let ty = 0; ty < 6; ty++) {
      for (let tx = 0; tx < 6; tx++) {
        ctx.fillStyle = (tx + ty) & 1 ? floorB : floorA;
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }

    // booth zone: top-left tile (1, 0.75) in this little world
    const sx = 1;
    const syPx = 0.75 * TILE;
    const bx = sx * TILE;

    // carpet: 4 tiles wide, 4 tall (3 zone rows + apron), same as drawCarpet
    const cw = 4 * TILE;
    const ch = 4 * TILE;
    ctx.fillStyle = carpet;
    ctx.fillRect(bx, syPx, cw, ch);
    if (pattern === "stripes") {
      ctx.fillStyle = shade(carpet, -0.08);
      for (let i = 0; i < 4; i += 2) ctx.fillRect(bx + i * TILE, syPx, TILE, ch);
    } else if (pattern === "border") {
      ctx.strokeStyle = shade(carpet, 0.14);
      ctx.lineWidth = 3;
      ctx.strokeRect(bx + 5.5, syPx + 5.5, cw - 11, ch - 11);
    }
    ctx.strokeStyle = shade(carpet, -0.16);
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 1, syPx + 1, cw - 2, ch - 2);

    // banner (matches bannerDrawable)
    const dark = shade(banner, -0.42);
    const fg = luma(banner) > 0.62 ? INK : "#FFFDF5";
    ctx.fillStyle = dark;
    ctx.fillRect(bx, syPx, 4 * TILE, TILE);
    ctx.fillStyle = banner;
    ctx.fillRect(bx + 3, syPx - 8, 4 * TILE - 6, TILE + 4);
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 4, syPx - 7, 4 * TILE - 8, TILE + 2);
    if (logo) {
      // data-URL decode is async; guard so a stale load never paints over a
      // newer render of this effect
      let stale = false;
      const img = new Image();
      img.onload = () => {
        if (stale) return;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, bx + 8, syPx, 16, 16);
      };
      img.src = logo;
      cleanupRef.current = () => {
        stale = true;
      };
    } else {
      drawGlyph(ctx, glyph, bx + 10, syPx + 1, 14, fg);
    }
    ctx.fillStyle = fg;
    ctx.font = "700 9px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(sign.toUpperCase() || "YOUR SIGN", bx + 2 * TILE + 7, syPx + 9, 4 * TILE - 44);

    // founder in the lane, facing front
    const frames = bankRef.current.makeAvatar(founderLook);
    const fx = bx + 2 * TILE;
    const fy = syPx + 2 * TILE - 6;
    ctx.fillStyle = "rgba(35,32,26,0.16)";
    ctx.beginPath();
    ctx.ellipse(fx, fy - 1, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(frames.down[0], Math.round(fx - SPRITE_W / 2), Math.round(fy - SPRITE_H));

    // counter (matches drawCounterBase) + a flyer stack
    const y0 = syPx + 2 * TILE;
    ctx.fillStyle = WOOD_FRONT;
    ctx.fillRect(bx, y0 + 12, 4 * TILE, TILE - 12);
    ctx.fillStyle = shade(WOOD_FRONT, -0.24);
    ctx.fillRect(bx, y0 + TILE - 3, 4 * TILE, 3);
    ctx.fillStyle = WOOD_TOP;
    ctx.fillRect(bx, y0, 4 * TILE, 12);
    ctx.fillStyle = shade(WOOD_TOP, -0.2);
    ctx.fillRect(bx, y0 + 12, 4 * TILE, 2);
    ctx.fillStyle = "#FFFDF5";
    ctx.fillRect(bx + 2 * TILE + 6, y0 + 2, 14, 9);
    ctx.strokeStyle = "#D9D2C2";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 2 * TILE + 6.5, y0 + 2.5, 13, 8);

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [carpet, banner, sign, glyph, pattern, logo, founderLook, floorA, floorB]);

  return (
    <canvas
      ref={canvasRef}
      className="pixelated w-full rounded-md border border-line"
      aria-label="Live preview of your booth as it renders on the floor"
    />
  );
}

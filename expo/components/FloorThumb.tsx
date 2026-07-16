"use client";

/**
 * FloorThumb — a static miniature of a FloorDef: checkerboard in the floor's
 * theme colors, perimeter wall, and one trim-colored block per booth zone
 * (the reserved spot, if any, is picked out in gold). No animation; drawn
 * once per prop change. Decorative — the adjacent text names the floor.
 */

import { useEffect, useRef } from "react";
import type { FloorDef } from "@/lib/types";

const GOLD = "#B08D2E";

interface FloorThumbProps {
  floor: FloorDef;
  width?: number;
  height?: number;
  className?: string;
}

export default function FloorThumb({
  floor,
  width = 120,
  height = 80,
  className = "",
}: FloorThumbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);

    const s = Math.min(width / floor.width, height / floor.height);
    const ox = Math.floor((width - floor.width * s) / 2);
    const oy = Math.floor((height - floor.height * s) / 2);
    // Snap tile edges to whole pixels so the checker stays crisp and seamless.
    const px = (t: number): number => Math.round(ox + t * s);
    const py = (t: number): number => Math.round(oy + t * s);
    const tileRect = (tx0: number, ty0: number, tx1: number, ty1: number, color: string): void => {
      ctx.fillStyle = color;
      ctx.fillRect(px(tx0), py(ty0), px(tx1) - px(tx0), py(ty1) - py(ty0));
    };

    // checker floor
    for (let ty = 0; ty < floor.height; ty++) {
      for (let tx = 0; tx < floor.width; tx++) {
        tileRect(tx, ty, tx + 1, ty + 1, (tx + ty) & 1 ? floor.theme.floorB : floor.theme.floorA);
      }
    }
    // perimeter wall
    tileRect(0, 0, floor.width, 1, floor.theme.wall);
    tileRect(0, floor.height - 1, floor.width, floor.height, floor.theme.wall);
    tileRect(0, 1, 1, floor.height - 1, floor.theme.wall);
    tileRect(floor.width - 1, 1, floor.width, floor.height - 1, floor.theme.wall);
    // booth zones (4x3, facing down); the reserved spot reads gold
    floor.boothSpots.forEach((spot, i) => {
      const color = i === floor.reservedSpot ? GOLD : floor.theme.trim;
      tileRect(spot.x, spot.y, spot.x + 4, spot.y + 3, color);
    });
  }, [floor, width, height]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ width, height }}
      className={`pixelated shrink-0 ${className}`}
    />
  );
}

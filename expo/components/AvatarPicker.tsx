"use client";

import { useEffect, useRef } from "react";
import type { AvatarLook } from "@/lib/types";

/**
 * Self-contained avatar palettes and pixel preview.
 * Deliberately does NOT import game/sprites — the picker only needs
 * representative colors, indexed the same way (skin 0..5, outfit 0..7, hair 0..7).
 */

export const SKIN_TONES: string[] = [
  "#F6D3B3",
  "#EBB98B",
  "#D19A66",
  "#B07445",
  "#8D5524",
  "#5C3A21",
];

export const OUTFIT_COLORS: string[] = [
  "#3B5B92",
  "#4E6E4E",
  "#8C3B2E",
  "#6B4E71",
  "#2F6F6A",
  "#A98C5B",
  "#555049",
  "#B08D2E",
];

export const HAIR_COLORS: string[] = [
  "#201A14",
  "#4A3623",
  "#7A5230",
  "#B08D57",
  "#99342C",
  "#D8C6A0",
  "#7E7A73",
  "#3E4A5A",
];

function darken(hex: string, f = 0.72): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 0xff) * f);
  const g = Math.round(((n >> 8) & 0xff) * f);
  const b = Math.round((n & 0xff) * f);
  return `rgb(${r},${g},${b})`;
}

/** Draws a 12x16 pixel person onto a canvas context at the given pixel scale. */
export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  look: AvatarLook,
  s: number,
): void {
  const skin = SKIN_TONES[look.skin % SKIN_TONES.length];
  const outfit = OUTFIT_COLORS[look.outfit % OUTFIT_COLORS.length];
  const hair = HAIR_COLORS[look.hair % HAIR_COLORS.length];
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x * s, y * s, w * s, h * s);
  };

  ctx.clearRect(0, 0, 12 * s, 16 * s);
  // hair
  px(2, 0, 8, 2, hair);
  px(1, 1, 10, 2, hair);
  px(1, 3, 2, 2, hair);
  px(9, 3, 2, 2, hair);
  // face
  px(3, 3, 6, 4, skin);
  // eyes
  px(4, 5, 1, 1, "#23201A");
  px(7, 5, 1, 1, "#23201A");
  // torso
  px(2, 7, 8, 6, outfit);
  // arms + hands
  px(1, 7, 1, 4, outfit);
  px(10, 7, 1, 4, outfit);
  px(1, 11, 1, 1, skin);
  px(10, 11, 1, 1, skin);
  // legs
  px(3, 13, 2, 2, darken(outfit));
  px(7, 13, 2, 2, darken(outfit));
  // shoes
  px(3, 15, 2, 1, "#23201A");
  px(7, 15, 2, 1, "#23201A");
}

export function AvatarPreview({
  look,
  scale = 5,
  className = "",
}: {
  look: AvatarLook;
  scale?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawAvatar(ctx, look, scale);
  }, [look.skin, look.outfit, look.hair, scale]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <canvas
      ref={ref}
      width={12 * scale}
      height={16 * scale}
      className={`pixelated ${className}`}
      role="img"
      aria-label="Avatar preview"
    />
  );
}

function SwatchRow({
  label,
  colors,
  value,
  onPick,
}: {
  label: string;
  colors: string[];
  value: number;
  onPick: (i: number) => void;
}) {
  return (
    <div>
      <span className="micro mb-1.5 block text-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c, i) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(i)}
            aria-label={`${label} option ${i + 1}`}
            aria-pressed={value === i}
            className={`h-6 w-6 rounded-sm border ${
              value === i
                ? "border-accent ring-2 ring-accent ring-offset-1 ring-offset-panel"
                : "border-line hover:border-muted"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

/** Avatar look picker: pixel preview canvas + three swatch rows. */
export default function AvatarPicker({
  look,
  onChange,
}: {
  look: AvatarLook;
  onChange: (look: AvatarLook) => void;
}) {
  return (
    <div className="flex items-start gap-5">
      <div className="panel flex items-center justify-center p-3">
        <AvatarPreview look={look} scale={5} />
      </div>
      <div className="flex flex-col gap-3">
        <SwatchRow
          label="Skin"
          colors={SKIN_TONES}
          value={look.skin % SKIN_TONES.length}
          onPick={(skin) => onChange({ ...look, skin })}
        />
        <SwatchRow
          label="Outfit"
          colors={OUTFIT_COLORS}
          value={look.outfit % OUTFIT_COLORS.length}
          onPick={(outfit) => onChange({ ...look, outfit })}
        />
        <SwatchRow
          label="Hair"
          colors={HAIR_COLORS}
          value={look.hair % HAIR_COLORS.length}
          onPick={(hair) => onChange({ ...look, hair })}
        />
      </div>
    </div>
  );
}

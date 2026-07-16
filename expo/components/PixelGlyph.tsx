import type { GlyphId } from "@/lib/types";

/** All ten booth glyphs, in picker order. */
export const GLYPH_IDS: GlyphId[] = [
  "bolt",
  "leaf",
  "coin",
  "chip",
  "flask",
  "rocket",
  "heart",
  "cube",
  "wave",
  "star",
];

/** 8x8 bitmaps — "#" is a lit pixel. */
const BITMAPS: Record<GlyphId, string[]> = {
  bolt: [
    "....##..",
    "...##...",
    "..##....",
    ".#####..",
    "...##...",
    "..##....",
    ".##.....",
    ".#......",
  ],
  leaf: [
    "....####",
    "..######",
    ".#######",
    ".######.",
    ".#####..",
    "..###...",
    ".##.....",
    "#.......",
  ],
  coin: [
    "..####..",
    ".#....#.",
    "#..##..#",
    "#..#...#",
    "#..##..#",
    "#...#..#",
    ".#.##.#.",
    "..####..",
  ],
  chip: [
    "..#..#..",
    ".######.",
    ".#....#.",
    "##.##.##",
    "##.##.##",
    ".#....#.",
    ".######.",
    "..#..#..",
  ],
  flask: [
    "...##...",
    "...##...",
    "..#..#..",
    "..#..#..",
    ".#....#.",
    ".######.",
    ".######.",
    "..####..",
  ],
  rocket: [
    "...##...",
    "..####..",
    "..####..",
    "..####..",
    ".######.",
    ".#.##.#.",
    "#..##..#",
    "...##...",
  ],
  heart: [
    ".##..##.",
    "########",
    "########",
    "########",
    ".######.",
    "..####..",
    "...##...",
    "........",
  ],
  cube: [
    "...##...",
    ".##..##.",
    "#......#",
    "#.#..#.#",
    "#.#..#.#",
    "#.#..#.#",
    ".##..##.",
    "...##...",
  ],
  wave: [
    "........",
    ".##.....",
    "#..#..#.",
    "....##..",
    "........",
    ".##.....",
    "#..#..#.",
    "....##..",
  ],
  star: [
    "...##...",
    "...##...",
    ".######.",
    "..####..",
    "..####..",
    ".#.##.#.",
    ".#....#.",
    "........",
  ],
};

interface PixelGlyphProps {
  glyph: GlyphId;
  color?: string;
  /** Rendered size in px (the glyph is an 8x8 grid). */
  size?: number;
  className?: string;
}

/** Tiny pixel glyph rendered as crisp SVG rects. Server-safe. */
export default function PixelGlyph({
  glyph,
  color = "#23201A",
  size = 16,
  className = "",
}: PixelGlyphProps) {
  const rows = BITMAPS[glyph];
  const rects: JSX.Element[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (rows[y][x] === "#") {
        rects.push(
          <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />,
        );
      }
    }
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={`pixelated shrink-0 ${className}`}
    >
      {rects}
    </svg>
  );
}

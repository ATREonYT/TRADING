/**
 * FounderFloor — chat & emote bubbles.
 * One live bubble per entity ("me", a remote player's wire id, or
 * "npc:<startupId>"); showing a new one replaces the old. Drawn in the
 * engine's screen-space pass so text stays crisp: paper rounded rect,
 * hairline border, ink text, small tail. Chat bubbles hold ~5s with a
 * gentle rise-in and a 300ms fade-out; emote bubbles pop in over 250ms
 * and hold ~2.5s.
 */

const PAPER = "#FFFDF5";
const HAIRLINE = "#E4DFD3";
const INK = "#23201A";

import type { EmoteKind } from "../lib/types";
import { drawEmoteIcon } from "./emotes";

const FONT = "11px system-ui, -apple-system, Segoe UI, sans-serif";
const MAX_TEXT_W = 150; // px, wrap width
const MAX_LINES = 3;
const LINE_H = 14;
const PAD_X = 8;
const PAD_Y = 6;
const TAIL_H = 5;

const CHAT_TTL = 5000;
const FADE_MS = 300;
const RISE_MS = 220;
const RISE_PX = 6;

const EMOTE_TTL = 2500;
const POP_MS = 250;
const EMOTE_R = 14;
const EMOTE_FADE_MS = 150;

interface Bubble {
  kind: "chat" | "emote";
  text: string; // chat text; for emotes, the EmoteKind
  born: number; // ms clock (performance.now)
  ttl: number;
  lines: string[] | null; // chat layout, computed lazily on first draw
  width: number; // widest laid-out line, px
}

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

/** Slight overshoot for the emote pop-in. f(0)=0, f(1)=1. */
const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
};

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export class BubbleManager {
  private bubbles = new Map<string, Bubble>();

  /** Show (or replace) a word-wrapped speech bubble for this entity. */
  showChat(entityId: string, text: string, now: number): void {
    const t = text.trim();
    if (!t) return;
    this.bubbles.set(entityId, {
      kind: "chat",
      text: t,
      born: now,
      ttl: CHAT_TTL,
      lines: null,
      width: 0,
    });
  }

  /** Show (or replace) an emote pop bubble with the hand-drawn pixel icon. */
  showEmote(entityId: string, emote: EmoteKind, now: number): void {
    this.bubbles.set(entityId, {
      kind: "emote",
      text: emote,
      born: now,
      ttl: EMOTE_TTL,
      lines: null,
      width: 0,
    });
  }

  /** Drop this entity's bubble (e.g. the player left the floor). */
  remove(entityId: string): void {
    this.bubbles.delete(entityId);
  }

  clear(): void {
    this.bubbles.clear();
  }

  /** Drop every expired bubble — covers entities that are gone or off-screen. */
  prune(now: number): void {
    for (const [id, b] of this.bubbles) {
      if (now - b.born >= b.ttl) this.bubbles.delete(id);
    }
  }

  /**
   * Draw this entity's bubble with its tail tip at (cx, tailY), both in
   * CSS px (screen space). No-op if the entity has no live bubble.
   * viewW/viewH are the canvas CSS size, used for cheap culling.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    entityId: string,
    cx: number,
    tailY: number,
    now: number,
    viewW: number,
    viewH: number
  ): void {
    const b = this.bubbles.get(entityId);
    if (!b) return;
    const age = now - b.born;
    if (age >= b.ttl) {
      this.bubbles.delete(entityId);
      return;
    }
    if (cx < -120 || cx > viewW + 120 || tailY < -90 || tailY > viewH + 110) return;
    if (b.kind === "chat") this.drawChat(ctx, b, cx, tailY, age);
    else this.drawEmote(ctx, b, cx, tailY, age);
  }

  // ---------- chat ----------

  private layout(ctx: CanvasRenderingContext2D, b: Bubble): string[] {
    ctx.font = FONT;
    const fits = (s: string): boolean => ctx.measureText(s).width <= MAX_TEXT_W;
    const lines: string[] = [];
    let cur = "";
    const words = b.text.split(/\s+/);
    for (let wi = 0; wi < words.length; wi++) {
      let word = words[wi];
      // hard-split words that alone exceed the wrap width
      while (!fits(word) && word.length > 1) {
        let cut = word.length - 1;
        while (cut > 1 && !fits(word.slice(0, cut))) cut--;
        if (cur) {
          lines.push(cur);
          cur = "";
        }
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const trial = cur ? `${cur} ${word}` : word;
      if (fits(trial)) {
        cur = trial;
      } else {
        if (cur) lines.push(cur);
        cur = word;
      }
    }
    if (cur) lines.push(cur);
    if (lines.length > MAX_LINES) {
      lines.length = MAX_LINES;
      let last = lines[MAX_LINES - 1];
      while (last.length > 0 && !fits(`${last}…`)) last = last.slice(0, -1);
      lines[MAX_LINES - 1] = `${last}…`;
    }
    let w = 0;
    for (const ln of lines) w = Math.max(w, ctx.measureText(ln).width);
    b.lines = lines;
    b.width = Math.min(MAX_TEXT_W, Math.ceil(w));
    return lines;
  }

  private drawChat(
    ctx: CanvasRenderingContext2D,
    b: Bubble,
    cx: number,
    tailY: number,
    age: number
  ): void {
    const lines = b.lines ?? this.layout(ctx, b);
    const fadeStart = b.ttl - FADE_MS;
    const alpha = age > fadeStart ? Math.max(0, 1 - (age - fadeStart) / FADE_MS) : 1;
    const rise = age < RISE_MS ? (1 - easeOut(age / RISE_MS)) * RISE_PX : 0;
    const w = b.width + PAD_X * 2;
    const h = lines.length * LINE_H + PAD_Y * 2 - 2;
    const x = Math.round(cx - w / 2);
    const y = Math.round(tailY - TAIL_H - h + rise);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = HAIRLINE;
    ctx.lineWidth = 1;
    roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 6);
    ctx.fill();
    ctx.stroke();

    // tail: filled wedge covers the border seam, then the two slanted edges
    ctx.beginPath();
    ctx.moveTo(cx - 4, y + h - 2);
    ctx.lineTo(cx, y + h + TAIL_H - 1);
    ctx.lineTo(cx + 4, y + h - 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 4.5, y + h - 1);
    ctx.lineTo(cx, y + h + TAIL_H - 1);
    ctx.lineTo(cx + 4.5, y + h - 1);
    ctx.stroke();

    ctx.fillStyle = INK;
    ctx.font = FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], cx, y + PAD_Y - 1 + i * LINE_H + LINE_H / 2, MAX_TEXT_W);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- emote ----------

  private drawEmote(
    ctx: CanvasRenderingContext2D,
    b: Bubble,
    cx: number,
    tailY: number,
    age: number
  ): void {
    const s = age < POP_MS ? Math.max(0.01, easeOutBack(age / POP_MS)) : 1;
    const fadeStart = b.ttl - EMOTE_FADE_MS;
    const alpha = age > fadeStart ? Math.max(0, 1 - (age - fadeStart) / EMOTE_FADE_MS) : 1;

    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(cx, tailY - TAIL_H - EMOTE_R);
    ctx.scale(s, s);
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = HAIRLINE;
    ctx.lineWidth = 1 / s;
    ctx.beginPath();
    ctx.arc(0, 0, EMOTE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // small tail
    ctx.beginPath();
    ctx.moveTo(-3, EMOTE_R - 1.5);
    ctx.lineTo(0, EMOTE_R + TAIL_H - 1);
    ctx.lineTo(3, EMOTE_R - 1.5);
    ctx.closePath();
    ctx.fill();
    // the reaction itself: our own pixel art, not the OS emoji font
    const iconSize = 20;
    drawEmoteIcon(ctx, b.text as EmoteKind, -iconSize / 2, -iconSize / 2, iconSize);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

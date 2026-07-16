/**
 * FounderFloor — founder NPCs.
 * One founder stands in the lane behind each occupied booth counter.
 * They shuffle a little, pause a lot, and turn to face you when you
 * walk up. Movement cadence is derived from the startup id, so a
 * given founder always fidgets the same way.
 */

import { TILE } from "../lib/types";
import type { BoothInstance, Dir } from "../lib/types";
import { SPRITE_H, SPRITE_W } from "./sprites";
import type { AvatarFrames, SpriteBank } from "./sprites";
import { hashStr, mulberry32 } from "./tilemap";

const NOTICE_RADIUS = 2.5 * TILE;
const EDGE_PAD = 12; // keep feet off the stall side walls

export class Npc {
  readonly booth: BoothInstance;
  readonly name: string;

  x: number;
  y: number; // feet position, world px
  dir: Dir = "down";
  moving = false;

  private frames: AvatarFrames;
  private rng: () => number;
  private speed: number;
  private restless: number; // 0..1 — how little they like standing still
  private bobSeed: number;
  private minX: number;
  private maxX: number;
  private targetX: number;
  private pause: number;
  private animT = 0;

  constructor(booth: BoothInstance, bank: SpriteBank) {
    this.booth = booth;
    this.name = booth.startup.founder;
    this.frames = bank.makeAvatar(booth.startup.founderLook);
    this.minX = booth.spot.x * TILE + EDGE_PAD;
    this.maxX = (booth.spot.x + 4) * TILE - EDGE_PAD;
    // feet near the bottom of the founder-lane row
    this.y = (booth.spot.y + 2) * TILE - 6;
    this.rng = mulberry32(hashStr(booth.startup.id));
    this.speed = 20 + this.rng() * 22;
    this.restless = this.rng();
    this.bobSeed = this.rng() * Math.PI * 2;
    this.x = this.minX + this.rng() * (this.maxX - this.minX);
    this.targetX = this.x;
    this.pause = 0.5 + this.rng() * 2.5;
  }

  update(dt: number, playerX: number, playerY: number): void {
    if (this.moving) this.animT += dt;

    // face the player when they come close; hold still while they're here
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    if (dx * dx + dy * dy < NOTICE_RADIUS * NOTICE_RADIUS) {
      this.moving = false;
      this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      this.pause = Math.max(this.pause, 0.8);
      return;
    }

    if (this.pause > 0) {
      this.pause -= dt;
      this.moving = false;
      this.dir = "down"; // watch the aisle
      if (this.pause <= 0) {
        const span = (this.rng() * 2 - 1) * TILE * (0.7 + this.restless * 1.5);
        this.targetX = Math.min(this.maxX, Math.max(this.minX, this.x + span));
      }
      return;
    }

    const d = this.targetX - this.x;
    if (Math.abs(d) < 1.5) {
      this.x = this.targetX;
      this.moving = false;
      this.dir = "down";
      this.pause = 1 + this.rng() * (2 + (1 - this.restless) * 5);
      return;
    }
    this.moving = true;
    this.dir = d > 0 ? "right" : "left";
    this.x += Math.sign(d) * this.speed * dt;
  }

  get sortY(): number {
    return this.y;
  }

  /** timeSec drives the idle bob; the engine passes its clock through. */
  draw(ctx: CanvasRenderingContext2D, timeSec: number): void {
    ctx.fillStyle = "rgba(35,32,26,0.16)";
    ctx.beginPath();
    ctx.ellipse(this.x, this.y - 1, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    const bob = this.moving ? 0 : Math.round(Math.sin(timeSec * 2.1 + this.bobSeed) * 0.9);
    const frame = this.moving ? 1 + (Math.floor(this.animT * 6) % 2) : 0;
    ctx.drawImage(
      this.frames[this.dir][frame],
      Math.round(this.x - SPRITE_W / 2),
      Math.round(this.y - SPRITE_H) + bob
    );
  }
}

/** One NPC per occupied booth (vacant stalls get nobody, which is the point).
 * The player's own booth gets no NPC either — the owner is present in person. */
export function makeNpcs(booths: BoothInstance[], bank: SpriteBank): Npc[] {
  return booths.filter((b) => !b.isYours).map((b) => new Npc(b, bank));
}

/** Advance every NPC one frame; the engine calls this before drawing. */
export function updateNpcs(npcs: Npc[], dt: number, playerX: number, playerY: number): void {
  for (const n of npcs) n.update(dt, playerX, playerY);
}

/**
 * FounderFloor — founder NPCs.
 * One founder stands in the lane behind each occupied booth counter.
 * They shuffle a little, pause a lot, and turn to face you when you
 * walk up. Movement cadence is derived from the startup id, so a
 * given founder always fidgets the same way.
 *
 * The AmbientDirector layers "liveness" on top: staggered idle lines
 * (GameOptions.idleLines), short conversations between neighboring
 * founders, and waving back at a nearby player's wave — all surfaced
 * through hooks the engine wires to its bubble renderer.
 */

import { TILE } from "../lib/types";
import type { BoothInstance, Dir, EmoteKind, Startup } from "../lib/types";
import { SPRITE_H, SPRITE_W } from "./sprites";
import type { AvatarFrames, SpriteBank } from "./sprites";
import { hashStr, mulberry32 } from "./tilemap";

const NOTICE_RADIUS = 2.5 * TILE;
const EDGE_PAD = 12; // keep feet off the stall side walls

export class Npc {
  readonly booth: BoothInstance;
  readonly name: string;
  readonly startupId: string;
  /** Bubble entity id the engine uses for this NPC ("npc:<startupId>"). */
  readonly bubbleId: string;

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

  constructor(booth: BoothInstance, startup: Startup, bank: SpriteBank) {
    this.booth = booth;
    this.name = startup.founder;
    this.startupId = startup.id;
    this.bubbleId = `npc:${startup.id}`;
    this.frames = bank.makeAvatar(startup.founderLook);
    this.minX = booth.spot.x * TILE + EDGE_PAD;
    this.maxX = (booth.spot.x + 4) * TILE - EDGE_PAD;
    // feet near the bottom of the founder-lane row
    this.y = (booth.spot.y + 2) * TILE - 6;
    this.rng = mulberry32(hashStr(startup.id));
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
    // Half-world-pixel grid (matches the engine's snapW) — smooth shuffling.
    const px = Math.round(this.x * 2) / 2;
    const py = Math.round(this.y * 2) / 2;
    ctx.fillStyle = "rgba(35,32,26,0.16)";
    ctx.beginPath();
    ctx.ellipse(px, py - 1, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    const bob = this.moving ? 0 : Math.round(Math.sin(timeSec * 2.1 + this.bobSeed) * 0.9);
    const frame = this.moving ? 1 + (Math.floor(this.animT * 6) % 2) : 0;
    ctx.drawImage(this.frames[this.dir][frame], px - SPRITE_W / 2, py - SPRITE_H + bob);
  }
}

/** One NPC per seed booth. Vacant stands get nobody, and claimed stands get
 * nobody either — their owner (you, or a live remote player) is present in person. */
export function makeNpcs(booths: BoothInstance[], bank: SpriteBank): Npc[] {
  const staffed: Npc[] = [];
  for (const b of booths) {
    if (b.startup && !b.isYours && !b.ownerId) staffed.push(new Npc(b, b.startup, bank));
  }
  return staffed;
}

/** Advance every NPC one frame; the engine calls this before drawing. */
export function updateNpcs(npcs: Npc[], dt: number, playerX: number, playerY: number): void {
  for (const n of npcs) n.update(dt, playerX, playerY);
}

// ---------- ambient life ----------

/** How the director surfaces speech and reactions; the engine wires these
 * to its bubble renderer. */
export interface AmbientHooks {
  say(npc: Npc, line: string): void;
  emote(npc: Npc, kind: EmoteKind): void;
}

interface SpeakerState {
  nextSayAt: number; // director-clock seconds
  lineIdx: number;
  waveReadyAt: number; // wave-back cooldown
}

interface ScheduledEmote {
  at: number;
  npc: Npc;
  kind: EmoteKind;
}

const CONVERSE_RANGE = 4 * TILE;
const WAVE_BACK_RANGE = 3 * TILE;
const CHAT_HOLD = 5.4; // seconds a chat bubble occupies its booth
const EMOTE_HOLD = 2.7;
const CONVERSE_CHANCE = 0.55;
const CONVERSE_EMOTES: EmoteKind[] = ["wave", "laugh", "question"];

/**
 * Schedules NPC idle chatter and reactions. State is keyed by startup id
 * and booth spot, so it survives floor rebuilds (the Npc instances are
 * replaced, the cadence isn't). Purely dt-driven — no timers to clean up.
 */
export class AmbientDirector {
  private clock = 0;
  private states = new Map<string, SpeakerState>();
  private busyUntil = new Map<number, number>(); // spotIndex -> clock seconds
  private queue: ScheduledEmote[] = [];
  private rng: () => number;

  constructor(
    private idleLines: Record<string, string[]>,
    private hooks: AmbientHooks
  ) {
    this.rng = mulberry32(0xa11ce5);
  }

  private stateFor(npc: Npc): SpeakerState {
    let s = this.states.get(npc.startupId);
    if (!s) {
      // hash-staggered first line (4-30s in) so founders never sync up
      const h = hashStr(npc.startupId);
      s = {
        nextSayAt: this.clock + 4 + (h % 260) / 10,
        lineIdx: h % 97,
        waveReadyAt: 0,
      };
      this.states.set(npc.startupId, s);
    }
    return s;
  }

  private boothBusy(spotIndex: number): boolean {
    const until = this.busyUntil.get(spotIndex);
    return until !== undefined && until > this.clock;
  }

  private markBusy(spotIndex: number, until: number): void {
    const prev = this.busyUntil.get(spotIndex) ?? 0;
    this.busyUntil.set(spotIndex, Math.max(prev, until));
  }

  /** Nearest other NPC within range whose booth isn't mid-bubble. */
  private partnerFor(npc: Npc, npcs: Npc[]): Npc | null {
    let best: Npc | null = null;
    let bestD = CONVERSE_RANGE * CONVERSE_RANGE;
    for (const other of npcs) {
      if (other === npc) continue;
      if (this.boothBusy(other.booth.spotIndex)) continue;
      const dx = other.x - npc.x;
      const dy = other.y - npc.y;
      const d = dx * dx + dy * dy;
      if (d <= bestD) {
        bestD = d;
        best = other;
      }
    }
    return best;
  }

  /** Advance ambient scheduling one frame. Pass the CURRENT npc list —
   * rebuilds replace the instances and stale queue entries are dropped. */
  update(dt: number, npcs: Npc[]): void {
    this.clock += dt;

    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      if (this.clock < q.at) continue;
      this.queue.splice(i, 1);
      if (npcs.indexOf(q.npc) !== -1) this.hooks.emote(q.npc, q.kind);
    }

    for (const npc of npcs) {
      const st = this.stateFor(npc);
      if (this.clock < st.nextSayAt) continue;
      const lines = this.idleLines[npc.startupId];
      if (!lines || lines.length === 0) {
        st.nextSayAt = Infinity;
        continue;
      }
      if (this.boothBusy(npc.booth.spotIndex)) {
        st.nextSayAt = this.clock + 2 + this.rng() * 3;
        continue;
      }
      st.nextSayAt = this.clock + 25 + this.rng() * 35;
      st.lineIdx = (st.lineIdx + 1) % lines.length;
      this.hooks.say(npc, lines[st.lineIdx]);
      this.markBusy(npc.booth.spotIndex, this.clock + CHAT_HOLD);

      // neighbors sometimes react a beat later
      if (this.rng() < CONVERSE_CHANCE) {
        const partner = this.partnerFor(npc, npcs);
        if (partner) {
          const kind = CONVERSE_EMOTES[Math.floor(this.rng() * CONVERSE_EMOTES.length)];
          this.queue.push({ at: this.clock + 1, npc: partner, kind });
          this.markBusy(partner.booth.spotIndex, this.clock + 1 + EMOTE_HOLD);
          const ps = this.stateFor(partner);
          ps.nextSayAt = Math.max(ps.nextSayAt, this.clock + 1 + EMOTE_HOLD + 1);
        }
      }
    }
  }

  /** The local player emoted; founders within 3 tiles wave back at a wave. */
  onPlayerEmote(kind: EmoteKind, playerX: number, playerY: number, npcs: Npc[]): void {
    if (kind !== "wave") return;
    for (const npc of npcs) {
      const dx = npc.x - playerX;
      const dy = npc.y - playerY;
      if (dx * dx + dy * dy > WAVE_BACK_RANGE * WAVE_BACK_RANGE) continue;
      const st = this.stateFor(npc);
      if (this.clock < st.waveReadyAt) continue;
      st.waveReadyAt = this.clock + 8;
      this.queue.push({ at: this.clock + 0.5 + this.rng() * 0.4, npc, kind: "wave" });
      this.markBusy(npc.booth.spotIndex, this.clock + 1 + EMOTE_HOLD);
    }
  }
}

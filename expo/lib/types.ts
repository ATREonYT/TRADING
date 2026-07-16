/**
 * FounderFloor — shared contracts.
 * Every module (game engine, net layer, UI, data) compiles against this file.
 * Keep it dependency-free.
 */

// ---------- movement / avatars ----------

export type Dir = "up" | "down" | "left" | "right";

export interface MoveState {
  x: number; // world px
  y: number;
  dir: Dir;
  moving: boolean;
}

/** Indexes into the sprite palette tables in game/sprites.ts. */
export interface AvatarLook {
  skin: number; // 0..5
  outfit: number; // 0..7
  hair: number; // 0..7
}

export interface PlayerProfile {
  id: string; // stable local uuid, persisted
  name: string;
  look: AvatarLook;
}

// ---------- ranks ----------

export type RankId = 0 | 1 | 2 | 3 | 4;

export interface RankDef {
  id: RankId;
  name: string;
  /** Minimum verified monthly revenue (USD) to hold this rank. */
  minRevenue: number;
  color: string; // hex used for the badge
  blurb: string; // one dry sentence shown in tooltips
}

// ---------- startups & booths ----------

export type GlyphId =
  | "bolt"
  | "leaf"
  | "coin"
  | "chip"
  | "flask"
  | "rocket"
  | "heart"
  | "cube"
  | "wave"
  | "star";

export type CarpetPattern = "solid" | "border" | "stripes";

export interface BoothTheme {
  carpet: string; // hex
  banner: string; // hex
  sign: string; // short text on the banner, <= 12 chars
  glyph: GlyphId;
  /** Carpet treatment; absent = "solid" (all seed booths). */
  pattern?: CarpetPattern;
}

export interface DialogueScript {
  greeting: string;
  /** Keyword-matched replies; first topic whose keyword appears in the message wins. */
  topics: { keywords: string[]; reply: string }[];
  fallback: string;
  connectReply: string;
}

export interface Startup {
  id: string;
  name: string;
  oneLiner: string;
  pitch: string; // 2-3 sentences, shown in the booth card
  founder: string; // rep standing at the booth
  founderLook: AvatarLook;
  category: string;
  goal: string; // human-readable goal, e.g. "Reach $5k MRR"
  goalProgress: number; // 0..1 verified progress toward the goal
  verifiedRevenue: number; // monthly USD, drives rank; 0 = unverified
  seekingCofounder: boolean;
  /** Absent for user-created startups — replyFor() falls back to generic replies. */
  dialogue?: DialogueScript;
  booth: BoothTheme;
}

export interface BoothInstance {
  /** Top-left tile of the 4x3 booth zone. */
  spot: { x: number; y: number };
  /** Index into floor.boothSpots — the stable identity used for claims. */
  spotIndex: number;
  /** null = vacant stand, open to claim. */
  startup: Startup | null;
  isYours: boolean;
  /** Wire id of the live player whose claimed stand this is (unset for seed booths). */
  ownerId?: string;
}

/** A player's claim on a floor spot, carried over the wire. */
export interface BoothClaim {
  spotIndex: number;
  startup: Startup;
}

// ---------- floors (the "servers" you join) ----------

export type SubTier = "free" | "pro" | "founder";

export const TIER_ORDER: Record<SubTier, number> = { free: 0, pro: 1, founder: 2 };

export interface FloorDef {
  id: string;
  name: string;
  tagline: string;
  tier: SubTier; // minimum subscription tier required to enter
  width: number; // tiles
  height: number; // tiles
  theme: {
    floorA: string; // checker tile A
    floorB: string; // checker tile B
    wall: string;
    trim: string;
  };
  /** Top-left tiles of 4x3 booth zones. Booths face down (entrance at the bottom). */
  boothSpots: { x: number; y: number }[];
  /** Assigned to boothSpots in order; may be shorter than boothSpots. */
  startupIds: string[];
  /** Index into boothSpots reserved for the local user's own booth, if any. */
  reservedSpot?: number;
}

// ---------- chat ----------

export interface ChatMsg {
  id: string;
  fromId: string; // player id, or "npc:<startupId>"
  from: string; // display name
  text: string;
  ts: number;
  scope: "floor" | "dm";
  /** For dm: the other party (peer) id from the local player's perspective. */
  peerId?: string;
}

// ---------- net ----------

export interface RemotePlayer {
  id: string;
  name: string;
  look: AvatarLook;
  s: MoveState;
}

export type NetEvent =
  | { t: "welcome"; selfId: string; players: RemotePlayer[]; booths: RemoteBooth[] }
  | { t: "player_join"; player: RemotePlayer }
  | { t: "player_move"; id: string; s: MoveState }
  | { t: "player_leave"; id: string }
  | { t: "booth_set"; ownerId: string; claim: BoothClaim }
  | { t: "booth_clear"; ownerId: string }
  /** Sent only to a claimant whose spot was already taken. */
  | { t: "booth_denied"; spotIndex: number }
  | { t: "chat"; msg: ChatMsg }
  | { t: "status"; online: boolean; count: number };

export interface RemoteBooth {
  ownerId: string;
  claim: BoothClaim;
}

/**
 * Transport to the floor server. lib/net.ts exports
 * `createNetClient(wsUrl?: string): NetClient` (default ws://localhost:3001).
 * If the socket can't connect it stays silently offline: `online` is false,
 * sends are no-ops, and a {t:"status", online:false, count:1} event fires —
 * the game then runs single-player with NPC founders only.
 */
export interface NetClient {
  readonly online: boolean;
  readonly selfId: string;
  connect(floorId: string, me: PlayerProfile, spawn: MoveState, claim?: BoothClaim): void;
  disconnect(): void;
  sendMove(s: MoveState): void;
  sendChat(text: string, scope: "floor" | "dm", peerId?: string): void;
  /** Claim (or move) this player's stand; the server relays booth_set to the room. */
  sendBoothSet(claim: BoothClaim): void;
  /** Pack up this player's stand; the server relays booth_clear to the room. */
  sendBoothClear(): void;
  /** Subscribe to events; returns an unsubscribe function. */
  on(cb: (ev: NetEvent) => void): () => void;
}

// ---------- game engine ----------

export interface GameCallbacks {
  /** Fired when the player enters/leaves a booth's interaction zone (null = left). */
  onNearBooth(b: BoothInstance | null): void;
  /** Fired when the player presses E/Enter or clicks the nearby booth. */
  onInteract(b: BoothInstance): void;
  /** Presence updates for the HUD. count includes yourself; online = ws connected. */
  onPresence(count: number, online: boolean): void;
}

export interface GameOptions {
  canvas: HTMLCanvasElement;
  floor: FloorDef;
  me: PlayerProfile;
  /** The user's own startup (also present in `startups`). */
  myStartup?: Startup;
  /** This player's claimed spot on this floor, if any; rendered as their stand. */
  myClaim?: BoothClaim;
  /** All startups by id (seed data + the user's own). */
  startups: Record<string, Startup>;
  net: NetClient;
  cb: GameCallbacks;
}

/**
 * game/engine.ts exports `createGame(opts: GameOptions): GameHandle`.
 * The engine owns the canvas render loop, keyboard input, collision, camera,
 * NPC founders (wandering near their booths), remote player rendering, and
 * live claimed-booth updates (booth_set / booth_clear / player_leave).
 */
export interface GameHandle {
  destroy(): void;
  /** Disable movement keys while a text input is focused. */
  setInputEnabled(v: boolean): void;
  /** Update the local player's stand (claim, move, or null = pack up) and rebuild the floor. */
  setMyBooth(claim: BoothClaim | null): void;
}

// ---------- client persistence (lib/store.ts) ----------

export interface Connection {
  startupId?: string;
  name: string; // startup or person name at time of connecting
  founder?: string;
  ts: number;
  floorId: string;
}

export interface AppState {
  profile: PlayerProfile;
  sub: SubTier;
  connections: Connection[];
  myStartup?: Startup;
  /** Claimed stand per floor: floorId -> boothSpots index. */
  claims: Record<string, number>;
}

export const TILE = 32; // px per tile — single source of truth

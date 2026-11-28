export type ResourceKind = 'food' | 'wood' | 'crystal';
export type Resources = Record<ResourceKind, number>;
export type Cost = Partial<Resources>;
export type RaceId = 'sancak' | 'kul' | 'yaprak' | 'tasocak';

export const T_GRASS = 0;
export const T_TREE = 1;
export const T_BUSH = 2;
export const T_CRYSTAL = 3;

export interface UnitDef {
  name: string; cls: string; cost: Cost; hp: number; damage: number; range: number;
  speed: number; sight: number; trainTime: number; pop: number;
}
export interface BuildingDef {
  name: string; cost: Cost; hp: number; size: number; buildTime: number; pop: number;
  trains: string[]; age: number; sight: number;
}
export interface RaceDef {
  name: string; gather: Resources; farm: number; unitCost: Record<string, number>;
  trainTime: number; buildingHp: number; techCost: number; loot: boolean; caravan: boolean;
  /** Multipliers on unit hit points and movement speed; flat bonuses to archer range and infantry armour. */
  unitHp: number; speed: number; archerRange: number; infantryArmor: number;
}

export type Order =
  | { kind: 'idle' }
  | { kind: 'move'; x: number; y: number }
  | { kind: 'gather'; tile: number; terrain: number }
  | { kind: 'farm'; building: number }
  | { kind: 'build'; building: number }
  | { kind: 'attack'; target: number; building: boolean }
  | { kind: 'attackMove'; x: number; y: number }
  /** skip: tiles found unreachable, so the scout does not keep trying them. */
  | { kind: 'explore'; skip: number[] };

export interface Unit {
  id: number; owner: number; type: string; x: number; y: number; hp: number;
  /** Position at the start of the current tick. Combat decisions read these, so the order units are processed in cannot matter. */
  px: number; py: number;
  order: Order; path: number[] | null; pathIdx: number; pathKey: string;
  /** Seconds until the next attack. */
  cooldown: number;
  /** Unit id picked automatically to fight, 0 if none. */
  target: number;
  /** Multiplier on base hp and damage (hero level, camp tier). */
  scale: number;
  /** Index into Game.camps for neutral beasts, -1 otherwise. */
  camp: number;
  /** Race multiplier on hit points, fixed when the unit is created. */
  hpMult: number;
}

/** Owner id of neutral creatures. */
export const NEUTRAL = -1;

export interface Camp { x: number; y: number; tier: number; alive: number; respawnAt: number }
export interface Fog { explored: Uint8Array; visible: Uint8Array }

export interface QueueItem { unit: string; remaining: number; total: number }

export interface Building {
  id: number; owner: number; type: string; tx: number; ty: number; hp: number; maxHp: number;
  /** 0..1; a building works only when progress reaches 1. */
  progress: number;
  queue: QueueItem[];
  autoVillager: boolean;
  /** Where newly trained villagers go: a resource tile index, or -1. */
  rallyTile: number;
  /** Unit id working this farm, 0 if none. */
  worker: number;
  /** Age advance ('age2') or technology being researched here. */
  research: { id: string; remaining: number; total: number } | null;
}

export interface Player {
  id: number; race: RaceId; name: string; isAI: boolean;
  /** AI temperament; empty for a human. */
  personality: Personality; res: Resources; age: number; alive: boolean;
  heroLevel: number; heroXp: number;
  /** Game time at which a fallen hero returns, -1 while alive. */
  heroRespawn: number;
  upgrades: string[];
  /** Game time at which the last Ana Merkez was lost, -1 while one stands. */
  tcLostAt: number;
}

export interface GameEvent { time: number; player: number; kind: string; text: string; x?: number; y?: number }

export interface Game {
  seed: number; tick: number; time: number; w: number; h: number;
  terrain: Uint8Array; amount: Float32Array;
  /** Building id occupying each tile, 0 if none. */
  occ: Int32Array;
  mapVersion: number;
  units: Unit[]; buildings: Building[]; players: Player[];
  nextId: number; events: GameEvent[];
  /** Tile positions of each player's start, used by map generation and AI. */
  bases: { x: number; y: number }[];
  center: { x: number; y: number };
  difficulty: Difficulty;
  camps: Camp[];
  fog: Fog[];
  fogVersion: number;
  /** war[a][b] is true once a and b are fighting. */
  war: boolean[][];
  /** Game time at which the peace period ends. */
  peaceEnd: number;
  relic: Relic;
  /** Winning player once the match is decided, -1 before that. */
  winner: number;
  winKind: '' | 'conquest' | 'relic';
  diplo: Diplo;
  ai: AIState[];
  /** Units brought to zero this tick; they are removed once every unit has acted. */
  fallen: { unit: Unit; killer: number }[];
}

export interface Pact {
  until: number;
  /** Game time at which an announced termination takes effect, -1 if none. */
  endsAt: number;
  /** Player who gave notice, -1 if none. */
  endedBy: number;
}

export interface Diplo {
  /** Symmetric relation between two players, -100..100. */
  relation: number[][];
  /** Public trust score per player, 0..100. */
  trust: number[];
  pacts: (Pact | null)[][];
  /** Until when a player is branded a traitor and cannot make agreements. */
  traitorUntil: number[];
  /** Until when the others stand united against a player. */
  coalitionUntil: number[];
  giftWindow: { start: number; relation: number }[][];
  giftTrustAt: number[];
  /** Pact offers waiting for a human answer. */
  offers: { from: number; to: number; expires: number }[];
}

export interface AIState {
  nextThink: number; nextStrategy: number;
  /** Player this AI is marching against, -1 if none. */
  enemy: number;
  goal: 'none' | 'attack' | 'relic';
  /** Per-match temperament, 0.8..1.2: scales how large an army this AI wants before it moves. */
  nerve: number;
  lastVillager: number; lastBuild: number; lastOffer: number[];
  /** Player seen blocking the relic at the previous strategy tick, -1 if none. */
  blocker: number;
}

export interface Relic {
  x: number; y: number;
  /** Player holding the relic, -1 if nobody. */
  owner: number;
  /** Player currently capturing, -1 if nobody. */
  captor: number;
  progress: number;
  /** Seconds the current owner's hold has counted towards victory. */
  held: number;
  /** Whether the hold timer is advancing this tick (the owner is on guard and unchallenged). */
  counting: boolean;
}

export type Personality = '' | 'trader' | 'expander';
export interface PlayerSetup { race: RaceId; isAI: boolean; name?: string; personality?: Personality }
export type Difficulty = 'cirak' | 'kasif' | 'komutan';
export interface GameOptions {
  seed: number; players: PlayerSetup[]; peaceSeconds?: number;
  /** How fast the AI neighbours grow and how much help human players get. Defaults to 'komutan' (full speed, no help). */
  difficulty?: Difficulty;
  /** Rotates which start position each seat gets (0 = seat 0 at the top). */
  seatOffset?: number;
}

export type ResourceKind = 'food' | 'wood' | 'crystal';
export type Resources = Record<ResourceKind, number>;
export type Cost = Partial<Resources>;
export type RaceId = 'sancak' | 'kul';

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
  order: Order; path: number[] | null; pathIdx: number; pathKey: string;
  /** Seconds until the next attack. */
  cooldown: number;
  /** Unit id picked automatically to fight, 0 if none. */
  target: number;
  /** Multiplier on base hp and damage (hero level, camp tier). */
  scale: number;
  /** Index into Game.camps for neutral beasts, -1 otherwise. */
  camp: number;
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
}

export interface Player {
  id: number; race: RaceId; name: string; isAI: boolean; res: Resources; age: number; alive: boolean;
  heroLevel: number; heroXp: number;
  /** Game time at which a fallen hero returns, -1 while alive. */
  heroRespawn: number;
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
  camps: Camp[];
  fog: Fog[];
  fogVersion: number;
  /** war[a][b] is true once a and b are fighting. */
  war: boolean[][];
}

export interface PlayerSetup { race: RaceId; isAI: boolean; name?: string }
export interface GameOptions { seed: number; players: PlayerSetup[] }

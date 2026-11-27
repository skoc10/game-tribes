import { CFG } from '../src/sim/data';
import { addUnit, createGame } from '../src/sim/state';
import { step } from '../src/sim/step';
import type { Game, RaceId, Unit } from '../src/sim/types';

export const newGame = (seed = 1, races: RaceId[] = ['sancak', 'kul', 'sancak']): Game =>
  createGame({ seed, players: races.map((race, i) => ({ race, isAI: i > 0 })) });

export const run = (s: Game, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * CFG.tickRate); i++) step(s);
};

export const unitsOf = (s: Game, player: number, type: string): Unit[] =>
  s.units.filter((u) => u.owner === player && u.type === type);

export const tcOf = (s: Game, player: number) => s.buildings.find((b) => b.owner === player && b.type === 'towncenter')!;

/** Spawns n units of a type in a row starting at (x, y). */
export const squad = (s: Game, player: number, type: string, n: number, x: number, y: number): Unit[] =>
  Array.from({ length: n }, (_, i) => addUnit(s, player, type, x + 0.5, y + i + 0.5));

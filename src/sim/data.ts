import unitsJson from '../data/units.json';
import buildingsJson from '../data/buildings.json';
import racesJson from '../data/races.json';
import configJson from '../data/config.json';
import type { BuildingDef, Cost, Player, RaceDef, RaceId, ResourceKind, UnitDef } from './types';

export const UNITS = unitsJson as Record<string, UnitDef>;
export const BUILDINGS = buildingsJson as Record<string, BuildingDef>;
export const RACES = racesJson as Record<RaceId, RaceDef>;
export const CFG = configJson;
export const DT = 1 / CFG.tickRate;
export const KINDS: ResourceKind[] = ['food', 'wood', 'crystal'];

export function unitCost(p: Player, type: string): Cost {
  const race = RACES[p.race];
  const mult = (race.unitCost['*'] ?? 1) * (race.unitCost[type] ?? 1);
  const out: Cost = {};
  for (const k of KINDS) {
    const v = UNITS[type].cost[k];
    if (v) out[k] = Math.round(v * mult);
  }
  return out;
}

export function trainTime(p: Player, type: string): number {
  return UNITS[type].trainTime * RACES[p.race].trainTime;
}

export function canAfford(p: Player, cost: Cost): boolean {
  return KINDS.every((k) => p.res[k] >= (cost[k] ?? 0));
}

export function pay(p: Player, cost: Cost): void {
  for (const k of KINDS) p.res[k] -= cost[k] ?? 0;
}

import { findSite, look } from './ai';
import { issue, setOrder } from './commands';
import { BUILDINGS, CFG, canAfford } from './data';
import { nearestNode } from './state';
import { T_BUSH, T_TREE, type Game, type Unit } from './types';

/** Human players on the easier levels have their villagers trained and put to work for them. */
export const helped = (s: Game, player: number): boolean => !s.players[player].isAI && CFG.difficulty[s.difficulty].helper;

/** How often idle villagers of helped players are looked after, in ticks. */
const EVERY = 50;

/**
 * Sends a villager to food or wood, whichever fewer of its owner's villagers are working on.
 * Food means a free farm first, then bushes; when both are gone it builds a farm, so the food
 * supply does not silently end when the bushes do.
 */
export function sendToWork(s: Game, u: Unit): void {
  let food = 0, wood = 0;
  for (const o of s.units) {
    if (o.owner !== u.owner || o.type !== 'villager' || o === u) continue;
    if (o.order.kind === 'farm' || (o.order.kind === 'gather' && o.order.terrain === T_BUSH)) food++;
    else if (o.order.kind === 'gather' && o.order.terrain === T_TREE) wood++;
  }
  const gather = (terrain: number): boolean => {
    const tile = nearestNode(s, terrain, u.x, u.y, CFG.autoSwitchRadius);
    if (tile >= 0) setOrder(u, { kind: 'gather', tile, terrain });
    return tile >= 0;
  };
  const feed = (): boolean => {
    const farm = s.buildings.find((b) => b.owner === u.owner && b.type === 'farm' && b.progress >= 1 && b.worker === 0);
    if (farm) return issue(s, u.owner, { type: 'farm', units: [u.id], building: farm.id }).ok;
    if (gather(T_BUSH)) return true;
    // One farm at a time: an unfinished one gets a helper instead of a sibling.
    const unfinished = s.buildings.find((b) => b.owner === u.owner && b.type === 'farm' && b.progress < 1);
    if (unfinished) return issue(s, u.owner, { type: 'assist', units: [u.id], building: unfinished.id }).ok;
    if (!canAfford(s.players[u.owner], BUILDINGS.farm.cost)) return false;
    const site = findSite(look(s, u.owner), 'farm');
    return !!site && issue(s, u.owner, { type: 'build', units: [u.id], building: 'farm', tx: site.tx, ty: site.ty }).ok;
  };
  if (food <= wood) { if (!feed()) gather(T_TREE); } else if (!gather(T_TREE)) feed();
}

/** Puts the starting villagers to work, and afterwards any that have been standing idle. */
export function stepHelper(s: Game): void {
  if (s.tick !== 1 && s.tick % EVERY !== 0) return;
  for (const u of s.units.slice())
    if (u.type === 'villager' && u.order.kind === 'idle' && u.owner >= 0 && helped(s, u.owner)) sendToWork(s, u);
}

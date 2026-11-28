import { stepAI } from './ai';
import { nearLiveCamp, stepCamps } from './camps';
import { acquireTargets, attackTarget, autoFight, isFighter, killUnit, maxHp, stepBeast, strikeAfterMoving } from './combat';
import { issue, setOrder } from './commands';
import { BUILDINGS, CFG, DT, RACES } from './data';
import { updateFog } from './fog';
import { spreadIdle } from './formation';
import { besideRect, goTo } from './move';
import { walkable } from './path';
import { stepRules } from './rules';
import { buildingById, isResource, nearestNode, spawnNear } from './state';
import { T_BUSH, T_CRYSTAL, T_GRASS, T_TREE, type Building, type Game, type ResourceKind, type Unit } from './types';

/** Ticks between checks for idle soldiers crowding one tile. */
const SPREAD_EVERY = 10;
const KIND_OF: Record<number, ResourceKind> = { [T_TREE]: 'wood', [T_BUSH]: 'food', [T_CRYSTAL]: 'crystal' };

function stepGather(s: Game, u: Unit, tile: number, terrain: number): void {
  if (s.terrain[tile] !== terrain || s.amount[tile] <= 0) {
    // The node ran out: move to the nearest node of the same kind, or go idle.
    const next = nearestNode(s, terrain, u.x, u.y, CFG.autoSwitchRadius);
    return setOrder(u, next >= 0 ? { kind: 'gather', tile: next, terrain } : { kind: 'idle' });
  }
  const tx = tile % s.w, ty = Math.floor(tile / s.w);
  const state = goTo(s, u, `g${tile}`, besideRect(tx, ty, 1), tx, ty);
  if (state === 'blocked') return setOrder(u, { kind: 'idle' });
  if (state !== 'arrived') return;
  const kind = KIND_OF[terrain];
  const p = s.players[u.owner];
  const got = Math.min(s.amount[tile], (CFG.gatherPerMinute[kind] / 60) * DT * RACES[p.race].gather[kind]);
  s.amount[tile] -= got;
  p.res[kind] += got;
  if (s.amount[tile] <= 1e-6) {
    s.amount[tile] = 0;
    s.terrain[tile] = T_GRASS;
    s.mapVersion++;
  }
}

function stepFarm(s: Game, u: Unit, b: Building | undefined): void {
  if (!b || b.type !== 'farm' || b.progress < 1) return setOrder(u, { kind: 'idle' });
  if (b.worker !== 0 && b.worker !== u.id) {
    const other = s.units.find((o) => o.id === b.worker);
    if (other && other.order.kind === 'farm' && other.order.building === b.id) {
      const free = s.buildings.find((f) => f.owner === u.owner && f.type === 'farm' && f.progress >= 1 && f.worker === 0);
      return setOrder(u, free ? { kind: 'farm', building: free.id } : { kind: 'idle' });
    }
  }
  b.worker = u.id;
  const state = goTo(s, u, `f${b.id}`, besideRect(b.tx, b.ty, BUILDINGS.farm.size), b.tx + 1, b.ty + 1);
  if (state === 'blocked') { b.worker = 0; return setOrder(u, { kind: 'idle' }); }
  if (state !== 'arrived') return;
  const p = s.players[u.owner];
  p.res.food += (CFG.farmPerMinute / 60) * DT * RACES[p.race].farm;
}

function stepBuild(s: Game, u: Unit, b: Building | undefined): void {
  if (!b) return setOrder(u, { kind: 'idle' });
  if (b.progress >= 1) return setOrder(u, b.type === 'farm' ? { kind: 'farm', building: b.id } : { kind: 'idle' });
  const def = BUILDINGS[b.type];
  const state = goTo(s, u, `b${b.id}`, besideRect(b.tx, b.ty, def.size), b.tx + def.size / 2, b.ty + def.size / 2);
  if (state === 'blocked') return setOrder(u, { kind: 'idle' });
  if (state !== 'arrived') return;
  const inc = DT / def.buildTime;
  b.progress = Math.min(1, b.progress + inc);
  b.hp = Math.min(b.maxHp, b.hp + b.maxHp * inc);
  if (b.progress >= 1) s.mapVersion++;
}

/** Walks to a point; if the tile itself is blocked, stops beside it. Returns true while still travelling. */
function travel(s: Game, u: Unit, x: number, y: number, prefix: string): boolean {
  const tx = Math.floor(x), ty = Math.floor(y);
  // A point inside a building means "go stand beside that building".
  const b = buildingById(s, s.occ[ty * s.w + tx] ?? 0);
  const goal = walkable(s, tx, ty) ? (gx: number, gy: number) => gx === tx && gy === ty
    : b ? besideRect(b.tx, b.ty, BUILDINGS[b.type].size) : besideRect(tx, ty, 1);
  return goTo(s, u, `${prefix}${tx},${ty}`, goal, tx, ty) === 'moving';
}

/** Scouts head for the nearest unexplored walkable tile, steering around live camps. */
function stepExplore(s: Game, u: Unit, skip: number[]): void {
  const explored = s.fog[u.owner].explored;
  const nearCamp = (x: number, y: number) => nearLiveCamp(s, x + 0.5, y + 0.5);
  // Keep following the current path while its destination is still unknown.
  if (u.path && u.pathIdx < u.path.length && !explored[u.path[u.path.length - 1]]) {
    if (goTo(s, u, u.pathKey, () => false, 0, 0) === 'moving') return;
  }
  let best = -1, bestD = Infinity;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const i = y * s.w + x;
    if (explored[i] || !walkable(s, x, y) || nearCamp(x, y) || skip.includes(i)) continue;
    const d = (x - u.x) ** 2 + (y - u.y) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  if (best < 0) return setOrder(u, { kind: 'idle' });
  const bx = best % s.w, by = Math.floor(best / s.w);
  // A scout that starts inside a camp's circle is safe there; let it walk out before avoiding camps.
  const avoid = nearCamp(Math.floor(u.x), Math.floor(u.y)) ? undefined : nearCamp;
  if (goTo(s, u, `x${best}`, (x, y) => x === bx && y === by, bx, by, avoid) === 'blocked') skip.push(best);
}

function stepUnit(s: Game, u: Unit): void {
  u.cooldown = Math.max(0, u.cooldown - DT);
  if (u.owner < 0) return stepBeast(s, u);
  const o = u.order;
  switch (o.kind) {
    case 'idle':
      if (isFighter(u)) autoFight(s, u);
      return;
    case 'move':
      if (!travel(s, u, o.x, o.y, 'm')) setOrder(u, { kind: 'idle' });
      return;
    case 'attackMove':
      if (autoFight(s, u)) return;
      if (!travel(s, u, o.x, o.y, 'am')) setOrder(u, { kind: 'idle' });
      return;
    case 'attack':
      if (!attackTarget(s, u, o.target, o.building)) setOrder(u, { kind: 'idle' });
      return;
    case 'explore': return stepExplore(s, u, o.skip);
    case 'gather': return stepGather(s, u, o.tile, o.terrain);
    case 'farm': return stepFarm(s, u, buildingById(s, o.building));
    case 'build': return stepBuild(s, u, buildingById(s, o.building));
  }
}

function stepBuilding(s: Game, b: Building): void {
  if (b.progress < 1) return;
  if (b.worker !== 0) {
    const w = s.units.find((u) => u.id === b.worker);
    if (!w || w.order.kind !== 'farm' || w.order.building !== b.id) b.worker = 0;
  }
  const head = b.queue[0];
  if (head) {
    head.remaining -= DT;
    if (head.remaining <= 0) {
      const u = spawnNear(s, b, head.unit);
      if (u) {
        b.queue.shift();
        if (u.type === 'villager' && b.rallyTile >= 0 && isResource(s.terrain[b.rallyTile]))
          issue(s, b.owner, { type: 'gather', units: [u.id], tile: b.rallyTile });
      } else head.remaining = 0;
    }
  } else if (b.autoVillager && b.type === 'towncenter') {
    const villagers = s.units.reduce((n, u) => n + (u.owner === b.owner && u.type === 'villager' ? 1 : 0), 0);
    if (villagers < CFG.autoVillagerMax) issue(s, b.owner, { type: 'train', building: b.id, unit: 'villager' });
  }
}

/** Fallen heroes return at their owner's Ana Merkez once the respawn timer runs out. */
function stepHeroes(s: Game): void {
  for (const p of s.players) {
    if (!p.alive || p.heroRespawn < 0 || s.time < p.heroRespawn) continue;
    const tc = s.buildings.find((b) => b.owner === p.id && b.type === 'towncenter' && b.progress >= 1);
    if (!tc) continue;
    const hero = spawnNear(s, tc, 'hero');
    if (!hero) continue;
    hero.scale = 1 + CFG.hero.levelBonus * (p.heroLevel - 1);
    hero.hp = maxHp(hero);
    p.heroRespawn = -1;
  }
}

/** Advances the simulation by one fixed tick. */
export function step(s: Game): void {
  if (s.winner >= 0) return;
  s.tick++;
  s.time = s.tick * DT;
  stepAI(s);
  for (const b of s.buildings.slice()) stepBuilding(s, b);
  // Everyone alive at the start of the tick acts; those brought down are removed afterwards, so
  // blows landed in the same tick are simultaneous and no seat strikes first.
  for (const u of s.units) { u.px = u.x; u.py = u.y; }
  acquireTargets(s);
  for (const u of s.units.slice()) stepUnit(s, u);
  strikeAfterMoving(s);
  for (const f of s.fallen) if (s.units.includes(f.unit)) killUnit(s, f.unit, f.killer);
  s.fallen.length = 0;
  if (s.tick % SPREAD_EVERY === 0) spreadIdle(s);
  stepCamps(s);
  stepHeroes(s);
  stepRules(s);
  if (s.tick % CFG.fogInterval === 0) updateFog(s);
}

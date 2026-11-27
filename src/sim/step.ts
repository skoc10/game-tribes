import { BUILDINGS, CFG, DT, RACES, UNITS } from './data';
import { issue, setOrder } from './commands';
import { findPath, walkable } from './path';
import { buildingById, isResource, nearestNode, spawnNear } from './state';
import { T_BUSH, T_CRYSTAL, T_GRASS, T_TREE, type Building, type Game, type ResourceKind, type Unit } from './types';

const KIND_OF: Record<number, ResourceKind> = { [T_TREE]: 'wood', [T_BUSH]: 'food', [T_CRYSTAL]: 'crystal' };

/** Advances a unit along its path. Returns true once the path is finished. */
function stepMove(s: Game, u: Unit): boolean {
  if (!u.path) return false;
  let left = UNITS[u.type].speed * DT;
  while (left > 0 && u.pathIdx < u.path.length) {
    const t = u.path[u.pathIdx];
    const tx = t % s.w, ty = Math.floor(t / s.w);
    if (!walkable(s, tx, ty)) { u.path = null; return false; }
    const dx = tx + 0.5 - u.x, dy = ty + 0.5 - u.y;
    const d = Math.hypot(dx, dy);
    if (d <= left) { u.x = tx + 0.5; u.y = ty + 0.5; left -= d; u.pathIdx++; }
    else { u.x += (dx / d) * left; u.y += (dy / d) * left; left = 0; }
  }
  return u.pathIdx >= u.path.length;
}

export type Travel = 'arrived' | 'moving' | 'blocked';

/** Walks a unit towards any tile satisfying isGoal, (re)computing its path when the goal changes. */
export function goTo(
  s: Game, u: Unit, key: string, isGoal: (x: number, y: number) => boolean, hx: number, hy: number,
): Travel {
  if (u.pathKey !== key || !u.path) {
    const path = findPath(s, Math.floor(u.x), Math.floor(u.y), isGoal, hx, hy);
    if (!path) { u.path = null; u.pathKey = ''; return 'blocked'; }
    u.path = path; u.pathIdx = 0; u.pathKey = key;
  }
  return stepMove(s, u) ? 'arrived' : 'moving';
}

/** Goal test: a walkable tile touching the rectangle (tx, ty, size). */
export function besideRect(s: Game, tx: number, ty: number, size: number) {
  return (x: number, y: number) => x >= tx - 1 && x <= tx + size && y >= ty - 1 && y <= ty + size
    && !(x >= tx && x < tx + size && y >= ty && y < ty + size);
}

function stepGather(s: Game, u: Unit, tile: number, terrain: number): void {
  if (s.terrain[tile] !== terrain || s.amount[tile] <= 0) {
    // The node ran out: move to the nearest node of the same kind, or go idle.
    const next = nearestNode(s, terrain, u.x, u.y, CFG.autoSwitchRadius);
    return setOrder(u, next >= 0 ? { kind: 'gather', tile: next, terrain } : { kind: 'idle' });
  }
  const tx = tile % s.w, ty = Math.floor(tile / s.w);
  const state = goTo(s, u, `g${tile}`, besideRect(s, tx, ty, 1), tx, ty);
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
  const state = goTo(s, u, `f${b.id}`, besideRect(s, b.tx, b.ty, 2), b.tx + 1, b.ty + 1);
  if (state === 'blocked') { b.worker = 0; return setOrder(u, { kind: 'idle' }); }
  if (state !== 'arrived') return;
  const p = s.players[u.owner];
  p.res.food += (CFG.farmPerMinute / 60) * DT * RACES[p.race].farm;
}

function stepBuild(s: Game, u: Unit, b: Building | undefined): void {
  if (!b) return setOrder(u, { kind: 'idle' });
  if (b.progress >= 1) return setOrder(u, b.type === 'farm' ? { kind: 'farm', building: b.id } : { kind: 'idle' });
  const def = BUILDINGS[b.type];
  const state = goTo(s, u, `b${b.id}`, besideRect(s, b.tx, b.ty, def.size), b.tx + def.size / 2, b.ty + def.size / 2);
  if (state === 'blocked') return setOrder(u, { kind: 'idle' });
  if (state !== 'arrived') return;
  const inc = DT / def.buildTime;
  b.progress = Math.min(1, b.progress + inc);
  b.hp = Math.min(b.maxHp, b.hp + b.maxHp * inc);
  if (b.progress >= 1) s.mapVersion++;
}

function stepUnit(s: Game, u: Unit): void {
  const o = u.order;
  switch (o.kind) {
    case 'idle': return;
    case 'move': {
      const tx = Math.floor(o.x), ty = Math.floor(o.y);
      const exact = walkable(s, tx, ty);
      const goal = exact ? (x: number, y: number) => x === tx && y === ty : besideRect(s, tx, ty, 1);
      if (goTo(s, u, `m${tx},${ty}`, goal, tx, ty) !== 'moving') setOrder(u, { kind: 'idle' });
      return;
    }
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

/** Advances the simulation by one fixed tick. */
export function step(s: Game): void {
  s.tick++;
  s.time = s.tick * DT;
  for (const b of s.buildings.slice()) stepBuilding(s, b);
  for (const u of s.units.slice()) stepUnit(s, u);
}

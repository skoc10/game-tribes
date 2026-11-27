import { BUILDINGS, CFG, RACES, UNITS } from './data';
import { spawnCamp } from './camps';
import { initDiplo } from './diplomacy';
import { updateFog } from './fog';
import { inBounds, walkable } from './path';
import { rand, scramble } from './rng';
import {
  T_BUSH, T_CRYSTAL, T_GRASS, T_TREE,
  type Building, type Game, type GameOptions, type Unit,
} from './types';

export function tileOf(s: Game, x: number, y: number): number {
  return Math.floor(y) * s.w + Math.floor(x);
}

export function unitById(s: Game, id: number): Unit | undefined {
  return s.units.find((u) => u.id === id);
}

export function buildingById(s: Game, id: number): Building | undefined {
  return s.buildings.find((b) => b.id === id);
}

export function log(s: Game, player: number, kind: string, text: string, x?: number, y?: number): void {
  s.events.push({ time: s.time, player, kind, text, x, y });
}

function placeNode(s: Game, x: number, y: number, terrain: number, amount: number): void {
  // Floor, not round: flooring a point and its mirror image always lands on mirrored tiles.
  x = Math.floor(x); y = Math.floor(y);
  // If the spot is taken, use the nearest free one, so every seat ends up with the same number of nodes.
  for (let r = 0; r <= 4; r++)
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !inBounds(s, x + dx, y + dy)) continue;
      const i = (y + dy) * s.w + x + dx;
      if (s.terrain[i] !== T_GRASS || s.occ[i] !== 0) continue;
      s.terrain[i] = terrain;
      s.amount[i] = amount;
      return;
    }
}

function blob(s: Game, cx: number, cy: number, r: number, terrain: number, amount: number): void {
  // Tile centres are tested, so a blob and its mirror image cover mirrored tiles.
  for (let y = Math.floor(cy - r); y <= Math.floor(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.floor(cx + r); x++) {
      if (!inBounds(s, x, y) || (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) continue;
      const i = y * s.w + x;
      // Overlaps are skipped rather than moved: moving them would depend on scan direction.
      if (s.terrain[i] === T_GRASS && s.occ[i] === 0) { s.terrain[i] = terrain; s.amount[i] = amount; }
    }
}

/** True if every tile of a size×size footprint at (tx, ty) is free. */
export function canPlace(s: Game, type: string, tx: number, ty: number): boolean {
  if (!Number.isInteger(tx) || !Number.isInteger(ty)) return false;
  const size = BUILDINGS[type].size;
  for (let y = ty; y < ty + size; y++)
    for (let x = tx; x < tx + size; x++) if (!walkable(s, x, y)) return false;
  // The relic must stay reachable: nothing may be built on or right around it.
  const keep = CFG.relic.radius + 1;
  if (s.relic.x > tx - keep && s.relic.x < tx + size + keep && s.relic.y > ty - keep && s.relic.y < ty + size + keep) return false;
  // Camp sites stay clear so creatures always have somewhere to return to.
  if (s.camps.some((c) => c.x > tx - 3 && c.x < tx + size + 3 && c.y > ty - 3 && c.y < ty + size + 3)) return false;
  // A unit standing inside the footprint would be walled in.
  return !s.units.some((u) => u.x >= tx && u.x < tx + size && u.y >= ty && u.y < ty + size);
}

export function addBuilding(s: Game, owner: number, type: string, tx: number, ty: number, complete: boolean): Building {
  const def = BUILDINGS[type];
  const maxHp = Math.round(def.hp * RACES[s.players[owner].race].buildingHp);
  const b: Building = {
    id: s.nextId++, owner, type, tx, ty, maxHp, hp: complete ? maxHp : 1,
    progress: complete ? 1 : 0, queue: [], autoVillager: false, rallyTile: -1, worker: 0, research: null,
  };
  for (let y = ty; y < ty + def.size; y++) for (let x = tx; x < tx + def.size; x++) s.occ[y * s.w + x] = b.id;
  s.buildings.push(b);
  s.mapVersion++;
  return b;
}

export function removeBuilding(s: Game, b: Building): void {
  const size = BUILDINGS[b.type].size;
  for (let y = b.ty; y < b.ty + size; y++) for (let x = b.tx; x < b.tx + size; x++) s.occ[y * s.w + x] = 0;
  s.buildings = s.buildings.filter((o) => o !== b);
  s.mapVersion++;
}

export function addUnit(s: Game, owner: number, type: string, x: number, y: number): Unit {
  const u: Unit = {
    id: s.nextId++, owner, type, x, y, hp: UNITS[type].hp,
    order: { kind: 'idle' }, path: null, pathIdx: 0, pathKey: '',
    cooldown: 0, target: 0, scale: 1, camp: -1,
  };
  s.units.push(u);
  return u;
}

/** Walkable tiles in the ring just outside a building, in a fixed order. */
export function ringTiles(s: Game, b: Building): number[] {
  const size = BUILDINGS[b.type].size;
  const out: number[] = [];
  for (let y = b.ty - 1; y <= b.ty + size; y++)
    for (let x = b.tx - 1; x <= b.tx + size; x++) {
      const edge = x === b.tx - 1 || x === b.tx + size || y === b.ty - 1 || y === b.ty + size;
      if (edge && walkable(s, x, y)) out.push(y * s.w + x);
    }
  return out;
}

export function spawnNear(s: Game, b: Building, type: string): Unit | null {
  const ring = ringTiles(s, b);
  if (ring.length === 0) return null;
  const t = ring[s.nextId % ring.length];
  return addUnit(s, b.owner, type, (t % s.w) + 0.5, Math.floor(t / s.w) + 0.5);
}

export function createGame(opts: GameOptions): Game {
  const size = CFG.mapSize;
  const s: Game = {
    seed: scramble(opts.seed), tick: 0, time: 0, w: size, h: size,
    terrain: new Uint8Array(size * size), amount: new Float32Array(size * size),
    occ: new Int32Array(size * size), mapVersion: 0,
    units: [], buildings: [], players: [], nextId: 1, events: [],
    bases: [], center: { x: size / 2, y: size / 2 },
    camps: [], fog: [], fogVersion: 0, war: [],
    peaceEnd: opts.peaceSeconds ?? CFG.peaceSeconds,
    relic: { x: size / 2, y: size / 2, owner: -1, captor: -1, progress: 0, held: 0, counting: false },
    winner: -1, winKind: '',
    diplo: undefined as unknown as Game['diplo'], ai: [], fallen: [],
  };
  const n = opts.players.length;
  const cx = size / 2, cy = size / 2, R = size * 0.31;
  const node = CFG.nodeAmount;
  opts.players.forEach((setup, i) => {
    s.players.push({
      id: i, race: setup.race, name: setup.name ?? RACES[setup.race].name, isAI: setup.isAI,
      personality: setup.isAI ? setup.personality ?? (setup.race === 'kul' ? 'expander' : 'trader') : '',
      res: { ...CFG.startResources }, age: 1, alive: true, heroLevel: 1, heroXp: 0, heroRespawn: -1, upgrades: [], tcLostAt: -1,
    });
    s.fog.push({ explored: new Uint8Array(size * size), visible: new Uint8Array(size * size) });
    s.war.push(opts.players.map(() => false));
    // Start positions sit on a circle around the map centre. The first angle is tilted off the axes
    // so that no offset is exactly zero, and offsets snap to half tiles by magnitude: an offset and
    // its negation then land on exactly mirrored tiles, which makes two- and four-player maps
    // point-symmetric. (An earlier layout left one base a tile off its mirror image, with less room
    // behind it, and that seat lost most matches.)
    const ang = -Math.PI * (75 / 180) + (((i + (opts.seatOffset ?? 0)) % n) * 2 * Math.PI) / n;
    const snap = (v: number) => Math.sign(v) * (Math.floor(Math.abs(v)) + 0.5);
    const tcx = cx + snap(Math.cos(ang) * R), tcy = cy + snap(Math.sin(ang) * R);
    const bx = Math.floor(tcx), by = Math.floor(tcy);
    s.bases.push({ x: bx, y: by });
    // d points from the base to the map centre; p is perpendicular to it.
    const len = Math.hypot(cx - tcx, cy - tcy);
    const dx = (cx - tcx) / len, dy = (cy - tcy) / len, px = -dy, py = dx;
    const at = (along: number, side: number) => ({ x: tcx + dx * along + px * side, y: tcy + dy * along + py * side });

    const tc = addBuilding(s, i, 'towncenter', bx - 1, by - 1, true);
    const forest = at(-8, 0), forest2 = at(-6, 7), bush = at(0, 5), crystal = at(0, -5);
    blob(s, forest.x, forest.y, 2.5, T_TREE, node.tree);
    blob(s, forest2.x, forest2.y, 2, T_TREE, node.tree);
    for (let k = 0; k < 6; k++) placeNode(s, bush.x + (k % 3) * px + Math.floor(k / 3) * dx, bush.y + (k % 3) * py + Math.floor(k / 3) * dy, T_BUSH, node.bush);
    for (let k = 0; k < 2; k++) placeNode(s, crystal.x - k * px, crystal.y - k * py, T_CRYSTAL, node.crystal);
    // Contested resources between this base and the centre.
    const mid = at(R * 0.55, 6), midCrystal = at(R * 0.5, -6);
    blob(s, mid.x, mid.y, 2, T_TREE, node.tree);
    for (let k = 0; k < 3; k++) placeNode(s, midCrystal.x + k * dx, midCrystal.y + k * dy, T_CRYSTAL, node.crystal);

    for (let v = 0; v < CFG.startVillagers; v++) spawnNear(s, tc, 'villager');
    spawnNear(s, tc, 'scout');
    spawnNear(s, tc, 'hero');
    // One camp beside each base and one between each pair of neighbours.
    const near = at(2, -12);
    const between = { x: cx + Math.cos(ang + Math.PI / n) * R, y: cy + Math.sin(ang + Math.PI / n) * R };
    for (const c of [near, between]) s.camps.push({ x: Math.floor(c.x) + 0.5, y: Math.floor(c.y) + 0.5, tier: 1, alive: 0, respawnAt: -1 });
  });
  s.camps.forEach((_, i) => spawnCamp(s, i));
  initDiplo(s);
  // Seeded variation so that no two matches play out identically.
  s.ai = s.players.map(() => ({
    nextThink: rand(s) * CFG.ai.thinkSeconds, nextStrategy: rand(s) * CFG.ai.strategySeconds,
    enemy: -1, goal: 'none', nerve: 0.8 + rand(s) * 0.4, lastOffer: s.players.map(() => -999), blocker: -1,
  }));
  updateFog(s);
  return s;
}

export function popUsed(s: Game, player: number): number {
  let n = 0;
  for (const u of s.units) if (u.owner === player) n += UNITS[u.type].pop;
  for (const b of s.buildings) if (b.owner === player) for (const q of b.queue) n += UNITS[q.unit].pop;
  return n;
}

export function popCap(s: Game, player: number): number {
  let n = 0;
  for (const b of s.buildings) if (b.owner === player && b.progress >= 1) n += BUILDINGS[b.type].pop;
  return Math.min(CFG.popMax, n);
}

export function idleVillagers(s: Game, player: number): Unit[] {
  return s.units.filter((u) => u.owner === player && u.type === 'villager' && u.order.kind === 'idle');
}

/** A resource tile a villager can stand next to. */
export function exposed(s: Game, tile: number): boolean {
  const x = tile % s.w, y = Math.floor(tile / s.w);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && walkable(s, x + dx, y + dy)) return true;
  return false;
}

/** Nearest exposed tile of the given terrain within radius of (x, y), or -1. */
export function nearestNode(s: Game, terrain: number, x: number, y: number, radius: number): number {
  // Ties between equally near nodes go by a hash of the tile, not by scan order (a screen direction).
  let best = -1, bestD = Infinity, bestH = 0;
  const fx = Math.floor(x), fy = Math.floor(y);
  for (let ty = Math.max(0, fy - radius); ty <= Math.min(s.h - 1, fy + radius); ty++)
    for (let tx = Math.max(0, fx - radius); tx <= Math.min(s.w - 1, fx + radius); tx++) {
      const i = ty * s.w + tx;
      if (s.terrain[i] !== terrain || s.amount[i] <= 0) continue;
      const d = (tx + 0.5 - x) ** 2 + (ty + 0.5 - y) ** 2;
      if (d > bestD + 1e-9) continue;
      const h = Math.imul(i + 1, 2654435761) >>> 0;
      if ((d < bestD - 1e-9 || h > bestH) && exposed(s, i)) { bestD = d; best = i; bestH = h; }
    }
  return best;
}

export function isResource(terrain: number): boolean {
  return terrain === T_TREE || terrain === T_BUSH || terrain === T_CRYSTAL;
}

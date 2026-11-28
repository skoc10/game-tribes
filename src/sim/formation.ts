import { clsOf, isFighter } from './combat';
import { walkable } from './path';
import type { Game, Unit } from './types';

/** Who stands where in the ranks: melee in front, riders behind them, archers at the back. */
const RANK: Record<string, number> = { hero: 0, infantry: 0, cavalry: 1, archer: 2 };
const MAX_WIDTH = 8;

/**
 * Destination tiles for a group ordered to one point: ranks facing the direction of travel,
 * one unit per tile, the front rank on the point itself. Tiles that cannot be stood on are skipped.
 */
export function formation(s: Game, units: Unit[], x: number, y: number): Map<number, { x: number; y: number }> {
  const out = new Map<number, { x: number; y: number }>();
  if (units.length < 2) { for (const u of units) out.set(u.id, { x, y }); return out; }
  let cx = 0, cy = 0;
  for (const u of units) { cx += u.x; cy += u.y; }
  const dx = x - cx / units.length, dy = y - cy / units.length;
  // Facing snaps to the grid, so ranks are straight lines of tiles.
  const fx = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 1 : -1) : 0;
  const fy = fx === 0 ? (dy >= 0 ? 1 : -1) : 0;
  const tx = Math.floor(x), ty = Math.floor(y);
  const width = Math.min(MAX_WIDTH, Math.max(2, Math.ceil(Math.sqrt(units.length * 2))));
  const sorted = units.slice().sort((a, b) => (RANK[clsOf(a)] ?? 3) - (RANK[clsOf(b)] ?? 3) || a.id - b.id);
  let next = 0;
  // Enough rows to seat everyone even where some tiles are blocked; whoever is left over goes to the point.
  for (let row = 0; row < units.length + 4 && next < sorted.length; row++) {
    for (let k = 0; k < width && next < sorted.length; k++) {
      // Fill each rank from its middle outwards: 0, +1, -1, +2, -2 ...
      const col = k % 2 === 1 ? (k + 1) / 2 : -k / 2;
      const sx = tx - fx * row - fy * col, sy = ty - fy * row + fx * col;
      if (!walkable(s, sx, sy)) continue;
      out.set(sorted[next++].id, { x: sx + 0.5, y: sy + 0.5 });
    }
  }
  for (; next < sorted.length; next++) out.set(sorted[next].id, { x, y });
  return out;
}

const SPREAD_RADIUS = 4;

/**
 * Soldiers standing idle on one tile step apart, one to a tile, so an army reads as an army
 * and not as a single dot. They keep watching for enemies while they shuffle.
 */
export function spreadIdle(s: Game): void {
  const taken = new Set<number>();
  const key = (owner: number, tx: number, ty: number) => (ty * s.w + tx) * 8 + owner;
  const waiting: Unit[] = [];
  for (const u of s.units) {
    if (u.owner < 0 || !isFighter(u)) continue;
    const o = u.order;
    if (o.kind === 'move' || o.kind === 'attackMove') taken.add(key(u.owner, Math.floor(o.x), Math.floor(o.y)));
    else if (o.kind === 'idle' && !u.target) waiting.push(u);
  }
  for (const u of waiting) {
    const ux = Math.floor(u.x), uy = Math.floor(u.y);
    if (!taken.has(key(u.owner, ux, uy))) { taken.add(key(u.owner, ux, uy)); continue; }
    // Nearest free tile; ties go by a hash of unit and tile, not by scan order, so no compass direction is favoured.
    let bx = -1, by = -1, bestD = Infinity, bestH = 0;
    for (let yy = uy - SPREAD_RADIUS; yy <= uy + SPREAD_RADIUS; yy++)
      for (let xx = ux - SPREAD_RADIUS; xx <= ux + SPREAD_RADIUS; xx++) {
        if (!walkable(s, xx, yy) || taken.has(key(u.owner, xx, yy))) continue;
        const d = (xx - ux) ** 2 + (yy - uy) ** 2;
        if (d > bestD) continue;
        const h = Math.imul((yy * s.w + xx) * 31 + u.id, 2654435761) >>> 0;
        if (d < bestD || h > bestH) { bx = xx; by = yy; bestD = d; bestH = h; }
      }
    if (bx < 0) continue;
    taken.add(key(u.owner, bx, by));
    u.order = { kind: 'attackMove', x: bx + 0.5, y: by + 0.5 };
    u.path = null; u.pathKey = '';
  }
}

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
  // A point on a tile boundary (the relic sits on a corner) has no tile of its own. Anchor on the
  // side the ranks grow towards, so armies arriving from opposite sides get mirror-image blocks.
  const anchor = (v: number, grow: number) => (Number.isInteger(v) && grow < 0 ? v - 1 : Math.floor(v));
  const tx = anchor(x, fx !== 0 ? -fx : -fy), ty = anchor(y, fy !== 0 ? -fy : fx);
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
  // Whoever is first on a tile keeps it; claim all of those before moving anyone, so nobody is
  // sent onto a tile where another soldier already stands properly.
  const crowded: Unit[] = [];
  for (const u of waiting) {
    const k = key(u.owner, Math.floor(u.x), Math.floor(u.y));
    if (taken.has(k)) crowded.push(u); else taken.add(k);
  }
  const R = SPREAD_RADIUS, side = 2 * R + 1;
  for (const u of crowded) {
    const ux = Math.floor(u.x), uy = Math.floor(u.y);
    // Flood outwards over walkable tiles, so only tiles that can actually be walked to are offered.
    // Nearest free tile wins; ties go by a hash of unit and tile, not by scan order, so no compass direction is favoured.
    const seen = new Uint8Array(side * side);
    const queue = [[ux, uy]];
    seen[R * side + R] = 1;
    let bx = -1, by = -1, bestD = Infinity, bestH = 0;
    for (let q = 0; q < queue.length; q++) {
      const [cx, cy] = queue[q];
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = cx + ox, yy = cy + oy;
        if (Math.abs(xx - ux) > R || Math.abs(yy - uy) > R) continue;
        const si = (yy - uy + R) * side + (xx - ux + R);
        if (seen[si] || !walkable(s, xx, yy)) continue;
        seen[si] = 1;
        queue.push([xx, yy]);
        if (taken.has(key(u.owner, xx, yy))) continue;
        const d = (xx - ux) ** 2 + (yy - uy) ** 2;
        if (d > bestD) continue;
        const h = Math.imul((yy * s.w + xx) * 31 + u.id, 2654435761) >>> 0;
        if (d < bestD || h > bestH) { bx = xx; by = yy; bestD = d; bestH = h; }
      }
    }
    if (bx < 0) continue;
    taken.add(key(u.owner, bx, by));
    u.order = { kind: 'attackMove', x: bx + 0.5, y: by + 0.5 };
    u.path = null; u.pathKey = '';
  }
}

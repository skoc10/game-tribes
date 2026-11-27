import { DT, UNITS } from './data';
import { findPath, walkable } from './path';
import type { Game, Unit } from './types';

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
export type TileTest = (x: number, y: number) => boolean;

/** Walks a unit towards any tile satisfying isGoal, (re)computing its path when the goal changes. */
export function goTo(s: Game, u: Unit, key: string, isGoal: TileTest, hx: number, hy: number, avoid?: TileTest): Travel {
  if (u.pathKey !== key || !u.path) {
    const path = findPath(s, Math.floor(u.x), Math.floor(u.y), isGoal, hx, hy, avoid);
    if (!path) { u.path = null; u.pathKey = ''; return 'blocked'; }
    u.path = path; u.pathIdx = 0; u.pathKey = key;
  }
  return stepMove(s, u) ? 'arrived' : 'moving';
}

/** Goal test: a tile touching the rectangle (tx, ty, size) but not inside it. */
export function besideRect(tx: number, ty: number, size: number): TileTest {
  return (x, y) => x >= tx - 1 && x <= tx + size && y >= ty - 1 && y <= ty + size
    && !(x >= tx && x < tx + size && y >= ty && y < ty + size);
}

/** Goal test: a tile within Chebyshev distance r of the rectangle (tx, ty, size). */
export function nearRect(tx: number, ty: number, size: number, r: number): TileTest {
  return (x, y) => x >= tx - r && x < tx + size + r && y >= ty - r && y < ty + size + r
    && !(x >= tx && x < tx + size && y >= ty && y < ty + size);
}

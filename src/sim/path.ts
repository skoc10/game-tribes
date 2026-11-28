import { T_GRASS, type Game } from './types';

export function inBounds(s: Game, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < s.w && y < s.h;
}

export function walkable(s: Game, x: number, y: number): boolean {
  if (!inBounds(s, x, y)) return false;
  const i = y * s.w + x;
  return s.terrain[i] === T_GRASS && s.occ[i] === 0;
}

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];

/**
 * A* over the tile grid. Returns the tiles to step through (excluding the start), an empty
 * array if the start already satisfies the goal, or null if no goal tile is reachable.
 * (hx, hy) is the point the heuristic aims at. Tiles matching `avoid` are treated as blocked.
 * `salt` varies how ties between equally good paths are broken (deterministically).
 */
export function findPath(
  s: Game, sx: number, sy: number, isGoal: (x: number, y: number) => boolean, hx: number, hy: number,
  avoid?: (x: number, y: number) => boolean, salt = 0,
): number[] | null {
  if (isGoal(sx, sy)) return [];
  const { w, h } = s;
  const n = w * h;
  // 64-bit, or the tiny tie-breaking terms below vanish in rounding.
  const g = new Float64Array(n).fill(Infinity);
  const f = new Float64Array(n);
  const from = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const heap: number[] = [];
  // Among equally short paths prefer the one that hugs the straight line from start to target.
  // Without this the choice falls to neighbour order, which is a screen direction: armies walking
  // down the map would bunch differently from armies walking up it, and one side would win battles.
  const span = Math.hypot(sx - hx, sy - hy) || 1;
  const lx = (sx - hx) / span, ly = (sy - hy) / span;
  const heur = (x: number, y: number) => {
    const dx = Math.abs(x - hx), dy = Math.abs(y - hy);
    // Distance from the straight line, in tiles (bounded, so the estimate stays close to honest).
    const off = Math.abs((x - hx) * ly - (y - hy) * lx);
    // What is still tied is settled by a hash of the tile and the caller's salt rather than by
    // neighbour order, so no compass direction is favoured across many paths.
    const jitter = ((Math.imul((y * w + x) ^ salt, 2654435761) >>> 0) % 1024) * 1e-7;
    return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy) + off * 0.001 + jitter;
  };
  const push = (i: number) => {
    heap.push(i);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (f[heap[p]] <= f[heap[c]]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = (): number => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let p = 0;
      for (;;) {
        const l = 2 * p + 1, r = l + 1;
        let m = p;
        if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
        if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
        if (m === p) break;
        [heap[p], heap[m]] = [heap[m], heap[p]];
        p = m;
      }
    }
    return top;
  };

  const start = sy * w + sx;
  g[start] = 0;
  f[start] = heur(sx, sy);
  push(start);
  while (heap.length > 0) {
    const cur = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % w, cy = (cur - cx) / w;
    if (cur !== start && isGoal(cx, cy)) {
      const out: number[] = [];
      for (let i = cur; i !== start; i = from[i]) out.push(i);
      return out.reverse();
    }
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      if (!walkable(s, nx, ny) || (avoid && avoid(nx, ny))) continue;
      // No cutting corners around blocked tiles.
      if (d >= 4 && (!walkable(s, cx + DX[d], cy) || !walkable(s, cx, cy + DY[d]))) continue;
      const ni = ny * w + nx;
      if (closed[ni]) continue;
      const ng = g[cur] + (d >= 4 ? 1.4142 : 1);
      if (ng < g[ni]) {
        g[ni] = ng;
        f[ni] = ng + heur(nx, ny);
        from[ni] = cur;
        push(ni);
      }
    }
  }
  return null;
}

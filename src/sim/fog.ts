import { BUILDINGS, UNITS } from './data';
import type { Game } from './types';

function stamp(s: Game, player: number, cx: number, cy: number, r: number): void {
  const { explored, visible } = s.fog[player];
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(s.w - 1, Math.floor(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(s.h - 1, Math.floor(cy + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) continue;
    const i = y * s.w + x;
    visible[i] = 1;
    explored[i] = 1;
  }
}

/** Recomputes what every player currently sees. */
export function updateFog(s: Game): void {
  for (const f of s.fog) f.visible.fill(0);
  for (const u of s.units) if (u.owner >= 0) stamp(s, u.owner, u.x, u.y, UNITS[u.type].sight);
  for (const b of s.buildings) {
    const def = BUILDINGS[b.type];
    stamp(s, b.owner, b.tx + def.size / 2, b.ty + def.size / 2, def.sight + def.size / 2);
  }
  s.fogVersion++;
}

export function isVisible(s: Game, player: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
  return s.fog[player].visible[Math.floor(y) * s.w + Math.floor(x)] === 1;
}

export function isExplored(s: Game, player: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
  return s.fog[player].explored[Math.floor(y) * s.w + Math.floor(x)] === 1;
}

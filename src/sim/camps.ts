import { CFG } from './data';
import { walkable } from './path';
import { addUnit } from './state';
import { NEUTRAL, type Game } from './types';

/** Offsets at Chebyshev distance r, in a fixed order. */
const RING = (r: number): number[][] => {
  const out: number[][] = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) out.push([dx, dy]);
  return out;
};

export function spawnCamp(s: Game, index: number): void {
  const camp = s.camps[index];
  const count = CFG.camp.count[camp.tier - 1];
  // Use the free tiles closest to the camp centre; never spawn inside something.
  const free: number[][] = [];
  for (let r = 0; r <= 4 && free.length < count; r++)
    for (const [dx, dy] of r === 0 ? [[0, 0]] : RING(r)) if (walkable(s, Math.floor(camp.x + dx), Math.floor(camp.y + dy))) free.push([dx, dy]);
  if (free.length === 0) { camp.respawnAt = s.time + 10; return; }
  for (let i = 0; i < count; i++) {
    const [dx, dy] = free[i % free.length];
    const u = addUnit(s, NEUTRAL, 'beast', camp.x + dx, camp.y + dy);
    u.camp = index;
    u.scale = CFG.camp.scale[camp.tier - 1];
    u.hp = Math.round(u.hp * u.scale);
  }
  camp.alive = count;
  camp.respawnAt = -1;
}

/** Cleared camps come back one tier stronger, up to the maximum tier. */
export function stepCamps(s: Game): void {
  s.camps.forEach((camp, i) => {
    if (camp.alive > 0 || camp.respawnAt < 0 || s.time < camp.respawnAt) return;
    camp.tier = Math.min(CFG.camp.maxTier, camp.tier + 1);
    spawnCamp(s, i);
  });
}

/** True if (x, y) is close enough to a live camp that an exploring scout should steer around it. */
export function nearLiveCamp(s: Game, x: number, y: number): boolean {
  const r = CFG.camp.exploreAvoid;
  return s.camps.some((c) => c.alive > 0 && (c.x - x) ** 2 + (c.y - y) ** 2 < r * r);
}

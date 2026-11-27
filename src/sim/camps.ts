import { CFG } from './data';
import { walkable } from './path';
import { addUnit } from './state';
import { NEUTRAL, type Game } from './types';

const SPOTS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];

export function spawnCamp(s: Game, index: number): void {
  const camp = s.camps[index];
  const count = CFG.camp.count[camp.tier - 1];
  for (let i = 0; i < count; i++) {
    const [dx, dy] = SPOTS[i % SPOTS.length];
    const ok = walkable(s, Math.floor(camp.x + dx), Math.floor(camp.y + dy));
    const u = addUnit(s, NEUTRAL, 'beast', camp.x + (ok ? dx : 0), camp.y + (ok ? dy : 0));
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

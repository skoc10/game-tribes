import { log } from './state';
import type { Game } from './types';

/** Whether units of a may fight units of b. Neutral creatures fight everyone. */
export function hostile(s: Game, a: number, b: number): boolean {
  if (a === b) return false;
  if (a < 0 || b < 0) return true;
  return !inPeace(s) && s.war[a][b];
}

export function inPeace(s: Game): boolean {
  return s.time < s.peaceEnd;
}

/** Whether a may open hostilities against b right now. */
export function mayAttack(s: Game, _a: number, _b: number): { ok: boolean; reason?: string } {
  if (inPeace(s)) return { ok: false, reason: 'Barış süresi bitmeden başka bir halka saldıramazsın' };
  return { ok: true };
}

export function declareWar(s: Game, a: number, b: number): void {
  if (a < 0 || b < 0 || a === b || s.war[a][b]) return;
  s.war[a][b] = s.war[b][a] = true;
  log(s, a, 'war', `${s.players[b].name} ile savaştasın.`);
  log(s, b, 'war', `${s.players[a].name} sana savaş ilan etti.`);
}

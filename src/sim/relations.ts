import { log } from './state';
import type { Game } from './types';

/** Whether units of a may fight units of b. Neutral creatures fight everyone. */
export function hostile(s: Game, a: number, b: number): boolean {
  if (a === b) return false;
  if (a < 0 || b < 0) return true;
  return s.war[a][b];
}

/** Whether a may open hostilities against b right now. Later phases add the peace period and pacts. */
export function mayAttack(_s: Game, _a: number, _b: number): { ok: boolean; reason?: string } {
  return { ok: true };
}

export function declareWar(s: Game, a: number, b: number): void {
  if (a < 0 || b < 0 || a === b || s.war[a][b]) return;
  s.war[a][b] = s.war[b][a] = true;
  log(s, a, 'war', `${s.players[b].name} ile savaştasın.`);
  log(s, b, 'war', `${s.players[a].name} sana savaş ilan etti.`);
}

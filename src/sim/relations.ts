import { pactOf } from './diplomacy';
import type { Game } from './types';

/** Whether units of a may fight units of b. Neutral creatures fight everyone. */
export function hostile(s: Game, a: number, b: number): boolean {
  if (a === b) return false;
  if (a < 0 || b < 0) return true;
  return !inPeace(s) && s.war[a][b] && !pactOf(s, a, b);
}

export function inPeace(s: Game): boolean {
  return s.time < s.peaceEnd;
}


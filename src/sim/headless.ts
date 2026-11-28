import { CFG } from './data';
import { createGame } from './state';
import { step } from './step';
import type { Difficulty, Game, Personality, RaceId } from './types';

export interface Seat { race: RaceId; personality: Personality }
export interface MatchResult { winner: number; winKind: string; minutes: number; game: Game }

/** Plays a whole match between AIs with no rendering. Used for balance checks. */
export function runMatch(seed: number, seats: Seat[], maxMinutes = 60, peaceSeconds?: number, difficulty: Difficulty = 'komutan'): MatchResult {
  const game = createGame({ seed, peaceSeconds, difficulty, players: seats.map((p) => ({ race: p.race, isAI: true, personality: p.personality })) });
  const limit = maxMinutes * 60 * CFG.tickRate;
  while (game.winner < 0 && game.tick < limit) step(game);
  return { winner: game.winner, winKind: game.winKind, minutes: game.time / 60, game };
}

/**
 * Seat fairness check: same race and personality in every seat, so any skew is a seat effect.
 *   npx tsx scripts/seat.ts [matches=200] [seedBase=1000] [players=2]
 */
import { CFG } from '../src/sim/data';
import { power } from '../src/sim/diplomacy';
import { createGame } from '../src/sim/state';
import { step } from '../src/sim/step';
import type { Personality, RaceId } from '../src/sim/types';

const matches = Number(process.argv[2]) || 200, seedBase = Number(process.argv[3]) || 1000, players = Number(process.argv[4]) || 2, seatOffset = Number(process.argv[5]) || 0;
for (const race of ['sancak', 'kul'] as RaceId[]) for (const personality of ['expander', 'trader'] as Personality[]) {
  const wins = new Array(players).fill(0), pw = new Array(players).fill(0), res = new Array(players).fill(0);
  for (let i = 0; i < matches; i++) {
    const s = createGame({ seed: seedBase + i, seatOffset, players: Array.from({ length: players }, () => ({ race, isAI: true, personality })) });
    let sampled = false;
    while (s.winner < 0 && s.tick < 60 * 60 * CFG.tickRate) {
      step(s);
      if (!sampled && s.time >= 480) { sampled = true; s.players.forEach((p, k) => { pw[k] += power(s, k); res[k] += p.res.food + p.res.wood + p.res.crystal; }); }
    }
    if (s.winner >= 0) wins[s.winner]++;
  }
  console.log(`${race}/${personality}: koltuk galibiyetleri ${wins.map((w) => `%${Math.round((100 * w) / matches)}`).join(' / ')} | 8. dk güç ${pw.map((v) => Math.round(v / matches)).join(' / ')} | 8. dk stok ${res.map((v) => Math.round(v / matches)).join(' / ')}`);
}

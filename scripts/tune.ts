/**
 * Balance tuning helper: measures the two mirror series with temporary overrides of the data,
 * without editing the JSON files.
 *   npx tsx scripts/tune.ts '<json overrides>' [matches=200] [seedBase=1000] [diag]
 * Short keys: kulCost, kulTrain, farm, cavalry, sancakCost, campLoot (multiplier on the current table),
 *   caravan, edge, relicArmy, notice, hold, crystalEnough.
 * Dotted keys reach anything else, e.g. {"RACES.kul.loot": false, "CFG.loot.unit": 0}.
 * Add "diag" to print average army strength per race at fixed minutes.
 */
import { CFG, RACES } from '../src/sim/data';
import { power } from '../src/sim/diplomacy';
import { createGame } from '../src/sim/state';
import { step } from '../src/sim/step';
import type { Personality, RaceId } from '../src/sim/types';

const o = JSON.parse(process.argv[2] || '{}') as Record<string, number>;
const matches = Number(process.argv[3]) || 200, seedBase = Number(process.argv[4]) || 1000, diag = process.argv[5] === 'diag';
if (o.kulCost !== undefined) RACES.kul.unitCost['*'] = o.kulCost;
if (o.kulTrain !== undefined) RACES.kul.trainTime = o.kulTrain;
if (o.farm !== undefined) RACES.sancak.farm = o.farm;
if (o.cavalry !== undefined) RACES.sancak.unitCost.cavalry = o.cavalry;
if (o.campLoot !== undefined) for (const t of CFG.camp.loot) { t.food = Math.round(t.food * o.campLoot); t.wood = Math.round(t.wood * o.campLoot); t.crystal = Math.round(t.crystal * o.campLoot); }
if (o.edge !== undefined) CFG.ai.attackEdge = o.edge;
if (o.relicArmy !== undefined) CFG.ai.relicArmy = o.relicArmy;
if (o.notice !== undefined) CFG.diplomacy.noticeSeconds = o.notice;
if (o.hold !== undefined) CFG.relic.holdToWin = o.hold;
if (o.caravan !== undefined) CFG.diplomacy.caravanPerMinute = o.caravan;
if (o.crystalEnough !== undefined) CFG.ai.crystalEnough = o.crystalEnough;
if (o.sancakCost !== undefined) RACES.sancak.unitCost['*'] = o.sancakCost;

// Dotted keys reach any value: e.g. {"RACES.kul.loot": false, "CFG.loot.unit": 0}.
for (const [key, value] of Object.entries(o as Record<string, unknown>)) {
  if (!key.includes('.')) continue;
  const path = key.split('.');
  let target: Record<string, unknown> = (path[0] === 'RACES' ? RACES : CFG) as unknown as Record<string, unknown>;
  for (const part of path.slice(1, -1)) target = target[part] as Record<string, unknown>;
  target[path[path.length - 1]] = value;
}

const out: string[] = [];
for (const personality of ['expander', 'trader'] as Personality[]) {
  let kul = 0, minutes = 0;
  const marks = [8, 9, 10, 11, 12, 14], sum: Record<string, number[]> = { sancak: marks.map(() => 0), kul: marks.map(() => 0) }, n = marks.map(() => 0);
  for (let i = 0; i < matches; i++) {
    const races: RaceId[] = i % 2 ? ['kul', 'sancak'] : ['sancak', 'kul'];
    const s = createGame({ seed: seedBase + i, players: races.map((race) => ({ race, isAI: true, personality })) });
    const limit = 60 * 60 * CFG.tickRate;
    let m = 0;
    while (s.winner < 0 && s.tick < limit) {
      step(s);
      if (diag && m < marks.length && s.time >= marks[m] * 60) { races.forEach((r, k) => (sum[r][m] += power(s, k))); n[m]++; m++; }
    }
    if (s.winner >= 0 && races[s.winner] === 'kul') kul++;
    minutes += s.time / 60;
  }
  out.push(`${personality}: kul %${Math.round((100 * kul) / matches)} (${(minutes / matches).toFixed(1)} dk)`);
  if (diag) out.push('  güç s/k @dk ' + marks.map((t, k) => `${t}:${Math.round(sum.sancak[k] / (n[k] || 1))}/${Math.round(sum.kul[k] / (n[k] || 1))}`).join('  '));
}
console.log(`${process.argv[2]} n=${matches} →\n  ${out.join('\n  ')}`);

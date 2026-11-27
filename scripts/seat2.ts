import { CFG } from '../src/sim/data';
import { createGame } from '../src/sim/state';
import { step } from '../src/sim/step';
const n = 100, marks = [6, 8, 9, 10, 10.5, 11, 12];
const sol = marks.map(() => [0, 0]), vil = marks.map(() => [0, 0]), bld = marks.map(() => [0, 0]), lvl = marks.map(() => [0, 0]), camp = marks.map(() => [0, 0]), cnt = marks.map(() => 0);
let campKills = [0, 0];
for (let i = 0; i < n; i++) {
  const s = createGame({ seed: 1000 + i, players: [0, 1].map(() => ({ race: 'kul' as const, isAI: true, personality: 'trader' as const })) });
  let m = 0;
  const seen = new Set<number>();
  while (s.winner < 0 && s.tick < 13 * 600) {
    const before = new Map(s.units.filter((u) => u.owner >= 0 && ['infantry', 'archer', 'cavalry'].includes(u.type)).map((u) => [u.id, u.owner]));
    const war = s.war[0][1];
    step(s);
    if (!war) for (const [id, owner] of before) if (!seen.has(id) && !s.units.some((u) => u.id === id)) { seen.add(id); campKills[owner]++; }
    if (m < marks.length && s.time >= marks[m] * 60) {
      for (const p of [0, 1]) {
        sol[m][p] += s.units.filter((u) => u.owner === p && ['infantry', 'archer', 'cavalry'].includes(u.type)).length;
        vil[m][p] += s.units.filter((u) => u.owner === p && u.type === 'villager').length;
        bld[m][p] += s.buildings.filter((b) => b.owner === p).length;
        lvl[m][p] += s.players[p].heroLevel;
      }
      camp[m][0] += s.camps.reduce((a, c) => a + c.tier, 0);
      cnt[m]++; m++;
    }
  }
}
const f = (a: number[][], k: number) => a[k].map((v) => (v / (cnt[k] || 1)).toFixed(1)).join('/');
marks.forEach((t, k) => console.log(`${t} dk: asker ${f(sol, k)} köylü ${f(vil, k)} bina ${f(bld, k)} kahraman ${f(lvl, k)}`));
console.log('savaş öncesi kamplarda kaybedilen asker (üst/alt):', campKills.map((v) => (v / n).toFixed(1)).join(' / '));
void CFG;

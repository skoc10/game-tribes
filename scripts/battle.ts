import { addUnit, createGame } from '../src/sim/state';
import { step } from '../src/sim/step';
import { rand } from '../src/sim/rng';
// Two equal armies stacked on the same spot, created in different orders.
let w0 = 0, w1 = 0, d = 0;
for (const order of Array.from({ length: 60 }, (_, k) => 'k' + k)) {
  const s = createGame({ seed: 1, peaceSeconds: 0, players: [0, 1].map(() => ({ race: 'sancak' as const, isAI: false })) });
  const r = { seed: Number(order.slice(1)) * 7919 + 13 };
  const owners: number[] = [];
  for (let i = 0; i < 25; i++) owners.push(0, 1);
  if (order === '0 önce') owners.sort();
  else if (order === '1 önce') owners.sort().reverse();
  else for (let i = owners.length - 1; i > 0; i--) { const j = Math.floor(rand(r) * (i + 1)); [owners[i], owners[j]] = [owners[j], owners[i]]; }
  const types = ['infantry', 'archer', 'cavalry'];
  const count = [0, 0];
  for (const o of owners) addUnit(s, o, types[count[o]++ % 3], 32.5, 32.5);
  for (let t = 0; t < 20; t++) step(s);
  s.war[0][1] = s.war[1][0] = true;
  for (let t = 0; t < 900; t++) step(s);
  const n = (p: number) => s.units.filter((u) => u.owner === p && types.includes(u.type)).length;
  if (n(0) > n(1)) w0++; else if (n(1) > n(0)) w1++; else d++;
}
console.log('60 karışık savaş: koltuk 0 kazandı', w0, 'koltuk 1 kazandı', w1, 'berabere', d);

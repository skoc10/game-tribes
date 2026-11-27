import { createGame, popCap, popUsed } from '../src/sim/state';
import { step } from '../src/sim/step';
const n = 100;
const acc: Record<string, number[]> = {};
const add = (k: string, p: number, v: number) => { (acc[k] ??= [0, 0])[p] += v / n; };
for (let i = 0; i < n; i++) {
  const s = createGame({ seed: 1000 + i, players: [0, 1].map(() => ({ race: 'kul' as const, isAI: true, personality: 'trader' as const })) });
  const got = [0, 0], prev = [0, 0];
  const done: Record<string, number>[] = [{}, {}];
  while (s.time < 9.5 * 60) {
    step(s);
    for (const p of [0, 1]) {
      if (s.players[p].age === 2 && done[p].age === undefined) done[p].age = s.time;
      for (const b of s.buildings) if (b.owner === p && b.progress >= 1 && done[p][b.type] === undefined) done[p][b.type] = s.time;
      const tot = s.players[p].res.food + s.players[p].res.wood + s.players[p].res.crystal;
      if (tot > prev[p]) got[p] += tot - prev[p];
      prev[p] = tot;
    }
  }
  for (const p of [0, 1]) {
    add('toplanan', p, got[p]);
    for (const k of ['age', 'barracks', 'archery', 'stable', 'blacksmith']) add(k + ' (sn)', p, done[p][k] ?? 600);
    add('asker', p, s.units.filter((u) => u.owner === p && ['infantry', 'archer', 'cavalry'].includes(u.type)).length);
    add('çiftçi', p, s.units.filter((u) => u.owner === p && u.order.kind === 'farm').length);
    add('toplayıcı', p, s.units.filter((u) => u.owner === p && u.order.kind === 'gather').length);
    add('inşaatçı', p, s.units.filter((u) => u.owner === p && u.order.kind === 'build').length);
    add('boşta köylü', p, s.units.filter((u) => u.owner === p && u.type === 'villager' && u.order.kind === 'idle').length);
    add('yürüyen köylü', p, s.units.filter((u) => u.owner === p && u.type === 'villager' && u.path && u.pathIdx < u.path.length).length);
    add('stok', p, prev[p]);
    add('nüfus', p, popUsed(s, p)); add('nüfus sınırı', p, popCap(s, p));
    add('yiyecek', p, s.players[p].res.food); add('odun', p, s.players[p].res.wood); add('kristal', p, s.players[p].res.crystal);
    add('sıradaki asker', p, s.buildings.filter((b) => b.owner === p).reduce((a, b) => a + b.queue.filter((q) => q.unit !== 'villager').length, 0));
    add('kahraman can%', p, (() => { const h = s.units.find((u) => u.owner === p && u.type === 'hero'); return h ? 100 : 0; })());
  }
}
for (const [k, v] of Object.entries(acc)) console.log(k.padEnd(16), v.map((x) => x.toFixed(1)).join(' / '));

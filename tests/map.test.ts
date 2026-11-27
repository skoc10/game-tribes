import { describe, expect, it } from 'vitest';
import { CFG } from '../src/sim/data';
import { walkable } from '../src/sim/path';
import { newGame } from './helpers';

describe('map layout', () => {
  it('keeps camps apart from each other, from bases and from the relic', () => {
    for (const races of [['sancak', 'kul'], ['sancak', 'kul', 'sancak']] as const) {
      const s = newGame(1, [...races]);
      expect(s.camps).toHaveLength(races.length * 2);
      s.camps.forEach((a, i) => {
        expect(walkable(s, Math.floor(a.x), Math.floor(a.y))).toBe(true);
        for (const b of s.camps.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(CFG.camp.leash);
        for (const b of s.bases) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(CFG.camp.aggro + 5);
        expect(Math.hypot(a.x - s.relic.x, a.y - s.relic.y)).toBeGreaterThan(CFG.camp.leash);
      });
    }
  });
});

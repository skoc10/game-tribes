import { describe, expect, it } from 'vitest';
import { CFG } from '../src/sim/data';
import { walkable } from '../src/sim/path';
import { newGame } from './helpers';

describe('map layout', () => {
  it('is exactly point-symmetric for two and four players, so no start position is better', () => {
    for (const n of [2, 4]) {
      const s = newGame(1, Array.from({ length: n }, () => 'sancak' as const));
      const last = s.w * s.h - 1;
      for (let i = 0; i <= last; i++) {
        expect(s.terrain[i]).toBe(s.terrain[last - i]);
        expect(s.amount[i]).toBe(s.amount[last - i]);
        expect(s.occ[i] !== 0).toBe(s.occ[last - i] !== 0);
      }
      for (const c of s.camps) expect(s.camps.some((o) => o.x === s.w - c.x && o.y === s.h - c.y)).toBe(true);
    }
  });

  it('gives every seat the same food and crystal, and nearly the same wood, with three players', () => {
    const s = newGame(1, ['sancak', 'kul', 'sancak']);
    const counts = s.bases.map((b) => {
      const c = [0, 0, 0, 0];
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const t = s.terrain[y * s.w + x]; if (t && Math.hypot(x - b.x, y - b.y) <= 14) c[t]++; }
      return c;
    });
    for (const c of counts) {
      expect(c[2]).toBe(counts[0][2]);
      expect(c[3]).toBe(counts[0][3]);
      expect(Math.abs(c[1] - counts[0][1])).toBeLessThanOrEqual(3);
    }
  });

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

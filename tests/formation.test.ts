import { describe, expect, it } from 'vitest';
import { issue } from '../src/sim/commands';
import { addUnit } from '../src/sim/state';
import { newGame, run } from './helpers';

const tileOf = (u: { x: number; y: number }) => `${Math.floor(u.x)},${Math.floor(u.y)}`;

describe('formation', () => {
  it('a group sent to one point ends one to a tile, infantry ahead of archers', () => {
    const s = newGame(1, ['sancak', 'sancak']);
    s.units = [];
    const foot = Array.from({ length: 4 }, () => addUnit(s, 0, 'infantry', 20.5, 32.5));
    const bows = Array.from({ length: 4 }, () => addUnit(s, 0, 'archer', 20.5, 32.5));
    const all = [...foot, ...bows];
    issue(s, 0, { type: 'move', units: all.map((u) => u.id), x: 30.5, y: 32.5 });
    run(s, 30);
    expect(new Set(all.map(tileOf)).size).toBe(all.length);
    // Marching towards +x: the front rank is the one furthest along x.
    const front = Math.max(...foot.map((u) => u.x)), back = Math.min(...bows.map((u) => u.x));
    expect(Math.min(...foot.map((u) => u.x))).toBe(front);
    expect(back).toBeLessThan(front);
    for (const u of all) expect(u.order.kind).toBe('idle');
  });

  it('a single unit goes exactly where it was sent', () => {
    const s = newGame(1, ['sancak', 'sancak']);
    s.units = [];
    const u = addUnit(s, 0, 'infantry', 20.5, 32.5);
    issue(s, 0, { type: 'move', units: [u.id], x: 25.5, y: 32.5 });
    run(s, 15);
    expect(tileOf(u)).toBe('25,32');
  });

  it('idle soldiers stacked on one tile step apart and then stand still', () => {
    const s = newGame(1, ['sancak', 'sancak']);
    s.units = [];
    const all = Array.from({ length: 6 }, () => addUnit(s, 0, 'infantry', 32.5, 20.5));
    run(s, 12);
    expect(new Set(all.map(tileOf)).size).toBe(all.length);
    const where = all.map(tileOf).join(' ');
    run(s, 10);
    expect(all.map(tileOf).join(' ')).toBe(where);
    for (const u of all) expect(Math.hypot(u.x - 32.5, u.y - 20.5)).toBeLessThan(3);
  });

  it('armies sent to a tile corner from opposite sides take mirror-image blocks', () => {
    const block = (fromX: number) => {
      const s = newGame(1, ['sancak', 'sancak']);
      s.units = [];
      const all = Array.from({ length: 20 }, () => addUnit(s, 0, 'infantry', fromX, 32.5));
      issue(s, 0, { type: 'move', units: all.map((u) => u.id), x: 32, y: 32 });
      return all.map((u) => u.order.kind === 'move' ? [u.order.x, u.order.y] : [0, 0]);
    };
    const west = block(20.5).map(([x, y]) => `${x},${y}`).sort();
    const east = block(43.5).map(([x, y]) => `${64 - x},${64 - y}`).sort();
    expect(east).toEqual(west);
  });

  it('a soldier is never sent to a tile it cannot walk to', () => {
    const s = newGame(1, ['sancak', 'sancak']);
    s.units = [];
    // A grass tile walled in by trees, two tiles from the stack.
    for (let y = 18; y <= 22; y++) for (let x = 30; x <= 36; x++) if (s.terrain[y * s.w + x] !== 0) s.terrain[y * s.w + x] = 0;
    for (const [x, y] of [[33, 20], [35, 20], [34, 19], [34, 21], [33, 19], [35, 19], [33, 21], [35, 21]]) s.terrain[y * s.w + x] = 1;
    const all = Array.from({ length: 14 }, () => addUnit(s, 0, 'infantry', 32.5, 20.5));
    run(s, 20);
    for (const u of all) { expect(u.order.kind).toBe('idle'); expect(`${Math.floor(u.x)},${Math.floor(u.y)}`).not.toBe('34,20'); }
    expect(new Set(all.map(tileOf)).size).toBe(all.length);
  });

  it('villagers are left alone', () => {
    const s = newGame(1, ['sancak', 'sancak']);
    s.units = [];
    const all = Array.from({ length: 3 }, () => addUnit(s, 0, 'villager', 32.5, 20.5));
    run(s, 5);
    expect(new Set(all.map(tileOf)).size).toBe(1);
  });
});

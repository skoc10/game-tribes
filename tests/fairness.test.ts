import { describe, expect, it } from 'vitest';
import { issue } from '../src/sim/commands';
import { CFG } from '../src/sim/data';
import { findPath } from '../src/sim/path';
import { relicCountdown } from '../src/sim/rules';
import { scramble } from '../src/sim/rng';
import { addUnit, createGame } from '../src/sim/state';
import { newGame, run, squad } from './helpers';

describe('guarded relic', () => {
  it('counts only while the owner stands guard, and stops while an enemy soldier is on it', () => {
    const s = newGame(1, ['sancak', 'kul']);
    const guards = squad(s, 0, 'infantry', 2, Math.floor(s.relic.x) - 1, Math.floor(s.relic.y) - 1);
    run(s, CFG.relic.captureTime + 1);
    expect(s.relic.owner).toBe(0);
    run(s, 30);
    const left = relicCountdown(s);
    expect(left).toBeLessThan(CFG.relic.holdToWin - 25);
    // The guards walk away: the relic stays theirs but the clock stops.
    issue(s, 0, { type: 'move', units: guards.map((u) => u.id), x: s.relic.x + 12, y: s.relic.y });
    run(s, 40);
    expect(s.relic.owner).toBe(0);
    expect(s.relic.counting).toBe(false);
    expect(relicCountdown(s)).toBeGreaterThan(left - 12);
    const paused = relicCountdown(s);
    run(s, 20);
    expect(relicCountdown(s)).toBe(paused);
  });
});

describe('no first strike', () => {
  it('two identical soldiers who strike in the same tick both fall', () => {
    const s = newGame(1, ['sancak', 'sancak']);
    s.units = [];
    const a = addUnit(s, 0, 'infantry', 32.5, 30.5), b = addUnit(s, 1, 'infantry', 32.5, 33.5);
    s.war[0][1] = s.war[1][0] = true;
    run(s, 60);
    expect(s.units.includes(a)).toBe(false);
    expect(s.units.includes(b)).toBe(false);
  });
});

describe('seeding and tie-breaking', () => {
  it('scrambles neighbouring seeds into unrelated ones', () => {
    const out = new Set([1000, 1001, 1002, 1003].map(scramble));
    expect(out.size).toBe(4);
    expect(Math.abs(scramble(1001) - scramble(1000))).toBeGreaterThan(1000);
    const a = createGame({ seed: 1000, players: [{ race: 'kul', isAI: true }, { race: 'kul', isAI: true }] });
    const b = createGame({ seed: 1000, players: [{ race: 'kul', isAI: true }, { race: 'kul', isAI: true }] });
    expect(a.ai.map((x) => x.nerve)).toEqual(b.ai.map((x) => x.nerve));
  });

  it('paths between mirrored points have the same length in both directions', () => {
    const s = newGame(1, ['sancak', 'kul']);
    const there = findPath(s, 20, 20, (x, y) => x === 44 && y === 40, 44, 40, undefined, 5)!;
    const back = findPath(s, 43, 43, (x, y) => x === 19 && y === 23, 19, 23, undefined, 9)!;
    expect(there.length).toBe(back.length);
  });
});

describe('no first strike, whatever the ids or the gap', () => {
  it.each([[2, 0], [3, 0], [4, 0], [3, 7], [4, 3]])('gap %i, id offset %i: both fall together', (gap, skip) => {
    const s = newGame(1, ['sancak', 'sancak']);
    s.units = [];
    s.nextId += skip;
    const a = addUnit(s, 0, 'infantry', 32.5, 30.5), b = addUnit(s, 1, 'infantry', 32.5, 30.5 + gap);
    s.war[0][1] = s.war[1][0] = true;
    run(s, 60);
    expect(s.units.includes(a)).toBe(false);
    expect(s.units.includes(b)).toBe(false);
  });

  it('the same holds when the later-listed soldier belongs to the first seat', () => {
    const s = newGame(1, ['sancak', 'sancak']);
    s.units = [];
    const b = addUnit(s, 1, 'infantry', 30.5, 32.5), a = addUnit(s, 0, 'infantry', 34.5, 32.5);
    s.war[0][1] = s.war[1][0] = true;
    run(s, 60);
    expect(s.units.includes(a)).toBe(false);
    expect(s.units.includes(b)).toBe(false);
  });
});

/** A point-mirrored fight with the given seat first in the unit list. Returns survivors as [first-listed, later-listed]. */
function mirrored(type: string, spots: number[][], firstSeat: number): [number, number] {
  const s = newGame(1, ['sancak', 'sancak']);
  s.units = [];
  s.war[0][1] = s.war[1][0] = true;
  const place = (seat: number) => spots.forEach(([x, y]) => {
    const u = seat === 0 ? addUnit(s, 0, type, x, y) : addUnit(s, 1, type, 64 - x, 64 - y);
    u.order = { kind: 'attackMove', x: 32.5, y: 32.5 };
  });
  place(firstSeat); place(1 - firstSeat);
  run(s, 120);
  const left = (p: number) => s.units.filter((u) => u.owner === p).length;
  return [left(firstSeat), left(1 - firstSeat)];
}

describe('mirrored fights do not depend on who is listed first', () => {
  // Off the grid and off the axes; the archer case is one where the later-listed archer used to win.
  it.each([['archer', 30.23, 30.35], ['archer', 29.1, 33.7], ['infantry', 28.4, 30.9], ['cavalry', 27.2, 34.6]])(
    'a duel of %s from (%f, %f) ends level in either order', (type, x, y) => {
      for (const first of [0, 1]) { const [a, b] = mirrored(type as string, [[x as number, y as number]], first); expect(a).toBe(b); }
    });

  it('over many small battles neither list position wins more often', () => {
    // Groups cannot mirror exactly (paths and target choice vary with unit ids), so this is a count:
    // each placement is fought twice, once with each seat listed first.
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    let first = 0, later = 0;
    for (let i = 0; i < 120; i++) {
      const type = ['infantry', 'cavalry', 'archer'][i % 3];
      const spots = Array.from({ length: 2 + (i % 4) }, () => [26 + rnd() * 5, 28 + rnd() * 8]);
      for (const seat of [0, 1]) {
        const [a, b] = mirrored(type, spots, seat);
        if (a > 0 && b === 0) first++; else if (b > 0 && a === 0) later++;
      }
    }
    expect(first + later).toBeGreaterThan(60);
    // Three standard deviations of a fair coin over the decided fights.
    expect(Math.abs(first - later)).toBeLessThan(3 * Math.sqrt(first + later));
  }, 30000);
});

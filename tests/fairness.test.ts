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

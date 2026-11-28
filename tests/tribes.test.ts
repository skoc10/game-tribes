import { describe, expect, it } from 'vitest';
import { maxHp, rangeOf } from '../src/sim/combat';
import { issue } from '../src/sim/commands';
import { RACES, UNITS } from '../src/sim/data';
import { runMatch } from '../src/sim/headless';
import { newGame, run, squad } from './helpers';

describe('the other two tribes', () => {
  it('Yaprakdiller: longer archer range and lower unit hit points', () => {
    const s = newGame(1, ['yaprak', 'sancak']);
    const [mine] = squad(s, 0, 'archer', 1, 30, 30), [theirs] = squad(s, 1, 'archer', 1, 30, 34);
    expect(rangeOf(s, mine)).toBe(UNITS.archer.range + 1);
    expect(rangeOf(s, theirs)).toBe(UNITS.archer.range);
    expect(maxHp(mine)).toBe(Math.round(UNITS.archer.hp * RACES.yaprak.unitHp));
    expect(mine.hp).toBe(maxHp(mine));
    const [inf] = squad(s, 0, 'infantry', 1, 28, 30);
    expect(rangeOf(s, inf)).toBe(0);
  });

  it('Taşocaklılar: armoured infantry, sturdier buildings, slower units', () => {
    const s = newGame(1, ['tasocak', 'sancak']);
    const tc = s.buildings.find((b) => b.owner === 0)!, other = s.buildings.find((b) => b.owner === 1)!;
    expect(tc.maxHp).toBe(Math.round(other.maxHp * RACES.tasocak.buildingHp));
    s.war[0][1] = s.war[1][0] = true;
    const [mine] = squad(s, 0, 'infantry', 1, 30, 30), [theirs] = squad(s, 1, 'infantry', 1, 31, 30);
    issue(s, 1, { type: 'attack', units: [theirs.id], target: mine.id, building: false });
    run(s, 0.3);
    expect(mine.hp).toBe(60 - (UNITS.infantry.damage - RACES.tasocak.infantryArmor));
    const [slow] = squad(s, 0, 'cavalry', 1, 20, 40), [fast] = squad(s, 1, 'cavalry', 1, 20, 42);
    issue(s, 0, { type: 'move', units: [slow.id], x: 30.5, y: 40.5 });
    issue(s, 1, { type: 'move', units: [fast.id], x: 30.5, y: 42.5 });
    run(s, 4);
    expect(slow.x).toBeLessThan(fast.x - 0.3);
  });

  it('can be played by the AI to the end of a match', () => {
    const r = runMatch(21, [{ race: 'yaprak', personality: 'expander' }, { race: 'tasocak', personality: 'trader' }, { race: 'kul', personality: 'expander' }]);
    expect(r.winner).toBeGreaterThanOrEqual(0);
  }, 30000);
});

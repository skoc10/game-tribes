import { describe, expect, it } from 'vitest';
import { issue } from '../src/sim/commands';
import { walkable } from '../src/sim/path';
import { addBuilding, canPlace } from '../src/sim/state';
import { CFG } from '../src/sim/data';
import { T_TREE } from '../src/sim/types';
import { newGame, run, squad, unitsOf } from './helpers';

describe('phase 2 review fixes', () => {
  it('an archer boxed in on the direct line walks around to get in range', () => {
    const s = newGame();
    const x = 30, y = 30;
    const archer = squad(s, 0, 'archer', 1, x, y)[0];
    for (const [dx, dy] of [[1, 0], [1, 1], [0, 1]]) { s.terrain[(y + dy) * s.w + x + dx] = T_TREE; s.amount[(y + dy) * s.w + x + dx] = 100; }
    const target = squad(s, 1, 'villager', 1, x + 5, y + 4)[0];
    issue(s, 0, { type: 'attack', units: [archer.id], target: target.id, building: false });
    run(s, 30);
    expect(s.units.includes(target)).toBe(false);
  });

  it('archers reach a building from its corner', () => {
    const s = newGame();
    const b = addBuilding(s, 1, 'barracks', 30, 30, true);
    const archer = squad(s, 0, 'archer', 1, 22, 22)[0];
    s.war[0][1] = s.war[1][0] = true;
    issue(s, 0, { type: 'attack', units: [archer.id], target: b.id, building: true });
    run(s, 30);
    expect(b.hp).toBeLessThan(b.maxHp);
  });

  it('beasts chase archers who shoot them from outside the aggro circle', () => {
    const s = newGame();
    const camp = s.camps[0];
    // Stand the archers on open ground six tiles from the camp, whichever side is clear.
    const cx = Math.floor(camp.x), cy = Math.floor(camp.y);
    const [dx] = [6, -6].filter((d) => [-1, 0, 1].every((k) => walkable(s, cx + d, cy + k) && walkable(s, cx + d / 2, cy + k)));
    const archers = squad(s, 0, 'archer', 3, cx + dx, cy - 1);
    const beast = s.units.find((u) => u.camp === 0)!;
    issue(s, 0, { type: 'attack', units: archers.map((u) => u.id), target: beast.id, building: false });
    run(s, 30);
    expect(archers.some((u) => u.hp < 35 || !s.units.includes(u))).toBe(true);
  });

  it('camp sites cannot be built on, and respawns never land inside a building', () => {
    const s = newGame();
    const camp = s.camps[0];
    expect(canPlace(s, 'barracks', Math.floor(camp.x) - 1, Math.floor(camp.y) - 1)).toBe(false);
    s.units = s.units.filter((u) => u.camp !== 0);
    camp.alive = 0; camp.respawnAt = s.time + 1;
    addBuilding(s, 1, 'barracks', Math.floor(camp.x) - 1, Math.floor(camp.y) - 1, true);
    run(s, 2);
    const beasts = s.units.filter((u) => u.camp === 0);
    expect(beasts).toHaveLength(CFG.camp.count[1]);
    for (const u of beasts) expect(s.occ[Math.floor(u.y) * s.w + Math.floor(u.x)]).toBe(0);
  });

  it('auto-explore next to a camp neither stalls nor fakes exploration', () => {
    const s = newGame();
    const scout = unitsOf(s, 0, 'scout')[0];
    const camp = s.camps[0];
    scout.x = camp.x + 3; scout.y = camp.y;
    issue(s, 0, { type: 'explore', units: [scout.id] });
    const start = { x: scout.x, y: scout.y };
    run(s, 60);
    expect(Math.hypot(scout.x - start.x, scout.y - start.y)).toBeGreaterThan(8);
    expect(scout.order.kind).toBe('explore');
    expect(scout.hp).toBe(30);
  });
});

import { describe, expect, it } from 'vitest';
import { issue } from '../src/sim/commands';
import { CFG } from '../src/sim/data';
import { addBuilding, canPlace, removeBuilding } from '../src/sim/state';
import { newGame, run, squad, tcOf, unitsOf } from './helpers';

describe('phase 3 review fixes', () => {
  it('a replacement Ana Merkez under construction delays elimination, but not forever', () => {
    const s = newGame(1, ['sancak', 'kul']);
    removeBuilding(s, tcOf(s, 1));
    run(s, 45);
    const site = addBuilding(s, 1, 'towncenter', s.bases[1].x - 1, s.bases[1].y + 6, false);
    run(s, CFG.eliminationGrace);
    expect(s.players[1].alive).toBe(true);
    site.progress = 1;
    run(s, 1);
    expect(s.players[1].tcLostAt).toBe(-1);
    removeBuilding(s, site);
    addBuilding(s, 1, 'towncenter', s.bases[1].x - 1, s.bases[1].y + 6, false);
    run(s, CFG.eliminationGrace * 2 + 2);
    expect(s.players[1].alive).toBe(false);
    expect(s.winner).toBe(0);
  });

  it('a player eliminated in the same tick cannot win with the relic', () => {
    const s = newGame(1, ['sancak', 'kul']);
    squad(s, 0, 'infantry', 2, Math.floor(s.relic.x) - 1, Math.floor(s.relic.y) - 1);
    run(s, CFG.relic.captureTime + 1);
    expect(s.relic.owner).toBe(0);
    run(s, 100);
    s.relic.heldSince = s.time - CFG.relic.holdToWin + 5;
    removeBuilding(s, tcOf(s, 0));
    s.players[0].tcLostAt = s.time - CFG.eliminationGrace + 5;
    // Both deadlines fall in the same tick; step once to get there.
    run(s, 0.1);
    s.players[0].tcLostAt = s.time - CFG.eliminationGrace;
    s.relic.heldSince = s.time - CFG.relic.holdToWin;
    run(s, 10);
    expect(s.winner).toBe(1);
    expect(s.winKind).toBe('conquest');
  });

  it('when everyone would be eliminated at once, one survivor wins', () => {
    const s = newGame(1, ['sancak', 'kul']);
    for (const p of [0, 1]) removeBuilding(s, tcOf(s, p));
    run(s, CFG.eliminationGrace + 2);
    expect(s.players.filter((p) => p.alive)).toHaveLength(1);
    expect(s.winner).toBeGreaterThanOrEqual(0);
  });

  it('nothing can be built on the relic', () => {
    const s = newGame();
    const x = Math.floor(s.relic.x), y = Math.floor(s.relic.y);
    for (const [dx, dy] of [[0, 0], [-3, 0], [2, 2], [-4, -4]]) expect(canPlace(s, 'house', x + dx, y + dy)).toBe(false);
    expect(canPlace(s, 'house', x + 6, y)).toBe(true);
  });

  it('experience does not bank up at the peace level cap', () => {
    const s = newGame(1, ['sancak', 'kul'], 9999);
    const p = s.players[0];
    p.heroLevel = CFG.peaceHeroCap;
    const hero = unitsOf(s, 0, 'hero')[0];
    const camp = s.camps[0];
    hero.x = camp.x + 3; hero.y = camp.y;
    const army = [2, 3, 4].flatMap((dx) => squad(s, 0, 'cavalry', 4, Math.floor(camp.x) + dx, Math.floor(camp.y) - 2));
    issue(s, 0, { type: 'attackMove', units: army.map((u) => u.id), x: camp.x, y: camp.y });
    run(s, 60);
    expect(p.heroLevel).toBe(CFG.peaceHeroCap);
    expect(p.heroXp).toBeLessThan(CFG.hero.xpPerLevel * CFG.peaceHeroCap);
  });

  it('age advance is paid once and refunded if the building falls', () => {
    const s = newGame();
    const p = s.players[0];
    p.res.food = 2000; p.res.wood = 2000;
    addBuilding(s, 0, 'house', s.bases[0].x + 4, s.bases[0].y + 6, true);
    addBuilding(s, 0, 'barracks', s.bases[0].x + 8, s.bases[0].y + 6, true);
    const second = addBuilding(s, 0, 'towncenter', s.bases[0].x - 8, s.bases[0].y + 8, true);
    expect(issue(s, 0, { type: 'ageUp', building: tcOf(s, 0).id }).ok).toBe(true);
    expect(issue(s, 0, { type: 'ageUp', building: second.id }).ok).toBe(false);
    expect(p.res.food).toBe(1600);
    const tc = tcOf(s, 0);
    tc.hp = 1;
    s.war[0][1] = s.war[1][0] = true;
    const raid = squad(s, 1, 'cavalry', 4, tc.tx + 4, tc.ty);
    issue(s, 1, { type: 'attack', units: raid.map((u) => u.id), target: tc.id, building: true });
    run(s, 10);
    expect(s.buildings.includes(tc)).toBe(false);
    expect(p.res.food).toBeGreaterThanOrEqual(2000);
    expect(p.age).toBe(1);
  });

  it('peace announcements fire exactly once, even for fractional lengths', () => {
    const s = newGame(1, ['sancak', 'kul'], 79.7);
    run(s, 100);
    expect(s.events.filter((e) => e.kind === 'peace' && e.player === 0)).toHaveLength(2);
  });
});

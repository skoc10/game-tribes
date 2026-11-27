import { describe, expect, it } from 'vitest';
import { issue } from '../src/sim/commands';
import { CFG } from '../src/sim/data';
import { relicCountdown } from '../src/sim/rules';
import { addBuilding } from '../src/sim/state';
import { newGame, run, squad, tcOf, unitsOf } from './helpers';
import type { Game } from '../src/sim/types';

const atRelic = (s: Game, player: number, n = 2) => squad(s, player, 'infantry', n, Math.floor(s.relic.x) - 1 + player, Math.floor(s.relic.y) - 1);
const give = (s: Game, player: number, type: string, dx: number) => addBuilding(s, player, type, s.bases[player].x + dx, s.bases[player].y + 6, true);

describe('peace period', () => {
  it('blocks attacks between players and ends with a warning and a horn', () => {
    const s = newGame(1, ['sancak', 'kul', 'sancak'], 90);
    const mine = squad(s, 0, 'infantry', 2, 30, 30), theirs = squad(s, 1, 'infantry', 2, 32, 30);
    const attack = () => issue(s, 0, { type: 'attack', units: mine.map((u) => u.id), target: theirs[0].id, building: false });
    expect(attack().ok).toBe(false);
    expect(s.war[0][1]).toBe(false);
    run(s, 89);
    expect(theirs[0].hp).toBe(60);
    expect(s.events.filter((e) => e.kind === 'peace' && e.player === 0)).toHaveLength(1);
    run(s, 2);
    expect(s.events.filter((e) => e.kind === 'peace' && e.player === 0)).toHaveLength(2);
    expect(attack().ok).toBe(true);
    run(s, 30);
    expect(theirs[0].hp).toBeLessThan(60);
  });

  it('still allows hunting camps, with the hero capped at level 3', () => {
    const s = newGame(1, ['kul', 'sancak', 'sancak'], 9999);
    const hero = unitsOf(s, 0, 'hero')[0];
    s.players[0].heroXp = 5000;
    const camp = s.camps[0];
    hero.x = camp.x + 3; hero.y = camp.y;
    const army = squad(s, 0, 'cavalry', 12, Math.floor(camp.x) + 2, Math.floor(camp.y) - 5);
    issue(s, 0, { type: 'attackMove', units: army.map((u) => u.id), x: camp.x, y: camp.y });
    run(s, 60);
    expect(camp.alive).toBe(0);
    expect(s.players[0].res.food).toBe(CFG.startResources.food + 60);
    expect(s.players[0].heroLevel).toBe(CFG.peaceHeroCap);
  });
});

describe('ages and research', () => {
  it('needs two building types and the cost, then unlocks Age II buildings', () => {
    const s = newGame();
    const p = s.players[0], tc = tcOf(s, 0);
    const v = unitsOf(s, 0, 'villager')[0];
    p.res.food = 1000; p.res.wood = 1000;
    expect(issue(s, 0, { type: 'ageUp', building: tc.id }).reason).toContain('farklı bina');
    give(s, 0, 'house', 4);
    give(s, 0, 'barracks', 8);
    expect(issue(s, 0, { type: 'build', units: [v.id], building: 'stable', tx: s.bases[0].x, ty: s.bases[0].y + 9 }).ok).toBe(false);
    expect(issue(s, 0, { type: 'ageUp', building: tc.id }).ok).toBe(true);
    expect(p.res.food).toBe(600);
    expect(issue(s, 0, { type: 'ageUp', building: tc.id }).ok).toBe(false);
    run(s, CFG.age2.time - 1);
    expect(p.age).toBe(1);
    run(s, 2);
    expect(p.age).toBe(2);
    expect(issue(s, 0, { type: 'build', units: [v.id], building: 'stable', tx: s.bases[0].x, ty: s.bases[0].y + 9 }).ok).toBe(true);
  });

  it('charges Külboyları more for technology and applies weapon and armour upgrades', () => {
    const s = newGame();
    for (const p of s.players) { p.age = 2; p.res.food = 500; p.res.crystal = 500; }
    const smith0 = give(s, 0, 'blacksmith', 4), smith1 = give(s, 1, 'blacksmith', 4);
    expect(issue(s, 0, { type: 'research', building: smith0.id, tech: 'weapon1' }).ok).toBe(true);
    expect(issue(s, 1, { type: 'research', building: smith1.id, tech: 'armor1' }).ok).toBe(true);
    expect(s.players[0].res.crystal).toBe(450);
    expect(s.players[1].res.crystal).toBe(440);
    expect(issue(s, 0, { type: 'research', building: smith0.id, tech: 'armor1' }).ok).toBe(false);
    run(s, 31);
    expect(s.players[0].upgrades).toEqual(['weapon1']);
    expect(issue(s, 0, { type: 'research', building: smith0.id, tech: 'weapon1' }).ok).toBe(false);
    // Infantry (7 + 1) against armoured infantry (-1): exactly 7 per hit.
    const a = squad(s, 0, 'infantry', 1, 30, 30)[0], d = squad(s, 1, 'infantry', 1, 31, 30)[0];
    issue(s, 0, { type: 'attack', units: [a.id], target: d.id, building: false });
    run(s, 0.3);
    expect(d.hp).toBe(60 - 7);
  });
});

describe('Kadim Harabe', () => {
  it('sleeps during peace', () => {
    const s = newGame(1, ['sancak', 'kul', 'sancak'], 9999);
    atRelic(s, 0);
    run(s, 60);
    expect(s.relic.owner).toBe(-1);
    expect(s.relic.progress).toBe(0);
  });

  it('is captured after 20 uncontested seconds, pays crystal, and wins after 3 minutes', () => {
    const s = newGame();
    atRelic(s, 0);
    run(s, CFG.relic.captureTime - 1);
    expect(s.relic.owner).toBe(-1);
    run(s, 2);
    expect(s.relic.owner).toBe(0);
    expect(relicCountdown(s)).toBeGreaterThan(CFG.relic.holdToWin - 2);
    run(s, 60);
    expect(s.players[0].res.crystal).toBeCloseTo(CFG.relic.crystalPerMinute * (61 / 60), 0);
    expect(s.winner).toBe(-1);
    run(s, CFG.relic.holdToWin);
    expect(s.winner).toBe(0);
    expect(s.winKind).toBe('relic');
    const tick = s.tick;
    run(s, 5);
    expect(s.tick).toBe(tick);
  });

  it('stalls while two players stand on it and changes hands when the holder leaves', () => {
    const s = newGame();
    const mine = atRelic(s, 0);
    atRelic(s, 1);
    run(s, 40);
    expect(s.relic.owner).toBe(-1);
    s.units = s.units.filter((u) => !mine.includes(u));
    run(s, CFG.relic.captureTime + 1);
    expect(s.relic.owner).toBe(1);
  });
});

describe('elimination and conquest', () => {
  it('gives 90 seconds to rebuild, then eliminates; the last player standing wins', () => {
    const s = newGame(1, ['sancak', 'kul']);
    const tc = tcOf(s, 1);
    tc.hp = 1;
    s.war[0][1] = s.war[1][0] = true;
    const army = squad(s, 0, 'cavalry', 6, tc.tx + 5, tc.ty);
    issue(s, 0, { type: 'attack', units: army.map((u) => u.id), target: tc.id, building: true });
    run(s, 20);
    expect(s.buildings.includes(tc)).toBe(false);
    expect(s.players[1].alive).toBe(true);
    expect(s.players[1].tcLostAt).toBeGreaterThan(0);
    run(s, CFG.eliminationGrace + 1);
    expect(s.players[1].alive).toBe(false);
    expect(s.units.some((u) => u.owner === 1)).toBe(false);
    expect(s.winner).toBe(0);
    expect(s.winKind).toBe('conquest');
  });

  it('cancels elimination when a new Ana Merkez is finished in time', () => {
    const s = newGame(1, ['sancak', 'kul']);
    const tc = tcOf(s, 1);
    s.buildings = s.buildings.filter((b) => b !== tc);
    for (let y = tc.ty; y < tc.ty + 3; y++) for (let x = tc.tx; x < tc.tx + 3; x++) s.occ[y * s.w + x] = 0;
    run(s, 30);
    expect(s.players[1].tcLostAt).toBeGreaterThan(0);
    addBuilding(s, 1, 'towncenter', tc.tx, tc.ty + 6, true);
    run(s, CFG.eliminationGrace + 5);
    expect(s.players[1].alive).toBe(true);
    expect(s.winner).toBe(-1);
  });
});

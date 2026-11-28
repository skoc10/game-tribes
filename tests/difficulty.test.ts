import { describe, expect, it } from 'vitest';
import { CFG } from '../src/sim/data';
import { issue } from '../src/sim/commands';
import { runMatch } from '../src/sim/headless';
import { addBuilding, createGame, idleVillagers, nearestNode } from '../src/sim/state';
import { T_BUSH, T_TREE } from '../src/sim/types';
import type { Difficulty, Game } from '../src/sim/types';
import { freeSite, run, tcOf, unitsOf } from './helpers';

const game = (difficulty?: Difficulty): Game => createGame({
  seed: 7, difficulty,
  players: [{ race: 'yaprak', isAI: false }, { race: 'sancak', isAI: true, personality: 'trader' }, { race: 'kul', isAI: true, personality: 'expander' }],
});
const buildings = (s: Game, p: number) => s.buildings.filter((b) => b.owner === p).length;

describe('difficulty', () => {
  it('defaults to full speed with no help', () => {
    const s = game();
    expect(s.difficulty).toBe('komutan');
    expect(tcOf(s, 0).autoVillager).toBe(false);
    run(s, 30);
    expect(idleVillagers(s, 0)).toHaveLength(CFG.startVillagers);
  });

  it('on Çırak a human who does nothing still gets a working economy', () => {
    const s = game('cirak');
    expect(s.peaceEnd).toBe(600);
    expect(tcOf(s, 0).autoVillager).toBe(true);
    run(s, 120);
    expect(unitsOf(s, 0, 'villager').length).toBeGreaterThan(CFG.startVillagers);
    expect(idleVillagers(s, 0)).toHaveLength(0);
    expect(s.players[0].res.food).toBeGreaterThan(CFG.startResources.food);
    expect(s.players[0].res.wood).toBeGreaterThan(CFG.startResources.wood);
  });

  it('the human is not helped where the AI is concerned: AI seats never get the helper', () => {
    const s = game('cirak');
    expect(tcOf(s, 1).autoVillager).toBe(false);
  });

  it('AI neighbours grow more slowly on easier levels', () => {
    const at = (d: Difficulty) => { const s = game(d); run(s, 360); return s; };
    const easy = at('cirak'), mid = at('kasif'), hard = at('komutan');
    for (const p of [1, 2]) {
      expect(unitsOf(easy, p, 'villager').length).toBeLessThanOrEqual(CFG.difficulty.cirak.villagers);
      expect(unitsOf(easy, p, 'villager').length).toBeLessThan(unitsOf(mid, p, 'villager').length);
      expect(unitsOf(mid, p, 'villager').length).toBeLessThan(unitsOf(hard, p, 'villager').length);
      expect(buildings(easy, p)).toBeLessThan(buildings(hard, p));
      expect(easy.players[p].age).toBe(1);
      expect(hard.players[p].age).toBe(2);
    }
  });

  it('a Çırak AI still reaches the Kale Çağı and fields an army', () => {
    const s = game('cirak');
    run(s, 720);
    for (const p of [1, 2]) {
      expect(s.players[p].age).toBe(2);
      expect(unitsOf(s, p, 'infantry').length + unitsOf(s, p, 'archer').length + unitsOf(s, p, 'cavalry').length).toBeGreaterThan(3);
    }
  });

  it('the helper stops training villagers early and leaves food to spend', () => {
    const s = game('cirak');
    s.buildings.filter((b) => b.owner === 0).forEach((b) => { if (b.type === 'towncenter') b.rallyTile = -1; });
    // Room for everyone, so only the helper's own limit can stop it.
    for (let i = 0; i < 6; i++) { const site = freeSite(s, 0, 'house'); addBuilding(s, 0, 'house', site.tx, site.ty, true); }
    run(s, 400);
    expect(unitsOf(s, 0, 'villager')).toHaveLength(CFG.difficulty.cirak.helperVillagers);
    expect(s.players[0].res.food).toBeGreaterThan(CFG.age2.cost.food);
  });

  it('idle villagers are put back to work, and farms are built once the bushes are gone', () => {
    const s = game('cirak');
    for (let i = 0; i < s.terrain.length; i++) if (s.terrain[i] === T_BUSH) { s.terrain[i] = 0; s.amount[i] = 0; }
    run(s, 90);
    expect(idleVillagers(s, 0)).toHaveLength(0);
    expect(s.buildings.some((b) => b.owner === 0 && b.type === 'farm')).toBe(true);
    const before = s.players[0].res.food;
    run(s, 120);
    expect(s.players[0].res.food + 50 * unitsOf(s, 0, 'villager').length).toBeGreaterThan(before);
    expect(unitsOf(s, 0, 'villager').some((u) => u.order.kind === 'farm')).toBe(true);
  });

  it('a rally point set by the player wins over the helper', () => {
    const s = game('cirak');
    const tc = tcOf(s, 0), tile = nearestNode(s, T_TREE, tc.tx, tc.ty, 20);
    expect(issue(s, 0, { type: 'rally', building: tc.id, tile }).ok).toBe(true);
    const known = new Set(s.units.map((u) => u.id));
    run(s, 15);
    const fresh = unitsOf(s, 0, 'villager').filter((u) => !known.has(u.id));
    expect(fresh.length).toBeGreaterThan(0);
    for (const u of fresh) expect(u.order.kind === 'gather' && u.order.terrain === T_TREE).toBe(true);
  });

  it('on Çırak the neighbours pick no fight of their own for a while after the horn', () => {
    const s = game('cirak');
    const until = s.peaceEnd + CFG.difficulty.cirak.quietAfterPeace;
    while (s.time < until - 1) { run(s, 5); for (const p of [1, 2]) { expect(s.ai[p].goal).toBe('none'); expect(s.war[p][0]).toBe(false); } }
  }, 30000);

  it('headless matches use the level\'s own peace time unless told otherwise', () => {
    expect(runMatch(3, [{ race: 'sancak', personality: 'trader' }, { race: 'kul', personality: 'expander' }], 0, undefined, 'cirak').game.peaceEnd).toBe(600);
    expect(runMatch(3, [{ race: 'sancak', personality: 'trader' }, { race: 'kul', personality: 'expander' }], 0).game.peaceEnd).toBe(480);
  });
});

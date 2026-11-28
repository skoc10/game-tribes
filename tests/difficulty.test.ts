import { describe, expect, it } from 'vitest';
import { CFG } from '../src/sim/data';
import { createGame, idleVillagers } from '../src/sim/state';
import type { Difficulty, Game } from '../src/sim/types';
import { run, tcOf, unitsOf } from './helpers';

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
});

import { describe, expect, it } from 'vitest';
import { issue } from '../src/sim/commands';
import { CFG, RACES, UNITS } from '../src/sim/data';
import { findPath } from '../src/sim/path';
import { idleVillagers, nearestNode, popCap, popUsed } from '../src/sim/state';
import { T_BUSH, T_TREE, type Game } from '../src/sim/types';
import { newGame, run, tcOf as tc } from './helpers';

const villagers = (s: Game, p: number) => s.units.filter((u) => u.owner === p && u.type === 'villager');

describe('map', () => {
  it('gives every player the same start', () => {
    const s = newGame();
    for (const p of s.players) {
      expect(villagers(s, p.id)).toHaveLength(CFG.startVillagers);
      expect(s.units.filter((u) => u.owner === p.id && u.type === 'scout')).toHaveLength(1);
      expect(s.units.filter((u) => u.owner === p.id && u.type === 'hero')).toHaveLength(1);
      const b = s.bases[p.id];
      for (const t of [T_TREE, T_BUSH]) expect(nearestNode(s, t, b.x, b.y, 12)).toBeGreaterThanOrEqual(0);
    }
  });

  it('connects every base to the centre', () => {
    const s = newGame();
    const cx = Math.floor(s.center.x), cy = Math.floor(s.center.y);
    for (const b of s.bases) {
      expect(findPath(s, b.x + 2, b.y, (x, y) => x === cx && y === cy, cx, cy)).not.toBeNull();
    }
  });
});

describe('economy', () => {
  it('gathers at roughly the configured rate', () => {
    const s = newGame();
    const b = s.bases[0];
    const tile = nearestNode(s, T_TREE, b.x, b.y, 12);
    const ids = villagers(s, 0).map((u) => u.id);
    const before = s.players[0].res.wood;
    expect(issue(s, 0, { type: 'gather', units: ids, tile }).ok).toBe(true);
    run(s, 80);
    const gained = s.players[0].res.wood - before;
    // Roughly a minute of work after walking, and never more than the full 80 s at the configured rate.
    const perSecond = (ids.length * CFG.gatherPerMinute.wood) / 60;
    expect(gained).toBeGreaterThan(perSecond * 40);
    expect(gained).toBeLessThan(perSecond * 80 + 1);
  });

  it('moves on to the next node when one runs out', () => {
    const s = newGame();
    const b = s.bases[0];
    const tile = nearestNode(s, T_BUSH, b.x, b.y, 12);
    s.amount[tile] = 2;
    const v = villagers(s, 0)[0];
    issue(s, 0, { type: 'gather', units: [v.id], tile });
    run(s, 60);
    expect(s.terrain[tile]).toBe(0);
    expect(v.order.kind).toBe('gather');
    expect(s.players[0].res.food).toBeGreaterThan(CFG.startResources.food + 2);
  });

  it('reports villagers with nothing to do', () => {
    const s = newGame();
    expect(idleVillagers(s, 0)).toHaveLength(CFG.startVillagers);
    issue(s, 0, { type: 'gather', units: [villagers(s, 0)[0].id], tile: nearestNode(s, T_TREE, s.bases[0].x, s.bases[0].y, 12) });
    expect(idleVillagers(s, 0)).toHaveLength(CFG.startVillagers - 1);
  });
});

describe('production', () => {
  it('trains a villager, charging food and population', () => {
    const s = newGame();
    const food = s.players[0].res.food;
    expect(issue(s, 0, { type: 'train', building: tc(s, 0).id, unit: 'villager' }).ok).toBe(true);
    expect(s.players[0].res.food).toBe(food - 50);
    run(s, UNITS.villager.trainTime + 1);
    expect(villagers(s, 0)).toHaveLength(CFG.startVillagers + 1);
  });

  it('refuses to train past the population cap', () => {
    const s = newGame();
    s.players[0].res.food = 5000;
    const b = tc(s, 0);
    let refused = '';
    for (let i = 0; i < 30 && !refused; i++) {
      const r = issue(s, 0, { type: 'train', building: b.id, unit: 'villager' });
      if (!r.ok && r.reason !== 'Üretim sırası dolu') refused = r.reason!;
      run(s, 16);
    }
    expect(refused).toContain('Nüfus');
    expect(popUsed(s, 0)).toBeLessThanOrEqual(popCap(s, 0));
  });

  it('applies race modifiers to unit cost', () => {
    const s = newGame();
    s.players[1].res.food = 100;
    issue(s, 1, { type: 'train', building: tc(s, 1).id, unit: 'villager' });
    expect(s.players[1].res.food).toBe(100 - Math.round(50 * RACES.kul.unitCost['*']));
    expect(RACES.kul.unitCost['*']).toBeLessThan(1);
  });
});

describe('construction', () => {
  it('builds a house and raises the population cap', () => {
    const s = newGame();
    const b = s.bases[0];
    const cap = popCap(s, 0);
    const v = villagers(s, 0)[0];
    let placed = false;
    for (let dx = 3; dx < 8 && !placed; dx++)
      placed = issue(s, 0, { type: 'build', units: [v.id], building: 'house', tx: b.x + dx, ty: b.y + 3 }).ok;
    expect(placed).toBe(true);
    expect(s.players[0].res.wood).toBe(CFG.startResources.wood - 30);
    expect(popCap(s, 0)).toBe(cap);
    run(s, 30);
    expect(popCap(s, 0)).toBe(cap + 5);
    expect(v.order.kind).toBe('idle');
  });

  it('rejects buildings from a later age and blocked sites', () => {
    const s = newGame();
    const v = villagers(s, 0)[0];
    const b = s.bases[0];
    expect(issue(s, 0, { type: 'build', units: [v.id], building: 'stable', tx: b.x + 5, ty: b.y + 5 }).ok).toBe(false);
    expect(issue(s, 0, { type: 'build', units: [v.id], building: 'house', tx: b.x, ty: b.y }).ok).toBe(false);
  });

  it('puts the builder to work on a finished farm', () => {
    const s = newGame();
    const b = s.bases[0];
    const v = villagers(s, 0)[0];
    let placed = false;
    for (let dx = 3; dx < 8 && !placed; dx++)
      placed = issue(s, 0, { type: 'build', units: [v.id], building: 'farm', tx: b.x + dx, ty: b.y + 3 }).ok;
    expect(placed).toBe(true);
    const food = s.players[0].res.food;
    run(s, 80);
    expect(v.order.kind).toBe('farm');
    expect(s.players[0].res.food).toBeGreaterThan(food + 20);
  });
});

describe('determinism', () => {
  it('produces identical state from the same seed and commands', () => {
    const play = () => {
      const s = newGame(7);
      for (const p of s.players) {
        const b = s.bases[p.id];
        issue(s, p.id, { type: 'gather', units: villagers(s, p.id).map((u) => u.id), tile: nearestNode(s, T_TREE, b.x, b.y, 12) });
        issue(s, p.id, { type: 'autoVillager', building: tc(s, p.id).id, on: true });
      }
      run(s, 120);
      return JSON.stringify([s.players.map((p) => p.res), s.units.map((u) => [u.id, u.x, u.y])]);
    };
    expect(play()).toBe(play());
  });
});

import { describe, expect, it } from 'vitest';
import { issue } from '../src/sim/commands';
import { CFG } from '../src/sim/data';
import { createGame } from '../src/sim/state';
import { freeSite } from './helpers';

const game = () => createGame({ seed: 1, players: [{ race: 'sancak', isAI: false }, { race: 'kul', isAI: true }] });

describe('placement and cancelling', () => {
  it('refuses to build on top of a unit', () => {
    const s = game();
    const b = s.bases[0];
    const v = s.units.filter((u) => u.owner === 0 && u.type === 'villager');
    v[1].x = b.x + 8.5; v[1].y = b.y + 8.5;
    expect(issue(s, 0, { type: 'build', units: [v[0].id], building: 'barracks', tx: b.x + 7, ty: b.y + 7 }).ok).toBe(false);
    expect(s.players[0].res.wood).toBe(CFG.startResources.wood);
  });

  it('refuses non-integer coordinates without charging', () => {
    const s = game();
    const v = s.units.find((u) => u.owner === 0 && u.type === 'villager')!;
    expect(issue(s, 0, { type: 'build', units: [v.id], building: 'house', tx: NaN, ty: NaN }).ok).toBe(false);
    expect(s.players[0].res.wood).toBe(CFG.startResources.wood);
    expect(s.buildings).toHaveLength(2);
  });

  it('refunds a cancelled foundation and frees its tiles', () => {
    const s = game();
    const v = s.units.find((u) => u.owner === 0 && u.type === 'villager')!;
    const site = freeSite(s, 0, 'house');
    expect(issue(s, 0, { type: 'build', units: [v.id], building: 'house', ...site }).ok).toBe(true);
    const house = s.buildings[s.buildings.length - 1];
    expect(issue(s, 1, { type: 'cancel', building: house.id }).ok).toBe(false);
    expect(issue(s, 0, { type: 'cancel', building: house.id }).ok).toBe(true);
    expect(s.players[0].res.wood).toBe(CFG.startResources.wood);
    expect(s.occ[site.ty * s.w + site.tx]).toBe(0);
  });

  it('accepts a rally point only on a resource tile', () => {
    const s = game();
    const tc = s.buildings[0];
    expect(issue(s, 0, { type: 'rally', building: tc.id, tile: -5 }).ok).toBe(false);
    expect(issue(s, 0, { type: 'rally', building: tc.id, tile: s.terrain.findIndex((t) => t === 1) }).ok).toBe(true);
  });
});

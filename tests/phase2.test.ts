import { describe, expect, it } from 'vitest';
import { multiplier } from '../src/sim/combat';
import { issue } from '../src/sim/commands';
import { CFG } from '../src/sim/data';
import { newGame, run, squad, tcOf, unitsOf } from './helpers';
import type { Game } from '../src/sim/types';

/** An open patch of grass near the map centre, away from bases and camps. */
const arena = (s: Game) => ({ x: Math.floor(s.center.x) - 3, y: Math.floor(s.center.y) - 3 });

function duel(a: string, na: number, b: string, nb: number, gap: number): { a: number; b: number } {
  const s = newGame();
  const { x, y } = arena(s);
  const as = squad(s, 0, a, na, x, y), bs = squad(s, 1, b, nb, x + gap, y);
  issue(s, 0, { type: 'attack', units: as.map((u) => u.id), target: bs[0].id, building: false });
  run(s, 90);
  return { a: unitsOf(s, 0, a).length - (a === 'hero' ? 1 : 0), b: unitsOf(s, 1, b).length - (b === 'hero' ? 1 : 0) };
}

describe('combat triangle', () => {
  it('uses the 1.5 / 0.75 multipliers', () => {
    for (const [strong, weak] of [['infantry', 'cavalry'], ['cavalry', 'archer'], ['archer', 'infantry']]) {
      expect(multiplier(strong, weak)).toBe(1.5);
      expect(multiplier(weak, strong)).toBe(0.75);
    }
    expect(multiplier('infantry', 'infantry')).toBe(1);
    expect(multiplier('hero', 'archer')).toBe(1);
  });

  it('infantry beats cavalry at similar cost', () => {
    const r = duel('infantry', 3, 'cavalry', 2, 2);
    expect(r.b).toBe(0);
    expect(r.a).toBeGreaterThan(0);
  });

  it('cavalry beats archers', () => {
    const r = duel('cavalry', 2, 'archer', 3, 6);
    expect(r.b).toBe(0);
    expect(r.a).toBeGreaterThan(0);
  });

  it('archers beat infantry', () => {
    const r = duel('archer', 3, 'infantry', 3, 6);
    expect(r.b).toBe(0);
    expect(r.a).toBeGreaterThan(0);
  });

  it('attacking a player declares war both ways, and idle soldiers then defend themselves', () => {
    const s = newGame();
    const { x, y } = arena(s);
    const mine = squad(s, 0, 'infantry', 1, x, y), theirs = squad(s, 1, 'infantry', 2, x + 2, y);
    run(s, 5);
    expect(theirs.every((u) => u.hp === 60) && mine[0].hp === 60).toBe(true);
    issue(s, 0, { type: 'attack', units: [mine[0].id], target: theirs[0].id, building: false });
    expect(s.war[0][1] && s.war[1][0]).toBe(true);
    expect(s.war[0][2]).toBe(false);
    run(s, 60);
    expect(unitsOf(s, 0, 'infantry')).toHaveLength(0);
  });

  it('destroys buildings and refuses to attack own units', () => {
    const s = newGame();
    const enemy = tcOf(s, 1);
    const army = squad(s, 0, 'cavalry', 12, enemy.tx + 5, enemy.ty);
    expect(issue(s, 0, { type: 'attack', units: [army[0].id], target: army[1].id, building: false }).ok).toBe(false);
    enemy.hp = 60;
    issue(s, 0, { type: 'attack', units: army.map((u) => u.id), target: enemy.id, building: true });
    run(s, 30);
    expect(s.buildings.includes(enemy)).toBe(false);
    expect(s.occ[enemy.ty * s.w + enemy.tx]).toBe(0);
  });
});

describe('neutral camps', () => {
  it('ignore scouts but attack soldiers who come close', () => {
    const s = newGame();
    const camp = s.camps[0];
    const scout = unitsOf(s, 0, 'scout')[0];
    issue(s, 0, { type: 'move', units: [scout.id], x: camp.x + 1, y: camp.y + 1 });
    run(s, 60);
    expect(scout.hp).toBe(30);
    const soldier = squad(s, 0, 'infantry', 1, Math.floor(camp.x) + 2, Math.floor(camp.y))[0];
    run(s, 10);
    expect(soldier.hp).toBeLessThan(60);
  });

  it('pay loot only to Külboyları and come back one tier stronger, up to tier 3', () => {
    for (const [player, expectLoot] of [[0, false], [1, true]] as const) {
      const s = newGame();
      const index = player * 2, camp = s.camps[index];
      const before = { ...s.players[player].res };
      for (let round = 1; round <= 4; round++) {
        expect(camp.tier).toBe(Math.min(3, round));
        expect(camp.alive).toBe(CFG.camp.count[camp.tier - 1]);
        const army = squad(s, player, 'cavalry', 14, Math.floor(camp.x) + 2, Math.floor(camp.y) - 6);
        issue(s, player, { type: 'attackMove', units: army.map((u) => u.id), x: camp.x, y: camp.y });
        run(s, 60);
        expect(camp.alive).toBe(0);
        s.units = s.units.filter((u) => !army.includes(u));
        run(s, CFG.camp.respawn + 1);
      }
      const gained = s.players[player].res.food - before.food;
      if (expectLoot) expect(gained).toBe(60 + 100 + 150 + 150);
      else expect(gained).toBe(0);
    }
  });
});

describe('hero', () => {
  it('levels up from nearby kills and respawns after falling', () => {
    const s = newGame();
    const hero = unitsOf(s, 0, 'hero')[0];
    const camp = s.camps[0];
    hero.x = camp.x + 3; hero.y = camp.y;
    squad(s, 0, 'cavalry', 10, Math.floor(camp.x) + 2, Math.floor(camp.y) - 5);
    run(s, 40);
    expect(s.players[0].heroLevel).toBeGreaterThan(1);
    expect(hero.scale).toBeGreaterThan(1);
    const level = s.players[0].heroLevel;
    hero.hp = 1;
    s.units = s.units.filter((u) => u.type !== 'cavalry');
    squad(s, 1, 'cavalry', 3, Math.floor(hero.x) + 1, Math.floor(hero.y));
    s.war[0][1] = s.war[1][0] = true;
    run(s, 10);
    expect(unitsOf(s, 0, 'hero')).toHaveLength(0);
    run(s, CFG.hero.respawnBase + CFG.hero.respawnPerLevel * level + 2);
    const back = unitsOf(s, 0, 'hero');
    expect(back).toHaveLength(1);
    expect(back[0].scale).toBeCloseTo(1 + CFG.hero.levelBonus * (level - 1));
  });
});

describe('fog of war', () => {
  it('starts with only the base explored', () => {
    const s = newGame();
    const fog = s.fog[0];
    const b = s.bases[0], other = s.bases[1];
    expect(fog.visible[b.y * s.w + b.x]).toBe(1);
    expect(fog.explored[other.y * s.w + other.x]).toBe(0);
  });

  it('auto-explore uncovers the map without the scout getting hurt', () => {
    const s = newGame();
    const scout = unitsOf(s, 0, 'scout')[0];
    const count = () => s.fog[0].explored.reduce((n, v) => n + v, 0);
    const before = count();
    issue(s, 0, { type: 'explore', units: [scout.id] });
    let closest = Infinity;
    for (let i = 0; i < 240; i++) {
      run(s, 1);
      for (const c of s.camps) closest = Math.min(closest, Math.hypot(c.x - scout.x, c.y - scout.y));
    }
    expect(scout.hp).toBe(30);
    expect(count()).toBeGreaterThan(before * 4);
    expect(count() / (s.w * s.h)).toBeGreaterThan(0.6);
    expect(closest).toBeGreaterThan(CFG.camp.exploreAvoid - 1.5);
  });
});

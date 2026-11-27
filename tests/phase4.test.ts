import { describe, expect, it } from 'vitest';
import { issue } from '../src/sim/commands';
import { CFG } from '../src/sim/data';
import { coalitionAgainst, isTraitor, pactOf } from '../src/sim/diplomacy';
import { runMatch } from '../src/sim/headless';
import { addUnit, createGame } from '../src/sim/state';
import { run, squad } from './helpers';
import type { Game, RaceId } from '../src/sim/types';

const D = CFG.diplomacy;
/** Seat 0 is the human; seat 1 a trader, seat 2 an expander. */
const game = (race: RaceId = 'sancak', peaceSeconds = 0): Game => createGame({
  seed: 3, peaceSeconds,
  players: [{ race, isAI: false }, { race: 'sancak', isAI: true, personality: 'trader' }, { race: 'kul', isAI: true, personality: 'expander' }],
});
const why = (s: Game, player = 0) => s.events.filter((e) => e.player === player && e.kind === 'why').map((e) => e.text);
const enemyUnit = (s: Game, owner: number) => addUnit(s, owner, 'infantry', 30.5, 30.5);

describe('relations and pacts', () => {
  it('starts from personality leanings', () => {
    const s = game();
    expect(s.diplo.relation[0][1]).toBe(25);
    expect(s.diplo.relation[0][2]).toBe(-10);
    expect(s.diplo.relation[1][2]).toBe(15);
    expect(s.diplo.trust).toEqual([60, 60, 60]);
  });

  it('the trader accepts a pact at once; the expander needs better relations first', () => {
    const s = game();
    expect(issue(s, 0, { type: 'proposePact', to: 1 }).ok).toBe(true);
    expect(pactOf(s, 0, 1)).not.toBeNull();
    const refused = issue(s, 0, { type: 'proposePact', to: 2 });
    expect(refused.ok).toBe(false);
    expect(refused.reason).toContain('İlişki');
    expect(pactOf(s, 0, 2)).toBeNull();
  });

  it('gifts raise relations at 1 per 20, capped per window, and trust once', () => {
    const s = game();
    s.players[0].res.food = 1000;
    issue(s, 0, { type: 'gift', to: 2, kind: 'food', amount: 100 });
    expect(s.diplo.relation[0][2]).toBe(-5);
    expect(s.diplo.trust[0]).toBe(60 + D.giftTrust);
    for (let i = 0; i < 4; i++) issue(s, 0, { type: 'gift', to: 2, kind: 'food', amount: 100 });
    expect(s.diplo.relation[0][2]).toBe(-10 + D.giftRelationMax);
    expect(s.diplo.trust[0]).toBe(60 + D.giftTrust);
    expect(s.players[0].res.food).toBe(500);
    expect(s.players[2].res.food).toBe(CFG.startResources.food + 500);
    expect(issue(s, 0, { type: 'gift', to: 2, kind: 'food', amount: 5000 }).ok).toBe(false);
  });

  it('pays the Sancak caravan for each pact, and only to Sancaklılar', () => {
    for (const [race, expected] of [['sancak', D.caravanPerMinute], ['kul', 0]] as const) {
      const s = game(race, 9999);
      issue(s, 0, { type: 'proposePact', to: 1 });
      run(s, 60);
      expect(s.players[0].res.crystal).toBeCloseTo(expected, 0);
    }
  });

  it('a pact kept to its end pays trust; trust also grows each minute it is in force', () => {
    const s = game('kul', 9999);
    issue(s, 0, { type: 'proposePact', to: 1 });
    s.ai[1].lastOffer[0] = 1e9;
    run(s, D.pactSeconds + 1);
    expect(pactOf(s, 0, 1)).toBeNull();
    expect(s.diplo.trust[0]).toBe(60 + D.pactSeconds / 60 * D.trustPerMinute + D.pactKeptTrust);
  });
});

describe('war, notice and betrayal', () => {
  it('attacking without any agreement is a war declaration: relations drop, trust does not', () => {
    const s = game();
    const mine = squad(s, 0, 'infantry', 1, 28, 30);
    expect(issue(s, 0, { type: 'attack', units: [mine[0].id], target: enemyUnit(s, 2).id, building: false }).ok).toBe(true);
    expect(s.war[0][2]).toBe(true);
    expect(s.diplo.relation[0][2]).toBe(-10 - D.warRelation);
    expect(s.diplo.trust[0]).toBe(60);
  });

  it('attacking a pact partner asks first, and costs dearly when confirmed', () => {
    const s = game();
    issue(s, 0, { type: 'proposePact', to: 1 });
    const mine = squad(s, 0, 'infantry', 1, 28, 30), target = enemyUnit(s, 1);
    const first = issue(s, 0, { type: 'attack', units: [mine[0].id], target: target.id, building: false });
    expect(first.ok).toBe(false);
    expect(first.needsConfirm).toBe(true);
    expect(s.war[0][1]).toBe(false);
    expect(s.diplo.trust[0]).toBe(60);
    expect(issue(s, 0, { type: 'attack', units: [mine[0].id], target: target.id, building: false, confirm: true }).ok).toBe(true);
    expect(s.diplo.trust[0]).toBe(60 - D.betrayalTrust);
    expect(s.diplo.relation[0][1]).toBe(25 - D.betrayalVictim);
    expect(s.diplo.relation[0][2]).toBe(-10 - D.betrayalOthers);
    expect(pactOf(s, 0, 1)).toBeNull();
    expect(s.war[0][1]).toBe(true);
    expect(isTraitor(s, 0)).toBe(true);
    expect(coalitionAgainst(s, 0)).toBe(false);
    expect(why(s).some((t) => t.includes('haber vermeden'))).toBe(true);
    expect(issue(s, 0, { type: 'proposePact', to: 1 }).ok).toBe(false);
  });

  it('a betrayal that drops trust below 25 unites the others', () => {
    const s = game();
    issue(s, 0, { type: 'proposePact', to: 1 });
    s.diplo.trust[0] = 45;
    const mine = squad(s, 0, 'infantry', 1, 28, 30);
    issue(s, 0, { type: 'attack', units: [mine[0].id], target: enemyUnit(s, 1).id, building: false, confirm: true });
    expect(s.diplo.trust[0]).toBe(20);
    expect(coalitionAgainst(s, 0)).toBe(true);
    expect(pactOf(s, 1, 2)).not.toBeNull();
    run(s, CFG.ai.strategySeconds + 1);
    expect(s.ai[2].enemy).toBe(0);
    expect(s.war[0][2]).toBe(true);
  });

  it('the honest way out costs 5 trust and takes effect after the notice', () => {
    const s = game('kul', 0);
    issue(s, 0, { type: 'proposePact', to: 1 });
    s.ai[1].lastOffer[0] = 1e9;
    expect(issue(s, 0, { type: 'endPact', other: 1 }).ok).toBe(true);
    expect(s.diplo.trust[0]).toBe(60 - D.noticePenalty);
    expect(issue(s, 0, { type: 'endPact', other: 1 }).ok).toBe(false);
    expect(issue(s, 0, { type: 'proposePact', to: 1 }).ok).toBe(false);
    run(s, D.noticeSeconds - 2);
    expect(pactOf(s, 0, 1)).not.toBeNull();
    run(s, 3);
    expect(pactOf(s, 0, 1)).toBeNull();
    const mine = squad(s, 0, 'infantry', 1, 28, 30);
    expect(issue(s, 0, { type: 'attack', units: [mine[0].id], target: enemyUnit(s, 1).id, building: false }).ok).toBe(true);
    expect(isTraitor(s, 0)).toBe(false);
    expect(s.diplo.trust[0]).toBeGreaterThanOrEqual(60 - D.noticePenalty);
  });

  it('pact partners do not fight even when their soldiers meet', () => {
    const s = game();
    issue(s, 0, { type: 'proposePact', to: 1 });
    const a = squad(s, 0, 'infantry', 2, 30, 34), b = squad(s, 1, 'infantry', 2, 31, 34);
    run(s, 10);
    expect([...a, ...b].every((u) => u.hp === 60)).toBe(true);
  });
});

describe('AI', () => {
  const seats = [{ race: 'sancak', personality: 'trader' }, { race: 'kul', personality: 'expander' }, { race: 'kul', personality: 'trader' }] as const;

  it('grows an economy, reaches Age II and fields an army during peace', () => {
    const r = runMatch(5, [...seats], 8);
    for (const p of r.game.players) {
      expect(p.age).toBe(2);
      expect(r.game.units.filter((u) => u.owner === p.id && u.type === 'villager').length).toBeGreaterThanOrEqual(18);
      expect(r.game.units.filter((u) => u.owner === p.id && ['infantry', 'archer', 'cavalry'].includes(u.type)).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('plays full matches to a winner, the same way for the same seed, and never betrays', () => {
    for (const seed of [11, 12, 13]) {
      const a = runMatch(seed, [...seats]), b = runMatch(seed, [...seats]);
      expect(a.winner).toBeGreaterThanOrEqual(0);
      expect([b.winner, b.winKind, b.game.tick]).toEqual([a.winner, a.winKind, a.game.tick]);
      expect(a.game.events.some((e) => e.kind === 'betrayal')).toBe(false);
      expect(a.game.diplo.trust.every((t) => t >= D.startTrust - 3 * D.noticePenalty)).toBe(true);
    }
  });
});

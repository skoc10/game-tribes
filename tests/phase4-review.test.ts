import { describe, expect, it } from 'vitest';
import { issue, type Command } from '../src/sim/commands';
import { CFG } from '../src/sim/data';
import { coalitionAgainst, pactOf } from '../src/sim/diplomacy';
import { createGame } from '../src/sim/state';
import { run } from './helpers';
import type { Game } from '../src/sim/types';

const D = CFG.diplomacy;
const game = (peaceSeconds = 9999): Game => createGame({
  seed: 3, peaceSeconds,
  players: [{ race: 'kul', isAI: false }, { race: 'sancak', isAI: true, personality: 'trader' }, { race: 'kul', isAI: true, personality: 'expander' }],
});

describe('phase 4 review fixes', () => {
  it('the AI sends a new builder to a construction that lost its builder', () => {
    const s = game();
    let site = undefined as Game['buildings'][number] | undefined;
    for (let i = 0; i < 300 && !site; i++) { run(s, 0.5); site = s.buildings.find((b) => b.owner === 1 && b.progress < 1); }
    expect(site).toBeDefined();
    s.units = s.units.filter((u) => !(u.order.kind === 'build' && u.order.building === site!.id));
    run(s, 60);
    expect(site!.progress).toBe(1);
  });

  it('an AI never offers, or honours, a pact it would refuse if asked', () => {
    const s = game();
    s.diplo.trust[0] = 35;
    expect(issue(s, 0, { type: 'proposePact', to: 1 }).ok).toBe(false);
    run(s, 90);
    expect(s.diplo.offers.some((o) => o.from === 1 && o.to === 0)).toBe(false);
    s.diplo.trust[0] = 60;
    s.diplo.offers.push({ from: 1, to: 0, expires: s.time + 30 });
    s.diplo.trust[0] = 35;
    expect(issue(s, 0, { type: 'answerPact', from: 1, accept: true }).ok).toBe(false);
    expect(pactOf(s, 0, 1)).toBeNull();
  });

  it('rejects malformed player ids and tiny gifts', () => {
    const s = game();
    for (const bad of ['length', '__proto__', 1.5, -1, 7, NaN]) {
      expect(issue(s, 0, { type: 'endPact', other: bad } as unknown as Command).ok).toBe(false);
      expect(issue(s, 0, { type: 'proposePact', to: bad } as unknown as Command).ok).toBe(false);
    }
    expect(s.diplo.trust[0]).toBe(D.startTrust);
    expect(issue(s, 0, { type: 'gift', to: 2, kind: 'food', amount: 0.001 }).ok).toBe(false);
    expect(s.diplo.trust[0]).toBe(D.startTrust);
  });

  it('notice near the end of a pact does not earn the kept-to-the-end bonus', () => {
    const s = game();
    issue(s, 0, { type: 'proposePact', to: 1 });
    s.ai[1].lastOffer[0] = 1e9;
    run(s, D.pactSeconds - 20);
    const trust = s.diplo.trust[0];
    issue(s, 0, { type: 'endPact', other: 1 });
    run(s, 25);
    expect(pactOf(s, 0, 1)).toBeNull();
    // The notice penalty stands (a per-minute tick may add 1); the +5 for a kept pact must not be paid.
    expect(s.diplo.trust[0]).toBeLessThan(trust);
  });

  it('a coalition forms whenever trust falls below the threshold, and only offers the human a pact', () => {
    const s = game();
    s.diplo.trust[2] = D.coalitionTrust + 2;
    issue(s, 2, { type: 'proposePact', to: 1 });
    s.diplo.pacts[1][2] = s.diplo.pacts[2][1] = { until: s.time + 300, endsAt: -1, endedBy: -1 };
    issue(s, 2, { type: 'endPact', other: 1 });
    expect(coalitionAgainst(s, 2)).toBe(true);
    expect(pactOf(s, 0, 1)).toBeNull();
    expect(s.diplo.offers.some((o) => o.from === 1 && o.to === 0)).toBe(true);
    expect(s.diplo.relation[0][1]).toBeGreaterThanOrEqual(D.pactRelation);
    expect(issue(s, 0, { type: 'answerPact', from: 1, accept: true }).ok).toBe(true);
  });
});

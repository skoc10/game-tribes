import { describe, expect, it } from 'vitest';
import { BUILDINGS, RACES, UNITS } from '../src/sim/data';
import { STYLES, drawBuilding, drawNode, drawUnit } from '../src/render/art';

/** Methods of Phaser's Graphics object that the art code is allowed to use. */
const ALLOWED = new Set(['fillStyle', 'lineStyle', 'fillRect', 'strokeRect', 'fillCircle', 'strokeCircle', 'fillEllipse', 'strokeEllipse',
  'fillTriangle', 'strokeTriangle', 'fillRoundedRect', 'strokeRoundedRect', 'lineBetween', 'beginPath', 'arc', 'strokePath']);

/** A stand-in for Graphics that records calls and rejects unknown methods or non-finite numbers. */
function recorder() {
  const calls: string[] = [];
  const g: unknown = new Proxy({}, {
    get: (_t, name: string) => (...args: unknown[]) => {
      if (!ALLOWED.has(name)) throw new Error(`unknown Graphics method ${name}`);
      for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`${name} got ${a}`);
      calls.push(name);
      return g;
    },
  });
  return { g: g as Parameters<typeof drawNode>[0], calls };
}

describe('art', () => {
  it('draws every building for every people, finished and under construction, as distinct pictures', () => {
    expect(Object.keys(STYLES).sort()).toEqual(Object.keys(RACES).sort());
    const signatures = new Map<string, string>();
    for (const race of Object.keys(RACES)) for (const type of Object.keys(BUILDINGS)) for (const done of [true, false]) {
      const { g, calls } = recorder();
      drawBuilding(g, type, 64, 64, BUILDINGS[type].size * 32, 0x4c8dff, race, done, 1.25);
      expect(calls.length).toBeGreaterThan(8);
      if (race === 'sancak' && done) signatures.set(type, calls.join(','));
    }
    // No two building types share the same sequence of shapes.
    expect(new Set(signatures.values()).size).toBe(Object.keys(BUILDINGS).length);
  });

  it('draws every unit class, moving or still, and every resource node', () => {
    const classes = new Set(Object.values(UNITS).map((u) => u.cls));
    const signatures = new Set<string>();
    for (const cls of classes) for (const moving of [true, false]) {
      const { g, calls } = recorder();
      drawUnit(g, cls, 100, 100, 0xe5533d, { moving, t: 2.5, id: 7 });
      expect(calls.length).toBeGreaterThan(5);
      if (!moving) signatures.add(calls.join(','));
    }
    expect(signatures.size).toBe(classes.size);
    for (const terrain of [1, 2, 3]) for (const seed of [0, 1, 4095]) {
      const { g, calls } = recorder();
      drawNode(g, terrain, 0, 0, seed);
      expect(calls.length).toBeGreaterThan(4);
    }
  });
});

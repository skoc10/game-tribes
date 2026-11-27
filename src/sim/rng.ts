/**
 * Scrambles a seed (murmur3 finaliser). Neighbouring seeds such as 1000 and 1001 otherwise start
 * the generator in neighbouring states, and their first few outputs are not independent enough:
 * balance measured on one run of consecutive seeds differed from another run by ten points.
 */
export function scramble(seed: number): number {
  let h = seed | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) | 0;
}

/** Deterministic PRNG (mulberry32). Mutates the seed holder and returns a number in [0, 1). */
export function rand(s: { seed: number }): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = Math.imul(s.seed ^ (s.seed >>> 15), 1 | s.seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

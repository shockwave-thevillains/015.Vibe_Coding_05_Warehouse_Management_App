import type { SimState } from './types';

/** mulberry32 — tiny deterministic PRNG. The seed lives in the sim state so ticks stay reproducible. */
export function nextRandom(state: SimState): number {
  let t = (state.rngSeed = (state.rngSeed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(state: SimState, min: number, max: number): number {
  return min + Math.floor(nextRandom(state) * (max - min + 1));
}

export function pick<T>(state: SimState, list: readonly T[]): T {
  return list[Math.floor(nextRandom(state) * list.length)];
}

/** Stateless seeded generator for decorative layout (doesn't touch sim state). */
export function seeded(seed: number): () => number {
  let s = seed | 0;
  return () => {
    let t = (s = (s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

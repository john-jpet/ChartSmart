/** Deterministic PRNG (mulberry32) so a given seed always yields the same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** UTC-day epoch, so all players get the same daily seed regardless of timezone. */
export function todayEpoch(): number {
  return Math.floor(Date.now() / 86_400_000);
}

export function shuffleWithRng<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pickWithRng<T>(items: T[], count: number, rng: () => number): T[] {
  return shuffleWithRng(items, rng).slice(0, count);
}

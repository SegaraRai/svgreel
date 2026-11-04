/**
 * Deterministic randomness. Compositions are rendered once per frame, so `Math.random()` would
 * give every frame different values (and a different element tree). These return the same value
 * for the same seed on every frame and every build.
 */

/** 32-bit FNV-1a hash of a string. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mixes a 32-bit integer into a float in [0, 1) (the output step of mulberry32). */
function unit(n: number): number {
  let t = (n + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * A number in [0, 1) that depends only on `seed`.
 *
 *   random("star-3")          // same value on every frame
 *   random(`dot-${i}-x`) * W  // one seed per value you need
 */
export function random(seed: string | number): number {
  return unit(hash(String(seed)));
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Smooth 1D value noise in [-1, 1]: nearby `x` give nearby values, and the curve repeats with
 * period `repeat` (when given), which makes noise-driven wobble loop without a jump. Feed it
 * `frame / framesPerBump`.
 */
export function noise1D(x: number, seed: string | number = 0, repeat?: number): number {
  const lattice = (i: number) => {
    const k = repeat ? ((i % repeat) + repeat) % repeat : i;
    return random(`${seed}:${k}`) * 2 - 1;
  };
  const i = Math.floor(x);
  return lattice(i) + (lattice(i + 1) - lattice(i)) * smooth(x - i);
}

/** Smooth 2D value noise in [-1, 1] (e.g. one axis for position, one for time). */
export function noise2D(x: number, y: number, seed: string | number = 0): number {
  const lattice = (i: number, j: number) => random(`${seed}:${i},${j}`) * 2 - 1;
  const i = Math.floor(x);
  const j = Math.floor(y);
  const u = smooth(x - i);
  const v = smooth(y - j);
  const top = lattice(i, j) + (lattice(i + 1, j) - lattice(i, j)) * u;
  const bottom = lattice(i, j + 1) + (lattice(i + 1, j + 1) - lattice(i, j + 1)) * u;
  return top + (bottom - top) * v;
}

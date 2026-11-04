/** An easing maps progress 0..1 to eased progress (usually 0..1, may overshoot). */
export type EasingFn = (t: number) => number;

/** Solves a CSS-style cubic-bezier(x1, y1, x2, y2) timing curve. */
function bezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  const solve = (x: number) => {
    // Newton's method converges quickly for most curves; fall back to bisection when the slope is flat.
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-7) {
        return t;
      }
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) {
        break;
      }
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-7) {
        break;
      }
      if (v < x) {
        lo = t;
      } else {
        hi = t;
      }
      t = (lo + hi) / 2;
    }
    return t;
  };

  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solve(x)));
}

/** Easing functions with the same names and shapes as Remotion's / React Native's `Easing`. */
export const Easing = {
  linear: ((t) => t) as EasingFn,
  /** CSS `ease`. */
  ease: bezier(0.25, 0.1, 0.25, 1),
  quad: ((t) => t * t) as EasingFn,
  cubic: ((t) => t * t * t) as EasingFn,
  poly:
    (n: number): EasingFn =>
    (t) =>
      t ** n,
  sin: ((t) => 1 - Math.cos((t * Math.PI) / 2)) as EasingFn,
  circle: ((t) => 1 - Math.sqrt(1 - t * t)) as EasingFn,
  exp: ((t) => (t === 0 ? 0 : 2 ** (10 * (t - 1)))) as EasingFn,
  /** Springy overshoot; `bounciness` 1 ≈ one visible wobble. */
  elastic: (bounciness = 1): EasingFn => {
    const p = bounciness * Math.PI;
    return (t) => 1 - Math.cos((t * Math.PI) / 2) ** 3 * Math.cos(t * p);
  },
  /** Pulls back before moving forward. */
  back:
    (s = 1.70158): EasingFn =>
    (t) =>
      t * t * ((s + 1) * t - s),
  bounce: ((t) => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    }
    if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    }
    if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    }
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  }) as EasingFn,
  bezier,
  /** Runs an easing forwards (the default shape of the functions above). */
  in: (e: EasingFn): EasingFn => e,
  /** Runs an easing backwards: fast start, slow end. */
  out:
    (e: EasingFn): EasingFn =>
    (t) =>
      1 - e(1 - t),
  /** Symmetric: `in` for the first half, `out` for the second. */
  inOut:
    (e: EasingFn): EasingFn =>
    (t) =>
      t < 0.5 ? e(t * 2) / 2 : 1 - e((1 - t) * 2) / 2,
};

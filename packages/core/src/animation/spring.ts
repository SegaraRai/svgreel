export interface SpringConfig {
  /** Default 1. Heavier = slower and more inertia. */
  mass: number;
  /** Default 10. Lower = more bounce. */
  damping: number;
  /** Default 100. Higher = snappier. */
  stiffness: number;
  /** Stop at the target instead of overshooting it. Default false. */
  overshootClamping: boolean;
}

const DEFAULTS: SpringConfig = {
  mass: 1,
  damping: 10,
  stiffness: 100,
  overshootClamping: false,
};

/** Position (0 → 1) of a damped spring released from rest, `t` seconds after release. */
function position(t: number, { mass, damping, stiffness }: SpringConfig): number {
  if (t <= 0) {
    return 0;
  }
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  if (zeta === 1) {
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  }
  const s = Math.sqrt(zeta * zeta - 1);
  const r1 = -w0 * (zeta - s);
  const r2 = -w0 * (zeta + s);
  return 1 + (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r1 - r2);
}

/**
 * Frames until the spring stays within `threshold` of its target. Useful for scheduling what
 * comes after a spring.
 */
export function measureSpring({
  fps,
  config,
  threshold = 0.005,
}: {
  fps: number;
  config?: Partial<SpringConfig>;
  threshold?: number;
}): number {
  const c = { ...DEFAULTS, ...config };
  const limit = fps * 60;
  let last = 0;
  for (let f = 0; f <= limit; f++) {
    if (Math.abs(position(f / fps, c) - 1) > threshold) {
      last = f;
    }
  }
  return last + 1;
}

/**
 * Physically based 0 → 1 (or `from` → `to`) motion, driven by the frame number. Same options as
 * Remotion's `spring()`; `durationInFrames` stretches the motion to settle in exactly that long.
 */
export function spring({
  frame,
  fps,
  config,
  from = 0,
  to = 1,
  delay = 0,
  durationInFrames,
}: {
  frame: number;
  fps: number;
  config?: Partial<SpringConfig>;
  from?: number;
  to?: number;
  delay?: number;
  durationInFrames?: number;
}): number {
  const c = {
    ...DEFAULTS,
    ...config,
  };
  let f = frame - delay;
  if (durationInFrames !== undefined) {
    f *= measureSpring({ fps, config: c }) / durationInFrames;
  }
  let p = position(f / fps, c);
  if (c.overshootClamping) {
    p = Math.min(p, 1);
  }
  return from + (to - from) * p;
}

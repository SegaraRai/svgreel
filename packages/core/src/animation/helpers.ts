import { Easing, type EasingFn } from "./easing.js";
import { interpolate } from "./interpolate.js";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

/**
 * Rounds to 2 decimals (or `digits`). Use it on animated values: fewer distinct values = fewer
 * keyframes. Use more digits for factors applied to large sizes (a scale on a 1000 px element
 * moves 10 px per 0.01), or the motion becomes a visible staircase.
 */
export const round = (n: number, digits = 2) => {
  const k = 10 ** digits;
  return Math.round(n * k) / k;
};

/**
 * interpolate() clamped on both sides, with an easing (default ease-out cubic).
 *
 *   tween(frame, [10, 30], [0, 1])  // 0 before frame 10, eases to 1 by frame 30
 */
export function tween(
  frame: number,
  range: readonly [number, number],
  to: readonly [number, number] = [0, 1],
  easing: EasingFn = Easing.out(Easing.cubic),
): number {
  return interpolate(frame, range, to, { easing, ...clamp });
}

/**
 * 0 → 1 → 0 envelope for something visible during [start, end), fading over `fade` frames
 * centred on each edge. Pass `loop` (the composition's durationInFrames) for windows that touch
 * the start or end, so they also fade across the loop seam.
 */
export function presence(frame: number, start: number, end: number, fade = 15, loop?: number): number {
  const at = (f: number) => interpolate(f, [start - fade, start + fade, end - fade, end + fade], [0, 1, 1, 0], clamp);
  return loop ? Math.max(at(frame), at(frame + loop), at(frame - loop)) : at(frame);
}

/** 0 → 1 → 0 blip peaking at `at`. */
export function pulse(frame: number, at: number, rise = 4, fall = 8): number {
  return interpolate(frame, [at - rise, at, at + fall], [0, 1, 0], clamp);
}

/**
 * The period closest to `period` that fits a whole number of times into `loop` frames (at least
 * once), so periodic motion has no jump at the loop seam.
 */
export function loopPeriod(period: number, loop: number): number {
  return loop / Math.max(1, Math.round(loop / period));
}

/**
 * Sine wave in [-1, 1] with roughly `period` frames per cycle, adjusted with loopPeriod() so it
 * lines up with the composition's `loop` length. `phase` is in cycles (0.25 = a quarter turn).
 *
 *   const y = oscillate(frame, 90, durationInFrames) * 6  // gentle bob that loops cleanly
 */
export function oscillate(frame: number, period: number, loop: number, phase = 0): number {
  return Math.sin(2 * Math.PI * (frame / loopPeriod(period, loop) + phase));
}

/** Square-wave blink (1, 0, 1, 0, …) with `period` frames per on+off cycle. */
export function blink(frame: number, period = 16): number {
  return Math.floor(frame / (period / 2)) % 2 === 0 ? 1 : 0;
}

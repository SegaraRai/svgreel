import type { EasingFn } from "./easing.js";

export type Extrapolate = "extend" | "clamp" | "identity";

export interface InterpolateOptions {
  easing?: EasingFn;
  /** What happens below the first input value. Default "extend". */
  extrapolateLeft?: Extrapolate;
  /** What happens above the last input value. Default "extend". */
  extrapolateRight?: Extrapolate;
}

/**
 * Maps `input` through piecewise-linear segments (`inputRange[i]` → `outputRange[i]`), easing each
 * segment. Same contract as Remotion's `interpolate`.
 */
export function interpolate(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
  options: InterpolateOptions = {},
): number {
  if (inputRange.length !== outputRange.length || inputRange.length < 2) {
    throw new Error("interpolate(): inputRange and outputRange need the same length (≥ 2)");
  }
  for (let i = 1; i < inputRange.length; i++) {
    if (inputRange[i] < inputRange[i - 1]) {
      throw new Error(`interpolate(): inputRange must be non-decreasing, got [${inputRange.join(", ")}]`);
    }
  }
  const { easing = (t: number) => t, extrapolateLeft = "extend", extrapolateRight = "extend" } = options;

  let seg = 1;
  while (seg < inputRange.length - 1 && input > inputRange[seg]) {
    seg++;
  }
  const i0 = inputRange[seg - 1];
  const i1 = inputRange[seg];
  const o0 = outputRange[seg - 1];
  const o1 = outputRange[seg];

  if (input < i0) {
    if (extrapolateLeft === "clamp") {
      return o0;
    }
    if (extrapolateLeft === "identity") {
      return input;
    }
  }
  if (input > i1) {
    if (extrapolateRight === "clamp") {
      return o1;
    }
    if (extrapolateRight === "identity") {
      return input;
    }
  }
  if (i1 === i0) {
    return input <= i0 ? o0 : o1;
  }

  let t = (input - i0) / (i1 - i0);
  // Easing only applies inside the range; extension stays linear.
  if (t >= 0 && t <= 1) {
    t = easing(t);
  }
  return o0 + (o1 - o0) * t;
}

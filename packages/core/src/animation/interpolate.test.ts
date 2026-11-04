import { describe, expect, it } from "vite-plus/test";

import { interpolate } from "./interpolate.js";

describe("interpolate", () => {
  it("maps linearly inside the range", () => {
    expect(interpolate(5, [0, 10], [0, 100])).toBe(50);
  });

  it("picks the right segment of a multi-point range", () => {
    expect(interpolate(15, [0, 10, 20], [0, 100, 0])).toBe(50);
  });

  it("extends by default outside the range", () => {
    expect(interpolate(-5, [0, 10], [0, 100])).toBe(-50);
    expect(interpolate(15, [0, 10], [0, 100])).toBe(150);
  });

  it("clamps or passes the input through when asked", () => {
    const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
    expect(interpolate(-5, [0, 10], [0, 100], clamp)).toBe(0);
    expect(interpolate(15, [0, 10], [0, 100], clamp)).toBe(100);
    expect(interpolate(15, [0, 10], [0, 100], { extrapolateRight: "identity" })).toBe(15);
  });

  it("eases inside the range only", () => {
    const easing = (t: number) => t * t;
    expect(interpolate(5, [0, 10], [0, 100], { easing })).toBe(25);
    expect(interpolate(20, [0, 10], [0, 100], { easing })).toBe(200);
  });

  it("jumps at a zero-length segment", () => {
    expect(interpolate(10, [0, 10, 10, 20], [0, 1, 5, 6])).toBe(1);
    expect(interpolate(10.5, [0, 10, 10, 20], [0, 1, 5, 6])).toBe(5.05);
  });

  it("rejects mismatched or decreasing ranges", () => {
    expect(() => interpolate(0, [0], [0])).toThrow();
    expect(() => interpolate(0, [0, 1], [0, 1, 2])).toThrow();
    expect(() => interpolate(0, [1, 0], [0, 1])).toThrow(/non-decreasing/);
  });
});

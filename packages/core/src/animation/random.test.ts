import { describe, expect, it } from "vite-plus/test";

import { noise1D, noise2D, random } from "./random.js";

describe("random", () => {
  it("is deterministic per seed and spread over [0, 1)", () => {
    expect(random("a")).toBe(random("a"));
    expect(random("a")).not.toBe(random("b"));
    expect(random(1)).toBe(random("1"));
    const values = Array.from({ length: 2000 }, (_, i) => random(`s${i}`));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((a, b) => a + b) / values.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});

describe("noise", () => {
  it("stays in [-1, 1] and changes smoothly", () => {
    for (let x = 0; x < 20; x += 0.05) {
      const v = noise1D(x, "n");
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
      expect(Math.abs(noise1D(x + 0.01, "n") - v)).toBeLessThan(0.05);
      expect(Math.abs(noise2D(x, x / 3, "m"))).toBeLessThanOrEqual(1);
    }
  });

  it("passes through lattice values and repeats when asked", () => {
    expect(noise1D(3, "n")).toBeCloseTo(random("n:3") * 2 - 1, 12);
    expect(noise1D(0.4, "n", 8)).toBeCloseTo(noise1D(8.4, "n", 8), 12);
    expect(noise1D(0.4, "n")).not.toBeCloseTo(noise1D(8.4, "n"), 6);
  });
});

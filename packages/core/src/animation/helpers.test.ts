import { describe, expect, it } from "vite-plus/test";

import { blink, loopPeriod, oscillate, presence, pulse, round, tween } from "./helpers.js";
import { measureSpring, spring } from "./spring.js";

describe("round", () => {
  it("rounds to 2 digits by default", () => {
    expect(round(1.23456)).toBe(1.23);
    expect(round(1.23456, 3)).toBe(1.235);
  });
});

describe("tween", () => {
  it("clamps on both sides and eases out", () => {
    expect(tween(0, [10, 30])).toBe(0);
    expect(tween(40, [10, 30])).toBe(1);
    // Ease-out: past halfway at the midpoint.
    expect(tween(20, [10, 30])).toBeGreaterThan(0.5);
  });
});

describe("presence", () => {
  it("fades in around start and out around end", () => {
    expect(presence(0, 20, 80, 10)).toBe(0);
    expect(presence(20, 20, 80, 10)).toBe(0.5);
    expect(presence(50, 20, 80, 10)).toBe(1);
    expect(presence(80, 20, 80, 10)).toBe(0.5);
    expect(presence(95, 20, 80, 10)).toBe(0);
  });

  it("fades across the loop seam", () => {
    // Visible over [0, 30) of a 100-frame loop: frame 95 is fading in for the next lap.
    expect(presence(95, 0, 30, 10)).toBe(0);
    expect(presence(95, 0, 30, 10, 100)).toBe(0.25);
  });
});

describe("pulse / blink", () => {
  it("peaks at `at`", () => {
    expect(pulse(10, 10)).toBe(1);
    expect(pulse(6, 10)).toBe(0);
    expect(pulse(14, 10)).toBe(0.5);
  });

  it("alternates every half period", () => {
    expect([0, 7, 8, 15, 16].map((f) => blink(f))).toEqual([1, 1, 0, 0, 1]);
  });
});

describe("loopPeriod / oscillate", () => {
  it("snaps the period to a divisor of the loop length", () => {
    expect(loopPeriod(70, 240)).toBe(80);
    expect(loopPeriod(1000, 240)).toBe(240);
  });

  it("returns to its start value at the loop seam", () => {
    for (const period of [37, 90, 500]) {
      expect(oscillate(240, period, 240, 0.1)).toBeCloseTo(oscillate(0, period, 240, 0.1), 9);
    }
    expect(oscillate(20, 80, 240)).toBeCloseTo(1, 9);
  });
});

describe("spring", () => {
  it("starts at `from` and settles at `to`", () => {
    expect(spring({ frame: 0, fps: 30 })).toBe(0);
    expect(spring({ frame: 300, fps: 30, from: 10, to: 20 })).toBeCloseTo(20, 3);
  });

  it("overshoots unless clamped", () => {
    const peak = (overshootClamping: boolean) =>
      Math.max(...Array.from({ length: 60 }, (_, frame) => spring({ frame, fps: 30, config: { overshootClamping } })));
    expect(peak(false)).toBeGreaterThan(1);
    expect(peak(true)).toBe(1);
  });

  it("honours delay", () => {
    expect(spring({ frame: 5, fps: 30, delay: 10 })).toBe(0);
  });

  it("settles by durationInFrames when given", () => {
    const fps = 30;
    expect(measureSpring({ fps })).toBeGreaterThan(20);
    expect(spring({ frame: 20, fps, durationInFrames: 20 })).toBeCloseTo(1, 2);
  });
});

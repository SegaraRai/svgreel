import { describe, expect, it } from "vite-plus/test";
import { buildKeyframes, fmt, normalizeValue } from "./keyframes.js";

describe("fmt / normalizeValue", () => {
  it("rounds to 3 decimals without negative zero", () => {
    expect(fmt(1.23456)).toBe("1.235");
    expect(fmt(-0.0001)).toBe("0");
  });

  it("turns hex colors into rgb() and rounds numbers", () => {
    expect(normalizeValue("#fff")).toBe("rgb(255, 255, 255)");
    expect(normalizeValue("translate(1.23456px, -0.00001px)")).toBe("translate(1.235px, 0px)");
  });
});

describe("buildKeyframes", () => {
  it("reduces a linear run to its end points", () => {
    const values = Array.from({ length: 10 }, (_, i) => `${i * 10}px`);
    expect(buildKeyframes(values)).toEqual([
      { t: 0, value: "0px", step: false },
      { t: 0.9, value: "90px", step: false },
      { t: 1, value: "90px", step: false },
    ]);
  });

  it("keeps the corner of a non-linear run", () => {
    const values = [0, 1, 2, 3, 4, 3, 2, 1, 0].map((n) => String(n));
    const kept = buildKeyframes(values).map((k) => k.value);
    expect(kept).toEqual(["0", "4", "0", "0"]);
  });

  it("makes template changes hard steps", () => {
    const frames = buildKeyframes(["visible", "visible", "hidden", "hidden"]);
    expect(frames).toEqual([
      { t: 0, value: "visible", step: false },
      { t: 0.25, value: "visible", step: true },
      { t: 0.5, value: "hidden", step: false },
      { t: 0.75, value: "hidden", step: false },
      { t: 1, value: "hidden", step: false },
    ]);
  });

  it("holds a single frame", () => {
    expect(buildKeyframes(["1"])).toEqual([
      { t: 0, value: "1", step: false },
      { t: 1, value: "1", step: false },
    ]);
  });
});

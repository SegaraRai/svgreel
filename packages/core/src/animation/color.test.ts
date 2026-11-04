import { describe, expect, it } from "vite-plus/test";

import { interpolateColors, mixColors, parseColor, withAlpha } from "./color.js";

describe("parseColor", () => {
  it.each([
    ["#f00", [255, 0, 0, 1]],
    ["#ff000080", [255, 0, 0, 128 / 255]],
    ["#0f08", [0, 255, 0, 136 / 255]],
    ["rgb(1, 2, 3)", [1, 2, 3, 1]],
    ["rgba(1 2 3 / 0.5)", [1, 2, 3, 0.5]],
    ["rgb(100% 0% 50%)", [255, 0, 127.5, 1]],
    ["white", [255, 255, 255, 1]],
    ["  Transparent ", [0, 0, 0, 0]],
  ])("parses %s", (input, rgba) => {
    expect(parseColor(input)).toEqual(rgba);
  });

  it("parses hsl()", () => {
    const [r, g, b, a] = parseColor("hsl(120, 100%, 50%)");
    expect([Math.round(r), Math.round(g), Math.round(b), a]).toEqual([0, 255, 0, 1]);
  });

  it("rejects unsupported colors", () => {
    expect(() => parseColor("oklch(0.5 0.1 200)")).toThrow(/Unsupported color/);
    expect(() => parseColor("#12345")).toThrow();
  });
});

describe("mixColors / interpolateColors / withAlpha", () => {
  it("mixes channel by channel", () => {
    expect(mixColors("#000", "#fff", 0.5)).toBe("rgb(128, 128, 128)");
    expect(mixColors("#000", "rgba(0, 0, 0, 0)", 0.5)).toBe("rgba(0, 0, 0, 0.5)");
  });

  it("clamps outside the input range", () => {
    expect(interpolateColors(-1, [0, 10], ["red", "blue"])).toBe("rgb(255, 0, 0)");
    expect(interpolateColors(5, [0, 10], ["red", "blue"])).toBe("rgb(128, 0, 128)");
    expect(interpolateColors(20, [0, 10], ["red", "blue"])).toBe("rgb(0, 0, 255)");
  });

  it("replaces the alpha", () => {
    expect(withAlpha("#ff0000cc", 0.25)).toBe("rgba(255, 0, 0, 0.25)");
    expect(withAlpha("red", 1)).toBe("rgb(255, 0, 0)");
  });
});

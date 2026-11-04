import { describe, expect, it } from "vite-plus/test";

import { flattenPath, pathGeometry, pointOnPath } from "./path.js";

describe("pathGeometry", () => {
  it("measures straight segments, relative commands and H/V/Z", () => {
    expect(pathGeometry("M0 0L30 40").length).toBeCloseTo(50, 9);
    expect(pathGeometry("M10 10h20v20H10z").length).toBeCloseTo(80, 9);
    expect(pathGeometry("m0 0 10 0 0 10").length).toBeCloseTo(20, 9);
  });

  it("measures curves and arcs closely", () => {
    // Quarter circles of radius 100, as an arc and as the usual cubic approximation.
    expect(pathGeometry("M100 0A100 100 0 0 1 0 100").length).toBeCloseTo((Math.PI * 100) / 2, 0);
    expect(pathGeometry("M100 0C100 55.23 55.23 100 0 100").length).toBeCloseTo((Math.PI * 100) / 2, 0);
    // A full circle from two arcs, with flags written without separators.
    expect(pathGeometry("M0 50a50 50 0 10100 0a50 50 0 10-100 0").length).toBeCloseTo(Math.PI * 100, 0);
  });

  it("finds points by length and the direction of travel", () => {
    const p = pointOnPath("M0 0H100V100", 0.75);
    expect(p).toMatchObject({ x: 100, y: 50, angle: 90 });
    expect(pointOnPath("M0 0H100", -1)).toMatchObject({ x: 0, y: 0 });
    expect(pointOnPath("M0 0H100", 2)).toMatchObject({ x: 100, y: 0 });
  });

  it("keeps the angle continuous past ±180° so rotations don't spin backwards", () => {
    // A clockwise loop: right, down, left, up, right again.
    const d = "M0 0H10V10H0V0H10";
    const angles = [0.1, 0.3, 0.5, 0.7, 0.9].map((t) => pointOnPath(d, t).angle);
    expect(angles).toEqual([0, 90, 180, 270, 360]);
  });

  it("understands smooth curve shorthands and implicit line-tos", () => {
    const lines = flattenPath("M0 0 10 0 Q15 0 20 5 T30 10 C35 10 40 15 40 20 S45 30 50 30");
    expect(lines).toHaveLength(1);
    expect(lines[0].at(-1)).toEqual([50, 30]);
    expect(lines[0][1]).toEqual([10, 0]);
  });
});

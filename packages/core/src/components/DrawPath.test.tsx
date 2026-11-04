import { describe, expect, it } from "vite-plus/test";

import { all, render, styleOf } from "../testing.js";
import { DrawPath } from "./DrawPath.js";
import { ProgressBar } from "./ProgressBar.js";

describe("DrawPath", () => {
  const path = (progress: number) => styleOf(render(<DrawPath d="M0 0L10 0" progress={progress} />)[0]);

  it("draws along the normalised length", () => {
    expect(path(0.25)).toMatchObject({ "stroke-dashoffset": "0.75", opacity: "1" });
  });

  it("is hidden at 0 and clamps outside 0..1", () => {
    expect(path(0)).toMatchObject({ "stroke-dashoffset": "1", opacity: "0" });
    expect(path(-1)).toMatchObject({ opacity: "0" });
    expect(path(2)).toMatchObject({ "stroke-dashoffset": "0" });
  });
});

describe("ProgressBar", () => {
  it("fills from start to value as one dash", () => {
    const [line] = all(render(<ProgressBar width={100} value={0.6} start={0.2} />), "line");
    expect(styleOf(line)).toMatchObject({
      "stroke-dasharray": "0.4 2",
      "stroke-dashoffset": "-0.2",
      opacity: "1",
    });
  });

  it("hides an empty fill", () => {
    const [line] = all(render(<ProgressBar width={100} value={0.3} start={0.3} />), "line");
    expect(styleOf(line).opacity).toBe("0");
  });

  it("lights the marks inside the filled part", () => {
    const marks = all(
      render(<ProgressBar width={100} value={0.5} start={0.1} marks={[0, 0.25, 0.75]} fill="red" track="grey" />),
      "circle",
    );
    expect(marks.map((c) => styleOf(c).fill)).toEqual(["grey", "red", "grey"]);
    // Marks sit between the cap radii: 1 + m × (100 − 2).
    expect(marks.map((c) => c.attribs.cx)).toEqual(["1", "25.5", "74.5"]);
  });
});

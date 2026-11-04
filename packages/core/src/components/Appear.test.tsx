import { describe, expect, it } from "vite-plus/test";

import { render, styleOf } from "../testing.js";
import { Appear, type AppearProps } from "./Appear.js";

const at = (frame: number, props: Omit<AppearProps, "children"> = {}) =>
  styleOf(render(<Appear {...props}>x</Appear>, { frame })[0]);

describe("Appear", () => {
  it("is hidden and offset before `at`, settled after the entrance", () => {
    expect(at(0, { at: 10 })).toMatchObject({ opacity: "0", transform: "translate(0px, 30px)" });
    expect(at(30, { at: 10 })).toMatchObject({ opacity: "1", transform: "translate(0px, 0px)" });
  });

  it("moves in from the preset's side", () => {
    expect(at(0, { preset: "down" }).transform).toBe("translate(0px, -30px)");
    expect(at(0, { preset: "left", distance: 50 }).transform).toBe("translate(50px, 0px)");
    expect(at(0, { preset: "right" }).transform).toBe("translate(-30px, 0px)");
  });

  it("scales around the origin", () => {
    expect(at(0, { preset: "scale", origin: [10, 20] })).toMatchObject({
      transform: "scale(0.6)",
      "transform-origin": "10px 20px",
    });
  });

  it("pops in with a spring", () => {
    expect(at(0, { preset: "pop" }).transform).toBe("scale(0)");
    expect(at(60, { preset: "pop" })).toMatchObject({ opacity: "1", transform: "scale(1)" });
  });

  it("reverses at exitAt", () => {
    expect(at(40, { exitAt: 50 }).opacity).toBe("1");
    expect(at(70, { exitAt: 50 })).toMatchObject({ opacity: "0", transform: "translate(0px, 30px)" });
  });
});

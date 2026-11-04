import { beforeAll, describe, expect, it } from "vite-plus/test";

import { Easing } from "../animation/easing.js";
import { registerFonts } from "../fonts.js";
import { fontsource } from "../fontsource.js";
import { all, render, styleOf } from "../testing.js";
import { ArcProgress, arcPath } from "./ArcProgress.js";
import { Camera, cameraRect, cameraTransform } from "./Camera.js";
import { FollowPath } from "./FollowPath.js";
import { Marquee, marqueeSpeed } from "./Marquee.js";
import { Reveal } from "./Reveal.js";
import { Terminal, terminalTimeline, type TerminalTheme } from "./Terminal.js";
import { measureText } from "./Text.js";
import { rotatorState, TextRotator, textRotatorWidth } from "./TextRotator.js";

const ts = { family: "Inter", size: 20 };

beforeAll(() => {
  registerFonts(fontsource("inter", { family: "Inter" }));
});

const gStyles = (roots: ReturnType<typeof render>) => all(roots, "g").map(styleOf);

describe("TextRotator", () => {
  const timing = { hold: 45, transition: 15, easing: Easing.linear };

  it("holds each word, then changes over `transition` frames, cycling", () => {
    expect(rotatorState(0, 3, timing)).toEqual({ from: 0, to: 1, t: 0 });
    expect(rotatorState(50, 3, timing).t).toBeCloseTo(1 / 3, 9);
    expect(rotatorState(60, 3, timing)).toEqual({ from: 1, to: 2, t: 0 });
    expect(rotatorState(170, 3, timing)).toMatchObject({ from: 2, to: 0 });
    expect(rotatorState(180, 3, timing)).toEqual(rotatorState(0, 3, timing));
  });

  it("eases the width between words for text that follows", () => {
    const words = ["a", "wide words"];
    expect(textRotatorWidth(0, words, ts, timing)).toBeCloseTo(measureText("a", ts), 9);
    expect(textRotatorWidth(60, words, ts, timing)).toBeCloseTo(measureText("wide words", ts), 9);
  });

  it("renders every word on every frame and cross-fades them", () => {
    const words = ["one", "two", "three"];
    const opacities = (frame: number) =>
      render(<TextRotator words={words} {...ts} {...timing} />, { frame })[0]
        .children.filter((c) => "name" in c)
        .map((g) => styleOf(all(g as never, "g")[1]).opacity);
    expect(opacities(0)).toEqual(["1", "0", "0"]);
    expect(opacities(50)).toEqual(["0.667", "0.333", "0"]);
  });
});

describe("Marquee", () => {
  it("picks a speed that moves whole copies per loop", () => {
    expect(marqueeSpeed(1, 100, 120)).toBeCloseTo(100 / 120, 12);
    expect(marqueeSpeed(0.01, 100, 120)).toBeCloseTo(100 / 120, 12);
    expect(marqueeSpeed(3, 100, 120)).toBeCloseTo(3.333, 3);
  });

  it("moves one strip in a straight line with enough copies to cover the window", () => {
    const strip = (frame: number) =>
      render(
        <Marquee width={300} height={40} itemWidth={60} gap={40} speed={1}>
          <rect width={60} height={40} />
        </Marquee>,
        { frame },
      );
    expect(styleOf(all(strip(0), "g")[0]).transform).toBe("translateX(0px)");
    expect(styleOf(all(strip(60), "g")[0]).transform).toBe("translateX(-50px)");
    // 100 px of travel over the loop + a 300 px window, in 100 px steps, plus one spare.
    expect(all(strip(0), "rect")).toHaveLength(5);
  });
});

describe("Reveal", () => {
  it("slides content in from behind the edge", () => {
    const [svg] = render(
      <Reveal width={200} height={100} progress={0.25}>
        <rect />
      </Reveal>,
    );
    expect(svg.name).toBe("svg");
    expect(gStyles([svg])[0].transform).toBe("translate(0px, 75px)");
  });

  it("wipes the window across still content", () => {
    const styles = gStyles(
      render(
        <Reveal width={200} height={100} progress={0.5} direction="right" mode="wipe">
          <rect />
        </Reveal>,
      ),
    );
    expect(styles.map((s) => s.transform).filter(Boolean)).toEqual(["translate(-100px, 0px)", "translate(100px, 0px)"]);
  });
});

describe("Camera", () => {
  it("fits a region into the viewport, centred", () => {
    expect(cameraTransform([0, 0, 400, 200], [800, 400])).toBe("translate(0px, 0px) scale(2)");
    expect(cameraTransform([100, 0, 200, 400], [800, 400])).toBe("translate(200px, 0px) scale(1)");
  });

  it("zooms on a log scale with the centre moving in step", () => {
    const shots = [
      { at: 0, rect: [0, 0, 800, 400] as const },
      { at: 10, rect: [200, 100, 200, 100] as const },
    ];
    const [x, y, w, h] = cameraRect(15, shots, 10, Easing.linear);
    expect(w).toBeCloseTo(400, 9);
    expect(h).toBeCloseTo(200, 9);
    expect(x + w / 2).toBeCloseTo(350, 9);
    expect(y + h / 2).toBeCloseTo(175, 9);
    expect(cameraRect(0, shots, 10)).toEqual(shots[0].rect);
    expect(cameraRect(40, shots, 10)).toEqual([200, 100, 200, 100]);
  });

  it("applies the transform from the top-left corner", () => {
    const [g] = render(
      <Camera shots={[{ at: 0, rect: [0, 0, 400, 200] }]}>
        <rect />
      </Camera>,
    );
    expect(styleOf(g)).toMatchObject({ transform: "translate(0px, 0px) scale(2)", "transform-origin": "0px 0px" });
  });
});

describe("ArcProgress", () => {
  it("builds arcs clockwise from 12 o'clock, and full circles from two halves", () => {
    expect(arcPath(0, 0, 10, 0, 90)).toBe("M0 -10A10 10 0 0 1 10 0");
    expect(arcPath(0, 0, 10, 0, 270)).toBe("M0 -10A10 10 0 1 1 -10 0");
    expect(arcPath(0, 0, 10)).toBe("M0 -10A10 10 0 1 1 0 10A10 10 0 1 1 0 -10");
  });

  it("fills a normalised dash from `from` to `value`, hidden when empty", () => {
    const fill = (value: number, from = 0) =>
      styleOf(all(render(<ArcProgress r={10} value={value} from={from} track="#333" />), "path")[1]);
    expect(fill(0.3, 0.1)).toMatchObject({ "stroke-dasharray": "0.2 2", "stroke-dashoffset": "-0.1", opacity: "1" });
    expect(fill(0)).toMatchObject({ opacity: "0" });
  });
});

describe("FollowPath", () => {
  it("places and turns children along the path", () => {
    const at = (progress: number) =>
      styleOf(
        render(
          <FollowPath d="M0 0H100V100" progress={progress} rotate>
            <circle />
          </FollowPath>,
        )[0],
      ).transform;
    expect(at(0.25)).toBe("translate(50px, 0px) rotate(0deg)");
    expect(at(0.75)).toBe("translate(100px, 50px) rotate(90deg)");
  });
});

describe("Terminal", () => {
  const theme: TerminalTheme = {
    background: "#000",
    bar: "#111",
    border: "#222",
    text: "#eee",
    prompt: "#0f0",
    accent: "#fff",
    title: "#888",
  };
  const lines = [{ command: "ls" }, { output: "a" }, { output: "b" }, { command: "x" }];

  it("schedules typed commands and output lines", () => {
    expect(terminalTimeline(lines)).toEqual([
      { start: 0, end: 3 },
      { start: 13, end: 13 },
      { start: 16, end: 16 },
      { start: 19, end: 20.5 },
    ]);
  });

  it("scrolls by one line for each line past the window", () => {
    const scroll = (frame: number) =>
      gStyles(
        render(<Terminal lines={lines} width={300} height={104} font={{ ...ts, size: 10 }} theme={theme} />, {
          frame,
        }),
      ).find((s) => s.transform?.startsWith("translateY"))?.transform;
    expect(scroll(10)).toBe("translateY(0px)");
    expect(scroll(40)).toBe("translateY(-32px)");
  });
});

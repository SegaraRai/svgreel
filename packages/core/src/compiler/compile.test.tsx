import { describe, expect, it } from "vite-plus/test";

import { ArcProgress } from "../components/ArcProgress.js";
import { defineComposition, useCurrentFrame, useVariant } from "../timeline.js";
import { compile } from "./compile.js";

describe("compile: shared outlines", () => {
  it("moves repeated paths into <defs>, but not ones that rely on pathLength", () => {
    const d = "M10 10C20 20 30 30 40 40S60 60 70 70L80 80L90 90";
    const comp = defineComposition({
      component: () => (
        <svg viewBox="0 0 200 200">
          <path d={d} />
          <path d={d} fill="red" />
          {/* Track and fill share one arc; the fill's dash is in pathLength units. */}
          <ArcProgress cx={100} cy={100} r={50} value={0.5} track="#333" />
        </svg>
      ),
      width: 200,
      height: 200,
      fps: 30,
      durationInFrames: 2,
    });
    const svg = compile(comp).svg;
    expect(svg.match(/<use /g)).toHaveLength(2);
    const fill = svg.match(/<path[^>]*pathLength="1"[^>]*>/)?.[0];
    expect(fill).toContain(`d="M100 50A50`);
  });
});

describe("compile: frames", () => {
  const comp = (component: () => React.ReactNode) =>
    defineComposition({ component, width: 10, height: 10, fps: 30, durationInFrames: 3 });

  it("animates what changes and keeps the rest static", () => {
    const svg = compile(
      comp(() => {
        const frame = useCurrentFrame();
        return (
          <svg>
            <rect width={10} height={10} opacity={frame === 2 ? 1 : 0} fill="red" />
          </svg>
        );
      }),
    ).svg;
    expect(svg).toMatch(/<rect width="10" height="10" fill="red" class="m a0" style="opacity:1"\/>/);
    expect(svg).toContain("@keyframes k0{0%{opacity:0}33.333%{opacity:0}66.667%{opacity:1}100%{opacity:1}}");
  });

  it("reports a property that appears or disappears", () => {
    expect(() =>
      compile(
        comp(() => {
          const frame = useCurrentFrame();
          return (
            <svg>
              <rect opacity={frame === 1 ? 1 : undefined} />
            </svg>
          );
        }),
      ),
    ).toThrow(/"opacity" at svg>rect\[0\] <rect> is missing on frame 0/);
  });

  it("reports a changing tree, text or non-animatable property", () => {
    const Tree = () => <svg>{useCurrentFrame() === 2 ? <g /> : <rect />}</svg>;
    expect(() => compile(comp(Tree))).toThrow(/Element tree changes between frames at svg>rect\[0\]/);
    const Txt = () => (
      <svg>
        <text>{useCurrentFrame() ? "b" : "a"}</text>
      </svg>
    );
    expect(() => compile(comp(Txt))).toThrow(/Text content changes between frames at svg>text\[0\]/);
    const Width = () => (
      <svg>
        <rect width={useCurrentFrame()} />
      </svg>
    );
    expect(() => compile(comp(Width))).toThrow(/"width" changes between frames/);
  });
});

describe("compile: variants", () => {
  function Dot() {
    const frame = useCurrentFrame();
    const { theme, motion } = useVariant();
    return (
      <svg viewBox="0 0 10 10">
        <circle
          cx={5}
          cy={5}
          r={4}
          fill={theme === "dark" ? "white" : "black"}
          opacity={motion === "still" ? 1 : frame}
        />
      </svg>
    );
  }
  const comp = defineComposition({
    component: Dot,
    width: 10,
    height: 10,
    fps: 30,
    durationInFrames: 2,
    variants: { theme: ["dark"], lang: ["ja"] },
  });

  it("passes the variant to the component and sets lang", () => {
    const res = compile(comp, { theme: "dark", lang: "ja", motion: "default" });
    expect(res.animated).toBe(true);
    expect(res.svg).toContain(`lang="ja"`);
    expect(res.svg).toContain("white");
    expect(res.svg).toContain("@keyframes");
  });

  it("compiles motion still from one frame, without animation", () => {
    const res = compile(comp, { theme: "dark", lang: "ja", motion: "still" });
    expect(res.animated).toBe(false);
    expect(res.svg).not.toContain("@keyframes");
    expect(res.svg).not.toContain("<style>");
  });
});

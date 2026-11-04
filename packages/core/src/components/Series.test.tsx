import { describe, expect, it } from "vite-plus/test";

import { all, render, styleOf } from "../testing.js";
import { useCurrentFrame } from "../timeline.js";
import { Series, seriesTimeline, transitions } from "./Series.js";

function Frame() {
  return <text>{useCurrentFrame()}</text>;
}

/** [visibility, opacity, transform, local frame] of each scene at `frame`. */
const scenes = (frame: number, node: React.ReactNode) =>
  render(node, { frame }).map((g) => {
    const s = styleOf(g);
    return [s.visibility, s.opacity, s.transform, (all(g, "text")[0].children[0] as { data: string }).data];
  });

describe("seriesTimeline", () => {
  it("places scenes back to back, overlapping at transitions", () => {
    const { scenes: s, total } = seriesTimeline([60, { transition: 20 }, 80, 30]);
    expect(s.map((x) => x.start)).toEqual([0, 40, 120]);
    expect(s[0].exit).toEqual({ start: 40, duration: 20 });
    expect(s[1].enter).toEqual({ start: 40, duration: 20 });
    expect(total).toBe(150);
  });

  it("wraps a trailing transition across the loop seam", () => {
    const { scenes: s, total } = seriesTimeline([70, { transition: 10 }, 60, { transition: 10 }]);
    expect(total).toBe(110);
    expect(s[0]).toMatchObject({ start: -10, enter: { start: -10, duration: 10 } });
    expect(s[1].exit).toEqual({ start: 100, duration: 10 });
  });

  it("rejects transitions longer than a neighbouring scene", () => {
    expect(() => seriesTimeline([10, { transition: 20 }, 60])).toThrow(/longer than a neighbouring scene/);
  });
});

describe("Series", () => {
  const basic = (
    <Series>
      <Series.Scene duration={60}>
        <Frame />
      </Series.Scene>
      <Series.Transition duration={20} />
      <Series.Scene duration={80}>
        <Frame />
      </Series.Scene>
    </Series>
  );

  it("gives each scene its own local frame and hides it outside its slot", () => {
    expect(scenes(10, basic)).toEqual([
      ["visible", undefined, undefined, "10"],
      ["hidden", "0", undefined, "-30"],
    ]);
    expect(scenes(70, basic).map((s) => s[0])).toEqual(["hidden", "visible"]);
  });

  it("fades the later scene in over the earlier one during the overlap", () => {
    expect(scenes(50, basic)).toEqual([
      ["visible", undefined, undefined, "50"],
      ["visible", "0.5", undefined, "10"],
    ]);
    expect(scenes(70, basic)[1][1]).toBe("1");
  });

  it("plays the first scene's entrance under the last scene at the end of the loop", () => {
    const wrap = (
      <Series>
        <Series.Scene duration={70}>
          <Frame />
        </Series.Scene>
        <Series.Transition duration={10} />
        <Series.Scene duration={60}>
          <Frame />
        </Series.Scene>
        <Series.Transition duration={10} presentation={transitions.fade()} />
      </Series>
    );
    // The last scene (on top) fades out to reveal the first one.
    expect(scenes(105, wrap)).toEqual([
      ["visible", undefined, undefined, "5"],
      ["visible", "0.5", undefined, "55"],
    ]);
    expect(scenes(0, wrap).map((s) => [s[0], s[3]])).toEqual([
      ["visible", "10"],
      ["hidden", "-50"],
    ]);
  });

  it("moves both scenes for push, and keeps the same style properties on every frame", () => {
    const push = (
      <Series>
        <Series.Scene duration={60}>
          <Frame />
        </Series.Scene>
        <Series.Transition duration={20} presentation={transitions.push("right")} />
        <Series.Scene duration={60}>
          <Frame />
        </Series.Scene>
      </Series>
    );
    expect(scenes(50, push).map((s) => s[2])).toEqual(["translate(-400px, 0px)", "translate(400px, 0px)"]);
    expect(scenes(0, push).map((s) => s[2])).toEqual(["translate(0px, 0px)", "translate(800px, 0px)"]);
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { all, render, styleOf } from "./testing.js";
import { Sequence, useCurrentFrame, useVideoConfig } from "./timeline.js";

function Frame() {
  return <text>{useCurrentFrame()}</text>;
}

const visibility = (frame: number, node: React.ReactNode) => render(node, { frame }).map((g) => styleOf(g).visibility);

describe("Sequence", () => {
  it("shifts the frame its children see", () => {
    const [g] = render(
      <Sequence from={10}>
        <Frame />
      </Sequence>,
      { frame: 25 },
    );
    expect(all(g, "text")[0].children[0]).toMatchObject({ data: "15" });
  });

  it("hides children outside [from, from + durationInFrames) but keeps them rendered", () => {
    const seq = (
      <Sequence from={10} durationInFrames={5}>
        <Frame />
      </Sequence>
    );
    expect(visibility(9, seq)).toEqual(["hidden"]);
    expect(visibility(10, seq)).toEqual(["visible"]);
    expect(visibility(14, seq)).toEqual(["visible"]);
    expect(visibility(15, seq)).toEqual(["hidden"]);
    expect(all(render(seq, { frame: 0 }), "text")).toHaveLength(1);
  });

  it("nests relative to the parent sequence", () => {
    const [outer] = render(
      <Sequence from={10}>
        <Sequence from={5}>
          <Frame />
        </Sequence>
      </Sequence>,
      { frame: 20 },
    );
    expect(all(outer, "text")[0].children[0]).toMatchObject({ data: "5" });
  });
});

describe("useVideoConfig", () => {
  it("throws outside a composition", () => {
    function Config() {
      return <text>{useVideoConfig().fps}</text>;
    }
    expect(() => renderToStaticMarkup(<Config />)).toThrow(/outside of a composition/);
  });
});

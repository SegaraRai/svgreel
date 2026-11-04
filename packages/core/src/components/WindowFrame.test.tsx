import { describe, expect, it } from "vite-plus/test";

import { all, render } from "../testing.js";
import { DirectionProvider, useDirection } from "../timeline.js";
import { WindowFrame } from "./WindowFrame.js";

const circles = (roots: ReturnType<typeof render>) =>
  all(roots, "circle").map((c) => ({ cx: Number(c.attribs.cx), fill: c.attribs.fill }));

describe("useDirection", () => {
  const Probe = () => <g data-dir={useDirection()} />;

  it("is ltr without a provider and follows the nearest provider", () => {
    expect(all(render(<Probe />), "g")[0].attribs["data-dir"]).toBe("ltr");
    const nested = render(
      <DirectionProvider dir="rtl">
        <Probe />
        <DirectionProvider dir="ltr">
          <Probe />
        </DirectionProvider>
      </DirectionProvider>,
    );
    expect(all(nested, "g").map((g) => g.attribs["data-dir"])).toEqual(["rtl", "ltr"]);
  });
});

describe("WindowFrame", () => {
  it("defaults to macOS traffic lights on the left", () => {
    expect(circles(render(<WindowFrame width={300} height={200} />))).toEqual([
      { cx: 20, fill: "#ff5f57" },
      { cx: 40, fill: "#febc2e" },
      { cx: 60, fill: "#28c840" },
    ]);
  });

  it("mirrors start-side buttons in rtl, red still outermost", () => {
    const roots = render(
      <DirectionProvider dir="rtl">
        <WindowFrame width={300} height={200} />
      </DirectionProvider>,
    );
    expect(circles(roots).map((c) => c.cx)).toEqual([280, 260, 240]);
  });

  it("draws Windows glyphs from the right edge with a 32px bar", () => {
    const roots = render(<WindowFrame preset="windows" width={300} height={200} controlColor="#fff" />);
    const paths = all(roots, "path").map((p) => p.attribs.d);
    // Close, maximize, minimize; 46px cells, centred at 300 - 23, 300 - 69, 300 - 115.
    expect(paths).toEqual(["M272 11l10 10m0 -10l-10 10", "M226 11h10v10h-10z", "M180 11m0 5.5h10"]);
    expect(all(roots, "svg")[0].attribs.y).toBe("32");
  });

  it("lets props override the preset, and buttons={false} hides the buttons", () => {
    const roots = render(
      <WindowFrame preset="windows" controls="dots" controlsSide="start" width={300} height={200} />,
    );
    expect(circles(roots).map((c) => c.cx)).toEqual([18, 38, 58]);
    expect(circles(render(<WindowFrame width={300} height={200} buttons={false} />))).toEqual([]);
    expect(circles(render(<WindowFrame preset="plain" width={300} height={200} />))).toEqual([]);
  });
});

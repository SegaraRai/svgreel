import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { parseSlow, parseSvg } from "./tree.js";

describe("parseSvg", () => {
  it("matches htmlparser2 on React's markup", () => {
    const markup = renderToStaticMarkup(
      <svg viewBox="0 0 10 10" data-x={`a"b'c<d>e&f`}>
        <g style={{ transform: "translate(1px, 2px)", opacity: 0.5 }} strokeWidth={2}>
          <path d="M0 0L1 1" />
          <rect x={1} y={2} width={3} height={4} fill="url(#g)" />
          <text>
            {"Tom & Jerry <3 "}
            {"'quoted'"}
          </text>
        </g>
        <linearGradient id="g">
          <stop offset="0" stopColor="#fff" />
        </linearGradient>
        <image href="data:image/png;base64,AAAA" width={1} height={1} />
      </svg>,
    );
    expect(parseSvg(markup)).toEqual(parseSlow(markup));
  });

  it("decodes character references like htmlparser2", () => {
    const markup = `<svg a="&#x41;&#66;&amp;&nbsp;&apos;"><text>&lt;&#x1F600;&gt;</text></svg>`;
    const tree = parseSvg(markup);
    expect(tree.attrs.get("a")).toBe("AB&&nbsp;'");
    expect(tree).toEqual(parseSlow(markup));
  });

  it("hands markup it doesn't expect to htmlparser2", () => {
    for (const markup of [
      `<svg><!-- note --><g/></svg>`,
      `<svg><style>a > b { fill: red }</style></svg>`,
      `<svg a='single'><g/></svg>`,
      `<svg><g></svg>`,
    ]) {
      expect(parseSvg(markup)).toEqual(parseSlow(markup));
    }
  });

  it("requires a single root <svg>", () => {
    expect(() => parseSvg("<g></g>")).toThrow(/single root <svg>/);
  });
});

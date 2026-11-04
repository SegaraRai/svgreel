import { beforeAll, describe, expect, it } from "vite-plus/test";

import { registerFonts } from "../fonts.js";
import { fontsource } from "../fontsource.js";
import { all, render, styleOf } from "../testing.js";
import { codeBlockHeight, highlight, type CodeTheme } from "./CodeBlock.js";
import { fitFontSize, measureText, measureTextBlock, Text } from "./Text.js";
import { Typewriter } from "./Typewriter.js";

const ts = { family: "Inter", size: 20 };

beforeAll(() => {
  registerFonts(fontsource("inter", { family: "Inter" }));
});

describe("Text", () => {
  it("outlines one path per visible glyph", () => {
    expect(all(render(<Text {...ts}>Hi there</Text>), "path")).toHaveLength(7);
  });

  it("applies style on an inner group, so a transform doesn't replace the position", () => {
    const [outer] = render(
      <Text {...ts} x={40} y={50} style={{ transform: "translateY(10px)" }}>
        Hi
      </Text>,
    );
    expect(outer.attribs.transform).toBe("translate(40 50)");
    expect(outer.attribs.style).toBeUndefined();
    expect(styleOf(all(outer, "g")[1]).transform).toBe("translateY(10px)");
  });

  it("gives charStyle each glyph's position in the text", () => {
    const infos: [number, string, number][] = [];
    render(
      <Text {...ts} charStyle={(c) => (infos.push([c.index, c.char, c.offset]), { opacity: c.index / c.count })}>
        a b
      </Text>,
    );
    expect(infos).toEqual([
      [0, "a", 0],
      [1, "b", 2],
    ]);
  });

  it("anchors lines around x", () => {
    const firstX = (anchor: "start" | "middle" | "end") => {
      const [path] = all(
        render(
          <Text {...ts} anchor={anchor}>
            Hello
          </Text>,
        ),
        "path",
      );
      return Number(path.attribs.transform.match(/translate\(([-\d.]+)/)![1]);
    };
    const w = measureText("Hello", ts);
    expect(firstX("middle")).toBeCloseTo(firstX("start") - w / 2, 1);
    expect(firstX("end")).toBeCloseTo(firstX("start") - w, 1);
  });

  it("wraps at maxWidth and breaks at newlines", () => {
    const w = measureText("one two", ts);
    expect(measureTextBlock("one two three", { ...ts, maxWidth: w + 1 }).lines.map((l) => l.text)).toEqual([
      "one two",
      "three",
    ]);
    expect(measureTextBlock("a\nb", ts).lines).toHaveLength(2);
  });

  it("fits a font size to a width", () => {
    const w = measureText("Wide title", ts);
    expect(fitFontSize("Wide title", ts, w * 2)).toBe(20);
    expect(fitFontSize("Wide title", ts, w / 2)).toBeCloseTo(10, 1);
  });
});

describe("Typewriter", () => {
  /** Opacity of each glyph (the full text is always rendered; untyped glyphs are transparent). */
  const glyphs = (frame: number, props: { eraseAt?: number } = {}) =>
    all(render(<Typewriter {...ts} text="abcd" start={10} speed={2} {...props} />, { frame }), "g")
      .map(styleOf)
      .filter((s) => s.opacity !== undefined && s.transform === undefined)
      .map((s) => s.opacity);
  const shown = (frame: number, props: { eraseAt?: number } = {}) =>
    glyphs(frame, props).filter((o) => o === "1").length;

  it("types one character per `speed` frames from `start`", () => {
    expect(glyphs(0)).toHaveLength(4);
    expect(shown(9)).toBe(0);
    expect(shown(10)).toBe(1);
    expect(shown(13)).toBe(2);
    expect(shown(100)).toBe(4);
  });

  it("backspaces from eraseAt", () => {
    expect(shown(30, { eraseAt: 30 })).toBe(3);
    expect(shown(100, { eraseAt: 30 })).toBe(0);
  });

  it("moves the caret to the end of the typed text", () => {
    const caret = (frame: number) =>
      styleOf(all(render(<Typewriter {...ts} text="abcd" start={10} />, { frame }), "rect")[0]);
    expect(caret(0).transform).toBe("translateX(0px)");
    expect(caret(100).transform).toBe(`translateX(${Math.round(measureText("abcd", ts) * 100) / 100}px)`);
    // Solid while typing, blinking once done.
    expect(caret(12).opacity).toBe("1");
    expect(new Set([100, 108].map((f) => caret(f).opacity))).toEqual(new Set(["0", "1"]));
  });
});

describe("CodeBlock helpers", () => {
  const theme = {
    text: "text",
    comment: "comment",
    string: "string",
    keyword: "keyword",
    number: "number",
    tag: "tag",
  } as CodeTheme;

  it("highlights keywords, strings, numbers, tags and comments", () => {
    expect(highlight(`const a = "x" + 42; // done`, theme)).toEqual([
      { text: "const", color: "keyword" },
      { text: " a = ", color: "text" },
      { text: `"x"`, color: "string" },
      { text: " + ", color: "text" },
      { text: "42", color: "number" },
      { text: "; ", color: "text" },
      { text: "// done", color: "comment" },
    ]);
    expect(highlight("<Box />", theme).map((t) => t.color)).toEqual(["tag", "text", "tag"]);
  });

  it("keeps every character", () => {
    const line = `  return <div className='a'>{n * 2}</div>; # not a comment here`;
    expect(
      highlight(line, theme)
        .map((t) => t.text)
        .join(""),
    ).toBe(line);
  });

  it("adds the header bar only with a file or language", () => {
    const lines = ["a", "b"];
    expect(codeBlockHeight({ lines })).toBeCloseTo(22 + 56 + 22 - 8.4);
    expect(codeBlockHeight({ lines, file: "a.ts" }) - codeBlockHeight({ lines })).toBe(40);
  });
});

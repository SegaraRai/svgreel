import { describe, expect, it } from "vite-plus/test";

import type { CodeTheme } from "./CodeBlock.js";
import { highlightCode } from "./highlightCode.js";

const theme: CodeTheme = {
  background: "#000000",
  header: "#111111",
  border: "#222222",
  text: "#eeeeee",
  comment: "#777777",
  string: "#00aa00",
  keyword: "#ff8800",
  number: "#0088ff",
  tag: "#00ffff",
  function: "#ff00ff",
  accent: "#ff8800",
};

const text = (line: { text: string }[]) => line.map((t) => t.text).join("");

describe("highlightCode", () => {
  it("keeps every character, one token array per line", async () => {
    const code = "/* a\n   b */\nconst s = `x${1}`;\n";
    const { tokens } = await highlightCode(code, { lang: "ts", theme });
    expect(tokens.map(text)).toEqual(["/* a", "   b */", "const s = `x${1}`;"]);
  });

  it("maps a CodeTheme onto the grammar's scopes, across lines", async () => {
    const { tokens, background, foreground } = await highlightCode("/* a\n b */ f(42);", { lang: "ts", theme });
    expect([background, foreground]).toEqual(["#000000", "#eeeeee"]);
    expect(tokens[1][0]).toMatchObject({ text: " b */ ", color: "#777777" });
    const color = (s: string) => tokens[1].find((t) => t.text.trim() === s)?.color;
    expect(color("f")).toBe("#ff00ff");
    expect(color("42")).toBe("#0088ff");
  });

  it("merges neighbors that look the same", async () => {
    const { tokens } = await highlightCode("a + b", { lang: "ts", theme });
    expect(tokens[0]).toEqual([{ text: "a + b", color: "#eeeeee", weight: undefined }]);
  });

  it("takes shiki's bundled themes", async () => {
    const { tokens, background } = await highlightCode("const a = 1;", { lang: "ts", theme: "github-dark" });
    expect(background).toBe("#24292e");
    expect(new Set(tokens[0].map((t) => t.color)).size).toBeGreaterThan(2);
  });
});

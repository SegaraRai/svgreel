import {
  codeToTokens,
  type BundledLanguage,
  type BundledTheme,
  type SpecialLanguage,
  type StringLiteralUnion,
  type ThemeRegistration,
} from "shiki";

import type { CodeTheme, CodeToken } from "./CodeBlock.js";

export interface HighlightCodeOptions {
  /** A language shiki bundles (`"tsx"`, `"rust"`, `"css"`, …), or `"text"` for none. */
  lang: BundledLanguage | SpecialLanguage;
  /**
   * A theme shiki bundles (`"github-dark"`, …), a VS Code theme object, or a `CodeTheme`, whose
   * colors are mapped onto TextMate scopes.
   */
  theme: StringLiteralUnion<BundledTheme> | ThemeRegistration | CodeTheme;
}

export interface HighlightedCode {
  /** One array of tokens per line, for `<CodeBlock tokens>`. */
  tokens: CodeToken[][];
  /** The theme's background and default text colors. */
  background: string;
  foreground: string;
}

const BOLD = 2;

function isCodeTheme(theme: HighlightCodeOptions["theme"]): theme is CodeTheme {
  return typeof theme === "object" && "keyword" in theme && !("tokenColors" in theme) && !("settings" in theme);
}

/** A TextMate theme that colors code the way a `CodeTheme` describes. */
export function codeThemeToShiki(theme: CodeTheme): ThemeRegistration {
  const rules: [string[], string | undefined][] = [
    [["comment", "punctuation.definition.comment"], theme.comment],
    [["string", "punctuation.definition.string", "string.regexp"], theme.string],
    [["keyword", "storage", "keyword.operator.new", "keyword.operator.expression"], theme.keyword],
    [["constant.numeric", "constant.language", "constant.character"], theme.number],
    [["entity.name.tag", "support.class.component"], theme.tag],
    [["entity.name.function", "support.function", "meta.function-call"], theme.function],
    [["entity.name.type", "entity.name.class", "support.type", "support.class"], theme.type],
  ];
  return {
    name: "svgreel-code-theme",
    colors: { "editor.background": theme.background, "editor.foreground": theme.text },
    settings: [
      { settings: { foreground: theme.text, background: theme.background } },
      { scope: ["keyword.operator", "punctuation"], settings: { foreground: theme.text } },
      ...rules.flatMap(([scope, foreground]) => (foreground ? [{ scope, settings: { foreground } }] : [])),
    ],
  };
}

/**
 * Highlights code with [shiki](https://shiki.style/) (TextMate grammars, as in VS Code), for
 * `<CodeBlock tokens>`. Async: call it at the top of the composition with `await`. A trailing
 * newline doesn't add an empty line.
 */
export async function highlightCode(code: string, { lang, theme }: HighlightCodeOptions): Promise<HighlightedCode> {
  const result = await codeToTokens(code.replace(/\r?\n$/, ""), {
    lang,
    theme: isCodeTheme(theme) ? codeThemeToShiki(theme) : theme,
  });
  const foreground = (result.fg ?? "#000000").toLowerCase();
  const tokens = result.tokens.map((line) => {
    // Neighbors with the same look become one run: fewer elements in the SVG.
    const runs: CodeToken[] = [];
    for (const t of line) {
      const color = t.color?.toLowerCase() ?? foreground;
      const weight = (t.fontStyle ?? 0) & BOLD ? 700 : undefined;
      const prev = runs.at(-1);
      if (prev && prev.text.trim() === "") {
        // Leading whitespace takes the look of what follows it.
        Object.assign(prev, { text: prev.text + t.content, color, weight });
      } else if (prev && (t.content.trim() === "" || (prev.color === color && prev.weight === weight))) {
        prev.text += t.content;
      } else {
        runs.push({ text: t.content, color, weight });
      }
    }
    return runs;
  });
  return { tokens, background: (result.bg ?? "#ffffff").toLowerCase(), foreground };
}

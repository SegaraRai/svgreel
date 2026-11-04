import { blink, round, tween, typedChars } from "../animation/helpers.js";
import type { TextStyle } from "../fonts.js";
import { useCurrentFrame } from "../timeline.js";
import { measureText, Text } from "./Text.js";

export interface CodeTheme {
  background: string;
  header: string;
  border: string;
  text: string;
  comment: string;
  string: string;
  keyword: string;
  number: string;
  /** JSX / HTML tags. */
  tag: string;
  /** Function names. Only `highlightCode()` tells them apart; default: `text`. */
  function?: string;
  /** Type and class names. Only `highlightCode()` tells them apart; default: `text`. */
  type?: string;
  /** Caret, active-tab underline and language label. */
  accent: string;
}

/** One colored run of a line, e.g. from shiki's `codeToTokens()`. */
export interface CodeToken {
  text: string;
  /** Default: the theme's `text` color. */
  color?: string;
  /** Font weight for this run. Default: the code font's weight. */
  weight?: number;
}

/** The code to show: plain lines (highlighted by `highlight()`), or lines already split into tokens. */
export type CodeSource =
  | {
      lines: string[];
      tokens?: never;
    }
  | {
      /** One array of tokens per line, from any highlighter. Replaces the built-in highlighting. */
      tokens: CodeToken[][];
      lines?: never;
    };

export type CodeBlockProps = CodeSource & {
  x?: number;
  y?: number;
  width: number;
  /** Code font (a monospace family, e.g. JetBrains Mono). */
  font: TextStyle;
  theme: CodeTheme;
  /** Tab title; with `lang`, shown in a header bar. Omit both for no header. */
  file?: string;
  lang?: string;
  lineHeight?: number;
  padding?: number;
  radius?: number;
  /** Local frame at which typing starts. */
  start?: number;
  /** Frames per character (fractions are fine: 0.25 = 4 characters per frame). */
  speed?: number;
  /** Frames to pause at the end of each line. */
  linePause?: number;
  /** Show a caret. Default true. */
  caret?: boolean;
};

const KEYWORDS =
  "import|from|export|default|const|let|var|function|return|if|else|for|while|await|async|new|class|extends|type|interface|fn|pub|use|mod|impl|struct|enum|match|def|self|true|false|null|undefined|None|True|False";
const TOKEN = new RegExp(
  [
    String.raw`(\/\/.*$|(?<=^|\s)#\s.*$)`, // comment
    String.raw`("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\x60[^\x60]*\x60)`, // string
    String.raw`\b(${KEYWORDS})\b`, // keyword
    String.raw`\b(\d[\d_.]*)\b`, // number
    String.raw`(<\/?[\w.-]+|\/?>)`, // tag
  ].join("|"),
  "g",
);

/** Splits a line into colored tokens with a small language-agnostic highlighter. */
export function highlight(
  line: string,
  theme: CodeTheme,
): {
  text: string;
  color: string;
}[] {
  const out: {
    text: string;
    color: string;
  }[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    if (m.index > last) {
      out.push({
        text: line.slice(last, m.index),
        color: theme.text,
      });
    }
    const color = m[1] ? theme.comment : m[2] ? theme.string : m[3] ? theme.keyword : m[4] ? theme.number : theme.tag;
    out.push({
      text: m[0],
      color,
    });
    last = m.index + m[0].length;
  }
  if (last < line.length) {
    out.push({
      text: line.slice(last),
      color: theme.text,
    });
  }
  return out;
}

/** Total height of a <CodeBlock> with these settings. */
export function codeBlockHeight({
  lines,
  tokens,
  file,
  lang,
  lineHeight = 28,
  padding = 22,
}: CodeSource & Pick<CodeBlockProps, "file" | "lang" | "lineHeight" | "padding">) {
  const count = (tokens ?? lines).length;
  return (file || lang ? 40 : 0) + padding + count * lineHeight + padding - lineHeight * 0.3;
}

/** Editor card whose lines are revealed left to right as if typed, with a caret. */
export function CodeBlock({
  lines: plain,
  tokens,
  x = 0,
  y = 0,
  width,
  font,
  theme,
  file,
  lang,
  lineHeight = 28,
  padding = 22,
  radius = 14,
  start = 0,
  speed = 0.25,
  linePause = 2,
  caret = true,
}: CodeBlockProps) {
  const frame = useCurrentFrame();
  const runs: CodeToken[][] = tokens ?? plain.map((line) => highlight(line, theme));
  const lines = tokens ? tokens.map((line) => line.map((tok) => tok.text).join("")) : plain;
  const header = file || lang ? 40 : 0;
  const height = codeBlockHeight({ lines, file, lang, lineHeight, padding });
  const firstBaseline = header + padding + font.size * 0.9;

  let t = start;
  const timing = lines.map((l) => {
    const s = t;
    t += Math.max([...l].length, 1) * speed + linePause;
    return { start: s, end: s + [...l].length * speed };
  });
  const active = timing.findIndex((tm) => frame < tm.end);
  const caretLine = active === -1 ? lines.length - 1 : active;
  const caretChars =
    active === -1 ? [...lines[caretLine]].length : Math.max(0, typedChars(frame - timing[caretLine].start, speed));
  const caretX = padding + measureText([...lines[caretLine]].slice(0, caretChars).join(""), font);
  const fileW = file
    ? measureText(file, {
        ...font,
        size: font.size * 0.87,
      })
    : 0;

  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={width} height={height} rx={radius} fill={theme.background} stroke={theme.border} />
      {header > 0 && (
        <g>
          <rect width={width} height={header} rx={radius} fill={theme.header} />
          <rect y={header - radius} width={width} height={radius} fill={theme.header} />
          <line x1={0} y1={header} x2={width} y2={header} stroke={theme.border} />
          {file && (
            <g>
              <rect x={padding - 10} y={8} width={round(fileW + 20)} height={24} rx={6} fill={theme.background} />
              <rect x={padding - 10} y={30} width={round(fileW + 20)} height={2} fill={theme.accent} />
              <Text x={padding} y={20} baseline="middle" {...font} size={font.size * 0.87} fill={theme.text}>
                {file}
              </Text>
            </g>
          )}
          {lang && (
            <Text
              x={width - padding}
              y={20}
              anchor="end"
              baseline="middle"
              {...font}
              size={font.size * 0.8}
              fill={theme.accent}
            >
              {lang}
            </Text>
          )}
        </g>
      )}
      {/* Clipped to the card: each line's cover slides out past the right edge as it reveals. */}
      <svg width={width} height={height} overflow="hidden">
        {lines.map((line, k) => {
          const ly = firstBaseline + k * lineHeight;
          const lineW = measureText(line, font);
          const prog = tween(frame, [timing[k].start, Math.max(timing[k].end, timing[k].start + 1)], [0, 1], (v) => v);
          let prefix = "";
          return (
            <g key={k}>
              {runs[k].map((tok, i) => {
                const tx = padding + measureText(prefix, font);
                prefix += tok.text;
                return tok.text.trim() === "" ? null : (
                  <Text
                    key={i}
                    x={round(tx)}
                    y={ly}
                    {...font}
                    weight={tok.weight ?? font.weight}
                    fill={tok.color ?? theme.text}
                  >
                    {tok.text}
                  </Text>
                );
              })}
              <rect
                x={padding - 2}
                y={round(ly - lineHeight * 0.7)}
                width={width}
                height={lineHeight}
                fill={theme.background}
                style={{ transform: `translateX(${round(prog * (lineW + 2))}px)` }}
              />
            </g>
          );
        })}
      </svg>
      {caret && (
        <rect
          width={2}
          height={round(font.size * 1.2)}
          fill={theme.accent}
          style={{
            opacity: frame >= start - 6 && (active !== -1 || blink(frame) === 1) ? 1 : 0,
            transform: `translate(${round(caretX)}px, ${round(firstBaseline - font.size * 0.95 + caretLine * lineHeight)}px)`,
          }}
        />
      )}
    </g>
  );
}

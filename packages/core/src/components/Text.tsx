import type { CSSProperties, SVGProps } from "react";

import { round } from "../animation/helpers.js";
import { breakLines, EM, layoutLine, type TextLayout, type TextStyle } from "../fonts.js";

export interface CharInfo {
  /** Index among visible (non-space) glyphs across all lines. */
  index: number;
  /** Number of visible glyphs. */
  count: number;
  line: number;
  /** Source character of this glyph. */
  char: string;
  /** UTF-16 index of that character within its line's text (spaces count, unlike `index`). */
  offset: number;
  /** Horizontal advance of this glyph in px (≈ its width). */
  advance: number;
  /** Font size in px. */
  size: number;
}

export interface TextBlockStyle extends TextStyle {
  /** Line height in px for multi-line text. Defaults to 1.25 × size. */
  lineHeight?: number;
  /** Wrap lines to this width (px). "\n" always breaks. */
  maxWidth?: number;
}

export interface TextProps
  extends
    Omit<SVGProps<SVGGElement>, "children" | "style" | "fontFamily" | "fontWeight" | "fontSize" | "letterSpacing">,
    TextBlockStyle {
  children: string;
  x?: number;
  y?: number;
  /** Horizontal alignment of each line relative to x. */
  anchor?: "start" | "middle" | "end";
  /**
   * What `y` refers to: the first line's baseline ("alphabetic", default), the top of the first
   * line ("top"), or the vertical centre of the block's capital letters ("middle", handy for
   * centring a label in a box).
   */
  baseline?: "alphabetic" | "top" | "middle";
  fill?: string;
  /** Style for the text as a whole; a `transform` here is relative to (x, y). */
  style?: CSSProperties;
  /**
   * Per-glyph style (e.g. staggered transforms). Transforms are relative to the glyph's
   * baseline-left corner. See `charAnimations` for ready-made ones.
   */
  charStyle?: (c: CharInfo) => CSSProperties;
}

export interface TextBlock {
  lines: { text: string; layout: TextLayout }[];
  /** Widest line. */
  width: number;
  /** From the top of the first line's capitals to the last baseline. */
  height: number;
  lineHeight: number;
}

/** Lays out (and wraps) a block of text without rendering it. */
export function measureTextBlock(text: string, style: TextBlockStyle): TextBlock {
  const lh = style.lineHeight ?? style.size * 1.25;
  const lines = breakLines(text, style, style.maxWidth).map((t) => ({ text: t, layout: layoutLine(t, style) }));
  const cap = lines[0]?.layout.capHeight ?? 0;
  return {
    lines,
    width: Math.max(0, ...lines.map((l) => l.layout.width)),
    height: cap + (lines.length - 1) * lh,
    lineHeight: lh,
  };
}

/** Width of a single line, for layout. */
export function measureText(text: string, style: TextStyle): number {
  return layoutLine(text, style).width;
}

/** Largest font size ≤ style.size at which `text` fits in `maxWidth` on one line. */
export function fitFontSize(text: string, style: TextStyle, maxWidth: number): number {
  const w = measureText(text, style);
  return w <= maxWidth ? style.size : Math.floor(((style.size * maxWidth) / w) * 100) / 100;
}

/** Text rendered as outlined paths, so the SVG needs no web fonts. */
export function Text({
  children,
  x = 0,
  y = 0,
  family,
  weight,
  size,
  letterSpacing,
  features,
  lineHeight,
  maxWidth,
  anchor = "start",
  baseline = "alphabetic",
  fill = "currentColor",
  style,
  charStyle,
  ...rest
}: TextProps) {
  const ts: TextStyle = { family, weight, size, letterSpacing, features };
  const block = measureTextBlock(children, { ...ts, lineHeight, maxWidth });
  const lh = block.lineHeight;
  const first = block.lines[0]?.layout;
  const dy = !first
    ? 0
    : baseline === "top"
      ? first.ascent
      : baseline === "middle"
        ? first.capHeight - block.height / 2
        : 0;
  const shift = (w: number) => (anchor === "middle" ? -w / 2 : anchor === "end" ? -w : 0);

  const scale = `scale(${Math.round((size / EM) * 10000) / 10000})`;
  const count = block.lines.reduce((n, l) => n + l.layout.glyphs.filter((g) => g.d).length, 0);
  let index = 0;
  const glyphs = block.lines.flatMap(({ text, layout }, li) =>
    layout.glyphs
      .filter((g) => g.d)
      .map((g) => {
        const info: CharInfo = {
          index: index++,
          count,
          line: li,
          char: text.slice(g.char)[0] ?? "",
          offset: g.char,
          advance: g.advance,
          size,
        };
        const at = `translate(${round(g.x + shift(layout.width))} ${round(g.y + li * lh)})`;
        if (!charStyle) {
          return <path key={info.index} d={g.d} transform={`${at} ${scale}`} />;
        }
        // Positioned wrapper > animated group > scaled outline, so CSS transforms in charStyle
        // are in px relative to the glyph's baseline-left corner.
        return (
          <g key={info.index} transform={at}>
            <g style={charStyle(info)}>
              <path d={g.d} transform={scale} />
            </g>
          </g>
        );
      }),
  );
  const at = `translate(${round(x)} ${round(y + dy)})`;
  // The position is a transform attribute and a CSS transform would replace it, so `style` goes
  // on an inner group: `style={{ transform }}` then moves the text relative to (x, y).
  return (
    <g transform={at} fill={fill} {...rest}>
      {style ? <g style={style}>{glyphs}</g> : glyphs}
    </g>
  );
}

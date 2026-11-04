import fs from "node:fs";
import path from "node:path";

import * as fontkit from "fontkit";

export interface FontSpec {
  family: string;
  /** Default 400. Requests pick the closest registered weight of the family. */
  weight?: number;
  /**
   * Path(s) to .ttf / .otf / .woff / .woff2 / .ttc files, relative to the project root. Several
   * files form one face split into subsets (e.g. Fontsource's numbered CJK chunks); each character
   * uses the first file that has it.
   */
  src: string | string[];
  /** For .ttc collections: PostScript name of the face to use. */
  postscriptName?: string;
  /** OpenType features applied to all text in this face, e.g. ["zero"] or ["palt"]. */
  features?: string[];
  /**
   * Add this family to the fallback chain: characters missing from the requested family are taken
   * from fallback families, in registration order. Typical use: a CJK font behind a Latin one.
   */
  fallback?: boolean;
}

interface Face {
  family: string;
  weight: number;
  fonts: fontkit.Font[];
  features: string[];
  fallback: boolean;
}

const registry: Face[] = [];
const warned = new Set<string>();

function warnOnce(msg: string) {
  if (warned.has(msg)) {
    return;
  }
  warned.add(msg);
  console.warn(`[svgreel] ${msg}`);
}

function open(src: string, postscriptName?: string): fontkit.Font {
  const file = path.resolve(src);
  if (!fs.existsSync(file)) {
    throw new Error(`Font file not found: ${src} (paths are relative to the project root)`);
  }
  let f = fontkit.openSync(file, postscriptName) as fontkit.Font | fontkit.FontCollection;
  // .ttc without a postscriptName: take the first face.
  if ("fonts" in f) {
    f = f.fonts[0];
  }
  return f as fontkit.Font;
}

export function registerFonts(specs: FontSpec[]) {
  registry.length = 0;
  layoutCache.clear();
  for (const s of specs) {
    const fonts = (Array.isArray(s.src) ? s.src : [s.src]).map((src) => open(src, s.postscriptName));
    const features = s.features ?? [];
    const missing = features.filter((t) => !fonts.some((f) => f.availableFeatures.includes(t)));
    if (missing.length) {
      warnOnce(`${s.family} ${s.weight ?? 400} lacks OpenType feature(s): ${missing.join(", ")}`);
    }
    registry.push({ family: s.family, weight: s.weight ?? 400, fonts, features, fallback: !!s.fallback });
  }
}

/** Closest-weight face of a family, or undefined when the family isn't registered. */
function face(family: string, weight: number): Face | undefined {
  let best: Face | undefined;
  for (const r of registry) {
    if (r.family !== family) {
      continue;
    }
    if (!best || Math.abs(r.weight - weight) < Math.abs(best.weight - weight)) {
      best = r;
    }
  }
  return best;
}

/** Requested families first, then registered fallback families. */
function chain(family: string | string[], weight: number): Face[] {
  const requested = Array.isArray(family) ? family : [family];
  const names = [...requested, ...registry.filter((r) => r.fallback).map((r) => r.family)];
  const faces: Face[] = [];
  for (const name of new Set(names)) {
    const f = face(name, weight);
    if (f) {
      faces.push(f);
    } else if (requested.includes(name)) {
      throw new Error(`Font family "${name}" is not registered (add it to the composition's fonts)`);
    }
  }
  return faces;
}

export interface TextStyle {
  /** A family name, or several to try in order. Registered fallback families are tried after these. */
  family: string | string[];
  weight?: number;
  size: number;
  /** Extra px between glyphs. */
  letterSpacing?: number;
  /** OpenType features for this text, on top of the face's own (e.g. ["palt"], ["tnum"], ["ss01"]). */
  features?: string[];
}

/**
 * Glyph outlines are emitted at this canonical font size and scaled by the renderer, so the same
 * glyph used at different sizes shares one path (deduplicated into <defs>/<use> by the compiler).
 */
export const EM = 100;

export interface PlacedGlyph {
  /** UTF-16 index into the source string of the first character in this glyph's cluster. */
  char: number;
  x: number;
  y: number;
  /** Outline at the origin (baseline-left) at size EM, y-flipped. Empty for spaces. */
  d: string;
  advance: number;
}

export interface TextLayout {
  glyphs: PlacedGlyph[];
  width: number;
  ascent: number;
  descent: number;
  /** Height of capital letters above the baseline. */
  capHeight: number;
}

const layoutCache = new Map<string, TextLayout>();
const outlineCache = new Map<fontkit.Glyph, string>();

// Characters that render with whatever font the surrounding text uses.
// (ZWJ outside the class: inside one, it reads as a misleading joined sequence.)
const INHERITS = /[\s\p{M}\ufe00-\ufe0f]|\u200d/u;

/** Splits text into runs that each use one font file. */
function segment(text: string, faces: Face[]) {
  const runs: { text: string; start: number; face: Face; font: fontkit.Font }[] = [];
  let offset = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const prev = runs.at(-1);
    let face: Face | undefined;
    let font: fontkit.Font | undefined;
    if (prev && INHERITS.test(ch)) {
      face = prev.face;
      font = prev.font;
    } else {
      for (const f of faces) {
        font = f.fonts.find((x) => x.hasGlyphForCodePoint(cp));
        if (font) {
          face = f;
          break;
        }
      }
      if (!font) {
        face = faces[0];
        font = faces[0].fonts[0];
        if (!INHERITS.test(ch)) {
          warnOnce(
            `No registered font has "${ch}" (U+${cp.toString(16).toUpperCase().padStart(4, "0")}); register a font that covers it, e.g. with fallback: true`,
          );
        }
      }
    }
    if (prev && prev.font === font) {
      prev.text += ch;
    } else {
      runs.push({ text: ch, start: offset, face: face!, font });
    }
    offset += ch.length;
  }
  return runs;
}

/** Shapes a single line of text into positioned glyphs (y = 0 is the baseline). */
export function layoutLine(text: string, style: TextStyle): TextLayout {
  const key = JSON.stringify([text, style]);
  const hit = layoutCache.get(key);
  if (hit) {
    return hit;
  }

  const weight = style.weight ?? 400;
  const faces = chain(style.family, weight);
  const primary = faces[0].fonts[0];
  const spacing = style.letterSpacing ?? 0;
  const glyphs: PlacedGlyph[] = [];
  let pen = 0;

  for (const run of segment(text, faces)) {
    const font = run.font;
    const scale = style.size / font.unitsPerEm;
    const features = [...new Set([...run.face.features, ...(style.features ?? [])])];
    const shaped = font.layout(run.text, features.length ? features : undefined);
    const cps = [...run.text];
    let consumed = 0;
    shaped.glyphs.forEach((g, i) => {
      const pos = shaped.positions[i];
      let d = outlineCache.get(g);
      if (d === undefined) {
        const k = EM / font.unitsPerEm;
        d = compactPath(g.path.scale(k, -k).toSVG());
        outlineCache.set(g, d);
      }
      const advance = pos.xAdvance * scale + spacing;
      glyphs.push({
        char: run.start + cps.slice(0, consumed).join("").length,
        x: pen + pos.xOffset * scale,
        y: -pos.yOffset * scale,
        d,
        advance,
      });
      consumed += g.codePoints.length;
      pen += advance;
    });
  }

  const s = style.size / primary.unitsPerEm;
  const out: TextLayout = {
    glyphs,
    width: pen - (glyphs.length ? spacing : 0),
    ascent: primary.ascent * s,
    descent: -primary.descent * s,
    capHeight: (primary.capHeight || primary.ascent * 0.7) * s,
  };
  layoutCache.set(key, out);
  return out;
}

// ---------------------------------------------------------------------------------------------
// line breaking

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\uff00-\uffef]/u;
/** Must not start a line (closing brackets, small kana, Japanese punctuation, …). */
const NO_START = new Set(
  "、。，．・：；？！ー―‐〜…‥）」』】〕〉》〙〗］｝’”ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ,.:;!?)]}%",
);
/** Must not end a line (opening brackets, …). */
const NO_END = new Set("（「『【〔〈《〘〖［｛‘“([{");

/** Indices (UTF-16) where a line may break, i.e. the next line would start there. */
function breakOpportunities(text: string): number[] {
  const out: number[] = [];
  const chars = [...text];
  let offset = 0;
  for (let i = 0; i < chars.length; i++) {
    const cur = chars[i];
    const prev = chars[i - 1];
    if (i > 0 && !/\s/.test(cur)) {
      const afterSpace = /\s/.test(prev);
      const cjk = CJK.test(cur) || CJK.test(prev);
      const afterHyphen = prev === "-" && /\w/.test(cur);
      if ((afterSpace || cjk || afterHyphen) && !NO_START.has(cur) && !NO_END.has(prev)) {
        out.push(offset);
      }
    }
    offset += cur.length;
  }
  return out;
}

/**
 * Splits text into lines no wider than `maxWidth`: at "\n", then between words / CJK characters
 * (with basic Japanese kinsoku rules). Words wider than `maxWidth` are split by character.
 */
export function breakLines(text: string, style: TextStyle, maxWidth?: number): string[] {
  const hard = text.split("\n");
  if (maxWidth === undefined) {
    return hard;
  }
  const width = (s: string) => layoutLine(s.trimEnd(), style).width;
  const out: string[] = [];
  for (const para of hard) {
    let rest = para;
    while (rest && width(rest) > maxWidth) {
      const ops = breakOpportunities(rest);
      let cut = 0;
      for (const at of ops) {
        if (width(rest.slice(0, at)) <= maxWidth) {
          cut = at;
        } else {
          break;
        }
      }
      if (cut === 0) {
        // Nothing fits: emergency break by character.
        const chars = [...rest];
        let n = 1;
        while (n < chars.length && width(chars.slice(0, n + 1).join("")) <= maxWidth) {
          n++;
        }
        cut = chars.slice(0, n).join("").length;
      }
      out.push(rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).trimStart();
    }
    out.push(rest);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------

/** Rewrites fontkit's absolute M/L/Q/C/Z path as relative commands with 1-decimal precision. */
function compactPath(d: string): string {
  const q = (n: number) => Math.round(n * 10);
  const num = (t: number) => {
    const s = String(t / 10);
    return s.replace(/^(-?)0\./, "$1.");
  };
  let out = "";
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  for (const [, cmd, args] of d.matchAll(/([MLQCZ])([^MLQCZ]*)/g)) {
    if (cmd === "Z") {
      out += "z";
      cx = sx;
      cy = sy;
      continue;
    }
    const v = (args.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map((n) => q(parseFloat(n)));
    const parts: number[] = [];
    for (let i = 0; i < v.length; i += 2) {
      parts.push(v[i] - cx, v[i + 1] - cy);
    }
    cx = v[v.length - 2];
    cy = v[v.length - 1];
    if (cmd === "M") {
      sx = cx;
      sy = cy;
    }
    let body = "";
    let prev = "";
    for (const t of parts) {
      const s = num(t);
      // A separator is only needed when the next token couldn't be told apart from the previous one.
      const joinable = prev === "" || s.startsWith("-") || (s.startsWith(".") && prev.includes("."));
      body += joinable ? s : " " + s;
      prev = s;
    }
    out += cmd.toLowerCase() + body;
  }
  return out;
}

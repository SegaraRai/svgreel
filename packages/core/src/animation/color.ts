import { interpolate } from "./interpolate.js";

type RGBA = [number, number, number, number];

const NAMED: Record<string, RGBA> = {
  transparent: [0, 0, 0, 0],
  black: [0, 0, 0, 1],
  white: [255, 255, 255, 1],
  red: [255, 0, 0, 1],
  green: [0, 128, 0, 1],
  blue: [0, 0, 255, 1],
};

/** Parses #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() and hsl()/hsla() (comma or space syntax). */
export function parseColor(color: string): RGBA {
  const s = color.trim().toLowerCase();
  if (NAMED[s]) {
    return NAMED[s];
  }
  if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) {
      h = [...h].map((c) => c + c).join("");
    }
    if (h.length === 6) {
      h += "ff";
    }
    if (h.length === 8 && /^[0-9a-f]+$/.test(h)) {
      const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
      return [n(0), n(2), n(4), n(6) / 255];
    }
  }
  const fn = s.match(/^(rgba?|hsla?)\((.*)\)$/);
  if (fn) {
    const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
    const num = (p: string | undefined, scale: number, def: number) =>
      p === undefined ? def : p.endsWith("%") ? (parseFloat(p) / 100) * scale : parseFloat(p);
    if (fn[1].startsWith("rgb")) {
      return [num(parts[0], 255, 0), num(parts[1], 255, 0), num(parts[2], 255, 0), num(parts[3], 1, 1)];
    }
    const hue = parseFloat(parts[0]);
    const sat = num(parts[1], 1, 0);
    const light = num(parts[2], 1, 0);
    const k = (n: number) => (n + hue / 30) % 12;
    const a = sat * Math.min(light, 1 - light);
    const ch = (n: number) => 255 * (light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
    return [ch(0), ch(8), ch(4), num(parts[3], 1, 1)];
  }
  throw new Error(`Unsupported color "${color}" (use #hex, rgb(), rgba(), hsl() or hsla())`);
}

function format([r, g, b, a]: RGBA): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  return a >= 1 ? `rgb(${c(r)}, ${c(g)}, ${c(b)})` : `rgba(${c(r)}, ${c(g)}, ${c(b)}, ${Math.round(a * 1000) / 1000})`;
}

/** Mixes two colors: t = 0 → a, t = 1 → b. */
export function mixColors(a: string, b: string, t: number): string {
  const x = parseColor(a);
  const y = parseColor(b);
  return format(x.map((v, i) => v + (y[i] - v) * t) as RGBA);
}

/** Like interpolate(), but outputs colors. Input is clamped to the range. */
export function interpolateColors(input: number, inputRange: readonly number[], colors: readonly string[]): string {
  const parsed = colors.map(parseColor);
  const ch = (i: number) =>
    interpolate(
      input,
      inputRange,
      parsed.map((c) => c[i]),
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
  return format([ch(0), ch(1), ch(2), ch(3)]);
}

/** Same color with a different alpha (0..1). */
export function withAlpha(color: string, alpha: number): string {
  const [r, g, b] = parseColor(color);
  return format([r, g, b, alpha]);
}

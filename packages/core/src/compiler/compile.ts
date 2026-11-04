import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { resolveParams, type ParamValues } from "../params.js";
import { TimelineProvider, type Composition } from "../timeline.js";
import { isStill, type Variant } from "../variants.js";
import { buildKeyframes, fmt, normalizeValue, type Keyframe } from "./keyframes.js";
import { parseSvg, serialize, type ENode } from "./tree.js";

/** Properties that may differ between frames. Everything else must be static. */
const ANIMATABLE = new Set([
  "transform",
  "opacity",
  "visibility",
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-dashoffset",
  "stroke-dasharray",
  "stop-color",
  "stop-opacity",
  "color",
  "filter",
]);
const LENGTHS = new Set(["stroke-width", "stroke-dashoffset", "stroke-dasharray"]);

export interface CompileResult {
  svg: string;
  /** False for a still variant (motion "still"): one frame, no keyframes. */
  animated: boolean;
  /** The param values this variant was rendered with. */
  params: ParamValues;
  stats: {
    frames: number;
    elements: number;
    animatedElements: number;
    tracks: number;
    keyframes: number;
  };
}

const DEFAULT_VARIANT: Variant = { motion: "default" };

export function renderFrame(
  comp: Composition,
  frame: number,
  variant: Variant = DEFAULT_VARIANT,
  params: ParamValues = resolveParams(comp.params, variant),
): ENode {
  const markup = renderToStaticMarkup(
    createElement(
      TimelineProvider,
      {
        frame,
        config: comp,
        variant,
        params,
      },
      createElement(comp.component),
    ),
  );
  return parseSvg(markup);
}

/**
 * Compiles one variant, which the component reads with `useVariant()`. A still variant is frame
 * `stillFrame` without animation; anything else renders every frame and animates the changes.
 * `overrides` replace param defaults (see `resolveParams`).
 */
export function compile(
  comp: Composition,
  variant: Variant = DEFAULT_VARIANT,
  overrides: ParamValues = {},
): CompileResult {
  const params = resolveParams(comp.params, variant, overrides);
  const n = comp.durationInFrames;
  const stillIndex = Math.min(Math.max(comp.stillFrame ?? n - 1, 0), n - 1);
  if (isStill(variant)) {
    return {
      svg: finish(renderFrame(comp, stillIndex, variant, params), comp, variant, ""),
      animated: false,
      params,
      stats: { frames: 1, elements: 0, animatedElements: 0, tracks: 0, keyframes: 0 },
    };
  }

  // Frames are folded into one tree as they render, so only one frame is held at a time.
  const acc = start(renderFrame(comp, 0, variant, params), "svg", false);
  for (let f = 1; f < n; f++) {
    add(acc, renderFrame(comp, f, variant, params), f);
  }

  const ctx: Ctx = {
    css: [],
    kfNames: new Map(),
    nextClass: 0,
    stillIndex,
    stats: {
      elements: 0,
      animatedElements: 0,
      tracks: 0,
      keyframes: 0,
    },
  };
  const root = merge(acc, ctx);

  const dur = `${fmt(n / comp.fps)}s`;
  const css =
    `.m{animation-duration:${dur};animation-timing-function:linear;animation-iteration-count:infinite}` +
    // .o: inside data-once, plays once and holds its final state.
    `.o{animation-duration:${dur};animation-timing-function:linear;animation-fill-mode:both}` +
    `@media (prefers-reduced-motion:reduce){.m,.o{animation:none}}` +
    ctx.css.join("");

  return {
    svg: finish(root, comp, variant, css),
    animated: true,
    params,
    stats: {
      frames: n,
      ...ctx.stats,
      keyframes: ctx.stats.keyframes,
    },
  };
}

interface Ctx {
  css: string[];
  /** keyframes body -> name, so identical animations share one @keyframes */
  kfNames: Map<string, string>;
  nextClass: number;
  stillIndex: number;
  stats: {
    elements: number;
    animatedElements: number;
    tracks: number;
    keyframes: number;
  };
}

/** One property of an element across the frames added so far. */
interface Track {
  name: string;
  isStyle: boolean;
  /** The value while every frame so far had the same one. */
  value: string | undefined;
  /** Per-frame CSS values (cssValue), once they differ (undefined: missing on that frame). */
  values: (string | undefined)[] | undefined;
}

/** An element across the frames added so far: frame 0's structure plus the tracks of its properties. */
interface Acc {
  tag: string;
  path: string;
  once: boolean;
  /** In first-seen order: frame 0's attributes and styles, then ones that appear later. */
  tracks: Map<string, Track>;
  children: (Acc | string)[];
}

function start(node: ENode, path: string, inheritedOnce: boolean): Acc {
  const once = inheritedOnce || node.attrs.has("data-once");
  const tracks = new Map<string, Track>();
  for (const [name, value] of node.attrs) {
    tracks.set(`a:${name}`, { name, isStyle: false, value, values: undefined });
  }
  for (const [name, value] of node.style) {
    tracks.set(`s:${name}`, { name, isStyle: true, value, values: undefined });
  }
  return {
    tag: node.tag,
    path,
    once,
    tracks,
    children: node.children.map((c, i) => (typeof c === "string" ? c : start(c, `${path}>${c.tag}[${i}]`, once))),
  };
}

function record(t: Track, v: string | undefined, frame: number) {
  if (t.values) {
    t.values.push(v === undefined ? v : cssValue(t.name, v));
  } else if (v !== t.value) {
    const first = t.value === undefined ? undefined : cssValue(t.name, t.value);
    t.values = Array.from({ length: frame }, () => first);
    t.values.push(v === undefined ? v : cssValue(t.name, v));
  }
}

function treeChanged(acc: Acc, node: ENode | string): Error {
  const tag = typeof node === "string" ? undefined : node.tag;
  const count = typeof node === "string" ? undefined : node.children.length;
  return new Error(
    `Element tree changes between frames at ${acc.path} (<${acc.tag}> with ${acc.children.length} children vs ` +
      `<${tag}> with ${count}). Render elements on every frame and hide them with opacity/visibility (or <Sequence>) instead.`,
  );
}

/** Adds frame `frame` (1 or later) of the element to its accumulated tracks. */
function add(acc: Acc, node: ENode, frame: number) {
  if (node.tag !== acc.tag || node.children.length !== acc.children.length) {
    throw treeChanged(acc, node);
  }
  let seen = 0;
  for (const t of acc.tracks.values()) {
    const v = (t.isStyle ? node.style : node.attrs).get(t.name);
    if (v !== undefined) {
      seen++;
    }
    record(t, v, frame);
  }
  if (seen < node.attrs.size + node.style.size) {
    for (const [isStyle, map] of [
      [false, node.attrs],
      [true, node.style],
    ] as const) {
      for (const [name, value] of map) {
        const key = `${isStyle ? "s" : "a"}:${name}`;
        if (!acc.tracks.has(key)) {
          const values: (string | undefined)[] = Array.from({ length: frame }, () => undefined);
          values.push(cssValue(name, value));
          acc.tracks.set(key, { name, isStyle, value: undefined, values });
        }
      }
    }
  }
  acc.children.forEach((c, i) => {
    const child = node.children[i];
    if (typeof c === "string") {
      if (child !== c) {
        throw new Error(
          `Text content changes between frames at ${acc.path}. Use <Text> (outlined glyphs) and animate visibility instead.`,
        );
      }
    } else if (typeof child === "string") {
      throw treeChanged(c, child);
    } else {
      add(c, child, frame);
    }
  });
}

/** Turns an element's tracks into one static element plus CSS animations. */
function merge(acc: Acc, ctx: Ctx): ENode {
  const { path, once } = acc;
  ctx.stats.elements++;

  const out: ENode = {
    tag: acc.tag,
    attrs: new Map(),
    style: new Map(),
    children: [],
  };
  const animations: string[] = [];

  for (const { name, isStyle, value, values: raw } of acc.tracks.values()) {
    if (!raw) {
      (isStyle ? out.style : out.attrs).set(name, value!);
      continue;
    }
    // A property animated as CSS can't also be set as an attribute on another frame.
    if (!ANIMATABLE.has(name)) {
      throw new Error(
        `"${name}" changes between frames at ${path} <${acc.tag}>, but only these can animate: ${[...ANIMATABLE].join(", ")}`,
      );
    }
    if (!isStyle && name === "transform") {
      throw new Error(
        `The transform attribute changes between frames at ${path}. Use style={{transform: "..."}} (CSS syntax with units) instead.`,
      );
    }
    const missing = raw.findIndex((v) => v === undefined);
    if (missing >= 0) {
      throw new Error(`"${name}" at ${path} <${acc.tag}> is missing on frame ${missing}; set it on every frame.`);
    }
    const values = raw as string[];
    const kfs = buildKeyframes(values);
    animations.push(keyframesRule(name, kfs, ctx));
    // Static value (shown under reduced motion): once-animations rest at their end state.
    out.style.set(name, values[once ? values.length - 1 : ctx.stillIndex]);
    out.attrs.delete(name);
    ctx.stats.tracks++;
  }

  out.attrs.delete("data-once");
  if (animations.length) {
    if (out.attrs.has("transform") && out.style.has("transform")) {
      throw new Error(
        `${path} <${acc.tag}> has both a transform attribute and an animated CSS transform; wrap it in a <g>.`,
      );
    }
    const cls = `a${(ctx.nextClass++).toString(36)}`;
    ctx.css.push(`.${cls}{animation-name:${animations.join(",")}}`);
    const prev = out.attrs.get("class");
    const mode = once ? "o" : "m";
    out.attrs.set("class", prev ? `${prev} ${mode} ${cls}` : `${mode} ${cls}`);
    ctx.stats.animatedElements++;
  }

  for (const c of acc.children) {
    out.children.push(typeof c === "string" ? c : merge(c, ctx));
  }
  return out;
}

function cssValue(name: string, v: string): string {
  let s = normalizeValue(v);
  if (LENGTHS.has(name)) {
    s = s.replace(/(^|[\s,])(-?[\d.]+)(?=$|[\s,])/g, "$1$2px");
  }
  // A value sliced out of the frame's markup would keep all of it (~hundreds of KB) alive for
  // the rest of the compile; this makes a copy of its own.
  return s === v && s.length > 12 ? (s + " ").slice(0, -1) : s;
}

function keyframesRule(prop: string, kfs: Keyframe[], ctx: Ctx): string {
  const body = kfs
    .map((k) => `${fmt(k.t * 100)}%{${prop}:${k.value}${k.step ? ";animation-timing-function:steps(1,end)" : ""}}`)
    .join("");
  let name = ctx.kfNames.get(body);
  if (!name) {
    name = `k${ctx.kfNames.size.toString(36)}`;
    ctx.kfNames.set(body, name);
    ctx.css.push(`@keyframes ${name}{${body}}`);
    ctx.stats.keyframes += kfs.length;
  }
  return name;
}

const CREDIT = "<!-- Built with svgreel: https://github.com/SegaraRai/svgreel -->";

/** Adds xmlns/a11y/<style>, and moves repeated outlines and images into <defs> referenced by <use>. */
function finish(root: ENode, comp: Composition, variant: Variant, css: string): string {
  const svg: ENode = {
    ...root,
    attrs: new Map(root.attrs),
    children: [...root.children],
  };
  svg.attrs.set("xmlns", "http://www.w3.org/2000/svg");
  if (!svg.attrs.has("viewBox")) {
    svg.attrs.set("viewBox", `0 0 ${comp.width} ${comp.height}`);
  }
  svg.attrs.set("width", String(comp.width));
  svg.attrs.set("height", String(comp.height));
  if (variant.lang) {
    svg.attrs.set("lang", variant.lang);
  }
  if (comp.title) {
    svg.attrs.set("role", "img");
    svg.attrs.set("aria-label", comp.title);
  }

  walk(svg, (n) => {
    const href = n.attrs.get("href") ?? n.attrs.get("xlink:href");
    if ((n.tag === "image" || n.tag === "feImage") && href && !href.startsWith("data:") && !href.startsWith("#")) {
      throw new Error(
        `<${n.tag} href="${href.slice(0, 80)}"> won't load: SVGs shown as images can't fetch files. ` +
          "Use <Image src> (a file path, or await fetchImage(url) for a URL) to embed it.",
      );
    }
  });
  const defs = [...dedupePaths(svg), ...dedupeImages(svg)];
  const head: ENode[] = [];
  if (comp.title) {
    head.push({
      tag: "title",
      attrs: new Map(),
      style: new Map(),
      children: [comp.title],
    });
  }
  if (css) {
    head.push({
      tag: "style",
      attrs: new Map(),
      style: new Map(),
      children: [css],
    });
  }
  if (defs.length) {
    head.push({
      tag: "defs",
      attrs: new Map(),
      style: new Map(),
      children: defs,
    });
  }
  // Line breaks after the opening tag, the comment and </style>, and before the closing tag keep
  // the file readable.
  const open = serialize({ ...svg, children: [] }).slice(0, -2);
  const body = [...head, ...svg.children]
    .map((c) => serialize(c) + (typeof c !== "string" && c.tag === "style" ? "\n" : ""))
    .join("");
  return `${open}>\n${CREDIT}\n${body}\n</${svg.tag}>`;
}

function walk(n: ENode, fn: (n: ENode) => void) {
  fn(n);
  for (const c of n.children) {
    if (typeof c !== "string") {
      walk(c, fn);
    }
  }
}

/**
 * Embedded images (data: URIs) used more than once with the same size are stored once: the
 * <image> moves into <defs> at (0, 0) and each use becomes a <use x y> carrying the rest.
 */
function dedupeImages(root: ENode): ENode[] {
  const MOVED = ["href", "width", "height", "preserveAspectRatio"];
  const keyOf = (n: ENode) => {
    const href = n.attrs.get("href");
    if (
      n.tag !== "image" ||
      n.attrs.has("id") ||
      !href?.startsWith("data:") ||
      !n.attrs.has("width") ||
      !n.attrs.has("height") ||
      ["x", "y", "width", "height"].some((k) => n.style.has(k))
    ) {
      return undefined;
    }
    return MOVED.map((k) => n.attrs.get(k) ?? "").join("\n");
  };
  const counts = new Map<string, number>();
  walk(root, (n) => {
    const key = keyOf(n);
    if (key) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  });
  const ids = new Map<string, string>();
  const defs: ENode[] = [];
  walk(root, (n) => {
    const key = keyOf(n);
    if (!key || counts.get(key)! < 2) {
      return;
    }
    let id = ids.get(key);
    if (!id) {
      id = `i${ids.size.toString(36)}`;
      ids.set(key, id);
      const attrs = new Map([["id", id]]);
      for (const k of MOVED) {
        const v = n.attrs.get(k);
        if (v !== undefined) {
          attrs.set(k, v);
        }
      }
      defs.push({
        tag: "image",
        attrs,
        style: new Map(),
        children: [],
      });
    }
    n.tag = "use";
    const rest = [...n.attrs].filter(([k]) => !MOVED.includes(k));
    n.attrs = new Map([["href", `#${id}`], ...rest]);
  });
  return defs;
}

function dedupePaths(root: ENode): ENode[] {
  const counts = new Map<string, number>();
  // pathLength only works on the <path> itself (a <use> ignores it), so normalised dashes such as
  // <DrawPath>'s keep their own copy of the outline.
  const shareable = (n: ENode) => n.tag === "path" && !n.attrs.has("id") && !n.attrs.has("pathLength");
  walk(root, (n) => {
    const d = shareable(n) ? n.attrs.get("d") : undefined;
    if (d && d.length > 40) {
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  });
  const ids = new Map<string, string>();
  const defs: ENode[] = [];
  for (const [d, c] of counts) {
    if (c < 2) {
      continue;
    }
    const id = `p${ids.size.toString(36)}`;
    ids.set(d, id);
    defs.push({
      tag: "path",
      attrs: new Map([
        ["id", id],
        ["d", d],
      ]),
      style: new Map(),
      children: [],
    });
  }
  walk(root, (n) => {
    const id = shareable(n) ? ids.get(n.attrs.get("d") ?? "") : undefined;
    if (!id) {
      return;
    }
    n.tag = "use";
    n.attrs.delete("d");
    n.attrs = new Map([["href", `#${id}`], ...n.attrs]);
  });
  return defs;
}

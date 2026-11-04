import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
  stats: {
    frames: number;
    elements: number;
    animatedElements: number;
    tracks: number;
    keyframes: number;
  };
}

const DEFAULT_VARIANT: Variant = { motion: "default" };

export function renderFrame(comp: Composition, frame: number, variant: Variant = DEFAULT_VARIANT): ENode {
  const markup = renderToStaticMarkup(
    createElement(
      TimelineProvider,
      {
        frame,
        config: comp,
        variant,
      },
      createElement(comp.component),
    ),
  );
  return parseSvg(markup);
}

/**
 * Compiles one variant, which the component reads with `useVariant()`. A still variant is frame
 * `stillFrame` without animation; anything else renders every frame and animates the changes.
 */
export function compile(comp: Composition, variant: Variant = DEFAULT_VARIANT): CompileResult {
  const n = comp.durationInFrames;
  const stillIndex = Math.min(Math.max(comp.stillFrame ?? n - 1, 0), n - 1);
  if (isStill(variant)) {
    return {
      svg: finish(renderFrame(comp, stillIndex, variant), comp, variant, ""),
      animated: false,
      stats: { frames: 1, elements: 0, animatedElements: 0, tracks: 0, keyframes: 0 },
    };
  }

  const frames: ENode[] = [];
  for (let f = 0; f < n; f++) {
    frames.push(renderFrame(comp, f, variant));
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
  const root = merge(frames, "svg", ctx, false);

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

/** Merges the same element across all frames into one static element plus CSS animations. */
function merge(nodes: ENode[], path: string, ctx: Ctx, inheritedOnce: boolean): ENode {
  const first = nodes[0];
  const once = inheritedOnce || first.attrs.has("data-once");
  ctx.stats.elements++;
  for (const nd of nodes) {
    if (nd.tag !== first.tag || nd.children.length !== first.children.length) {
      throw new Error(
        `Element tree changes between frames at ${path} (<${first.tag}> with ${first.children.length} children vs ` +
          `<${nd.tag}> with ${nd.children.length}). Render elements on every frame and hide them with opacity/visibility (or <Sequence>) instead.`,
      );
    }
  }

  const out: ENode = {
    tag: first.tag,
    attrs: new Map(),
    style: new Map(),
    children: [],
  };
  const animations: string[] = [];

  const keys = new Set<string>();
  for (const nd of nodes) {
    for (const k of nd.attrs.keys()) {
      keys.add(`a:${k}`);
    }
    for (const k of nd.style.keys()) {
      keys.add(`s:${k}`);
    }
  }

  for (const key of keys) {
    const isStyle = key.startsWith("s:");
    const name = key.slice(2);
    const raw = nodes.map((nd) => (isStyle ? nd.style : nd.attrs).get(name));
    const same = raw.every((v) => v === raw[0]);
    if (same) {
      (isStyle ? out.style : out.attrs).set(name, raw[0]!);
      continue;
    }
    // A property animated as CSS can't also be set as an attribute on another frame.
    if (!ANIMATABLE.has(name)) {
      throw new Error(
        `"${name}" changes between frames at ${path} <${first.tag}>, but only these can animate: ${[...ANIMATABLE].join(", ")}`,
      );
    }
    if (!isStyle && name === "transform") {
      throw new Error(
        `The transform attribute changes between frames at ${path}. Use style={{transform: "..."}} (CSS syntax with units) instead.`,
      );
    }
    const missing = raw.findIndex((v) => v === undefined);
    if (missing >= 0) {
      throw new Error(`"${name}" at ${path} <${first.tag}> is missing on frame ${missing}; set it on every frame.`);
    }
    const values = raw.map((v) => cssValue(name, v!));
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
        `${path} <${first.tag}> has both a transform attribute and an animated CSS transform; wrap it in a <g>.`,
      );
    }
    const cls = `a${(ctx.nextClass++).toString(36)}`;
    ctx.css.push(`.${cls}{animation-name:${animations.join(",")}}`);
    const prev = out.attrs.get("class");
    const mode = once ? "o" : "m";
    out.attrs.set("class", prev ? `${prev} ${mode} ${cls}` : `${mode} ${cls}`);
    ctx.stats.animatedElements++;
  }

  first.children.forEach((c, i) => {
    if (typeof c === "string") {
      if (nodes.some((nd) => nd.children[i] !== c)) {
        throw new Error(
          `Text content changes between frames at ${path}. Use <Text> (outlined glyphs) and animate visibility instead.`,
        );
      }
      out.children.push(c);
    } else {
      out.children.push(
        merge(
          nodes.map((nd) => nd.children[i] as ENode),
          `${path}>${c.tag}[${i}]`,
          ctx,
          once,
        ),
      );
    }
  });
  return out;
}

function cssValue(name: string, v: string): string {
  let s = normalizeValue(v);
  if (LENGTHS.has(name)) {
    s = s.replace(/(^|[\s,])(-?[\d.]+)(?=$|[\s,])/g, "$1$2px");
  }
  return s;
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
  svg.children = [...head, ...svg.children];
  return serialize(svg);
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

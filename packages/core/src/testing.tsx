/** Helpers for component tests (not exported from the package). */
import { isTag, type Element } from "domhandler";
import { parseDocument } from "htmlparser2";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TimelineProvider, type VideoConfig } from "./timeline.js";

const CONFIG: VideoConfig = { width: 800, height: 400, fps: 30, durationInFrames: 120 };

/** Renders `node` at `frame` and returns the root elements of the markup. */
export function render(node: ReactNode, { frame = 0, config = CONFIG }: { frame?: number; config?: VideoConfig } = {}) {
  const markup = renderToStaticMarkup(
    <TimelineProvider frame={frame} config={config}>
      {node}
    </TimelineProvider>,
  );
  return parseDocument(markup).children.filter(isTag);
}

/** Every element named `tag` under (and including) `roots`, in document order. */
export function all(roots: Element | Element[], tag: string): Element[] {
  const out: Element[] = [];
  const walk = (el: Element) => {
    if (el.name === tag) {
      out.push(el);
    }
    el.children.filter(isTag).forEach(walk);
  };
  (Array.isArray(roots) ? roots : [roots]).forEach(walk);
  return out;
}

/** The inline `style` attribute as a property → value map. */
export function styleOf(el: Element): Record<string, string> {
  return Object.fromEntries(
    (el.attribs.style ?? "")
      .split(";")
      .filter(Boolean)
      .map((d) => {
        const i = d.indexOf(":");
        return [d.slice(0, i).trim(), d.slice(i + 1).trim()];
      }),
  );
}

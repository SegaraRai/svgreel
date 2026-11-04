import { parseDocument } from "htmlparser2";
import type { ChildNode, Element } from "domhandler";

/** A rendered SVG element, with `style` split out of the attributes. */
export interface ENode {
  tag: string;
  attrs: Map<string, string>;
  style: Map<string, string>;
  children: (ENode | string)[];
}

export function parseSvg(markup: string): ENode {
  const doc = parseDocument(markup, {
    xmlMode: true,
    decodeEntities: true,
  });
  const root = doc.children.find((c): c is Element => c.type === "tag");
  if (root?.name !== "svg") {
    throw new Error("Composition must render a single root <svg>");
  }
  return convert(root);
}

function convert(el: Element): ENode {
  const attrs = new Map<string, string>();
  let style = new Map<string, string>();
  for (const [k, v] of Object.entries(el.attribs)) {
    if (k === "style") {
      style = parseStyle(v);
    } else {
      attrs.set(k, v);
    }
  }
  const children: (ENode | string)[] = [];
  for (const c of el.children as ChildNode[]) {
    if (c.type === "tag") {
      children.push(convert(c as Element));
    } else if (c.type === "text" && c.data.trim() !== "") {
      children.push(c.data);
    }
  }
  return {
    tag: el.name,
    attrs,
    style,
    children,
  };
}

export function parseStyle(s: string): Map<string, string> {
  const out = new Map<string, string>();
  let depth = 0;
  let start = 0;
  const push = (decl: string) => {
    const i = decl.indexOf(":");
    if (i > 0) {
      out.set(decl.slice(0, i).trim(), decl.slice(i + 1).trim());
    }
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
    } else if (ch === ";" && depth === 0) {
      push(s.slice(start, i));
      start = i + 1;
    }
  }
  push(s.slice(start));
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export function serialize(n: ENode | string): string {
  if (typeof n === "string") {
    return esc(n);
  }
  let a = "";
  for (const [k, v] of n.attrs) {
    a += ` ${k}="${esc(v)}"`;
  }
  if (n.style.size) {
    a += ` style="${esc([...n.style].map(([k, v]) => `${k}:${v}`).join(";"))}"`;
  }
  if (n.children.length === 0) {
    return `<${n.tag}${a}/>`;
  }
  return `<${n.tag}${a}>${n.children.map(serialize).join("")}</${n.tag}>`;
}

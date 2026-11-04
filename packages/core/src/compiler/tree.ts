import { parseDocument } from "htmlparser2";
import type { ChildNode, Element } from "domhandler";

/** A rendered SVG element, with `style` split out of the attributes. */
export interface ENode {
  tag: string;
  attrs: Map<string, string>;
  style: Map<string, string>;
  children: (ENode | string)[];
}

/**
 * Parses one rendered frame. React's static markup is regular (attributes always double-quoted,
 * `"&'<>` escaped, no comments), so a scanner made for it does the job several times faster than
 * htmlparser2; markup it doesn't expect (raw text in <style>/<script>, comments, CDATA) goes to
 * htmlparser2. Both produce the same tree.
 */
export function parseSvg(markup: string): ENode {
  return scan(markup) ?? parseSlow(markup);
}

/** Elements whose text htmlparser2 might treat as raw text. */
const RAW_TEXT = new Set(["style", "script"]);

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** XML entities and character references, as htmlparser2 decodes them in xmlMode. */
function decode(s: string): string {
  if (!s.includes("&")) {
    return s;
  }
  return s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (m, hex?: string, dec?: string, name?: string) => {
    if (name !== undefined) {
      return ENTITIES[name] ?? m;
    }
    const cp = hex !== undefined ? parseInt(hex, 16) : Number(dec);
    return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
  });
}

const LT = 60;
const GT = 62;
const SLASH = 47;
const SPACE = 32;
const BANG = 33;
const QUESTION = 63;

/** The fast path of parseSvg; undefined when the markup isn't shaped as expected. */
function scan(s: string): ENode | undefined {
  const stack: ENode[] = [];
  let root: ENode | undefined;
  let i = 0;
  const n = s.length;
  while (i < n) {
    const lt = s.indexOf("<", i);
    if (lt < 0) {
      break;
    }
    if (lt > i && stack.length) {
      const text = s.slice(i, lt);
      if (text.trim() !== "") {
        stack[stack.length - 1].children.push(decode(text));
      }
    }
    const first = s.charCodeAt(lt + 1);
    if (first === SLASH) {
      const open = stack.pop();
      const end = lt + 2 + (open?.tag.length ?? 0);
      if (!open || !s.startsWith(open.tag, lt + 2) || s.charCodeAt(end) !== GT) {
        return undefined;
      }
      i = end + 1;
      continue;
    }
    // Comments, CDATA and processing instructions.
    if (first === BANG || first === QUESTION) {
      return undefined;
    }
    let j = lt + 1;
    while (j < n) {
      const ch = s.charCodeAt(j);
      if (ch === SPACE || ch === GT || ch === SLASH || ch === LT) {
        break;
      }
      j++;
    }
    const node: ENode = { tag: s.slice(lt + 1, j), attrs: new Map(), style: new Map(), children: [] };
    if (!node.tag || RAW_TEXT.has(node.tag)) {
      return undefined;
    }
    let selfClosing = false;
    for (;;) {
      while (s.charCodeAt(j) === SPACE) {
        j++;
      }
      const ch = s.charCodeAt(j);
      if (ch === GT) {
        j++;
        break;
      }
      if (ch === SLASH) {
        if (s.charCodeAt(j + 1) !== GT) {
          return undefined;
        }
        j += 2;
        selfClosing = true;
        break;
      }
      const eq = s.indexOf("=", j);
      if (eq < 0 || s.charCodeAt(eq + 1) !== 34) {
        return undefined;
      }
      const q = s.indexOf('"', eq + 2);
      if (q < 0) {
        return undefined;
      }
      const name = s.slice(j, eq);
      if (name.includes(" ") || name.includes("<") || name.includes(">")) {
        return undefined;
      }
      const value = decode(s.slice(eq + 2, q));
      if (name === "style") {
        node.style = parseStyle(value);
      } else {
        node.attrs.set(name, value);
      }
      j = q + 1;
    }
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else if (root) {
      return undefined;
    } else {
      root = node;
    }
    if (!selfClosing) {
      stack.push(node);
    }
    i = j;
  }
  if (stack.length || s.slice(i).trim() !== "" || root?.tag !== "svg") {
    return undefined;
  }
  return root;
}

/** parseSvg through htmlparser2. Exported for tests. */
export function parseSlow(markup: string): ENode {
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

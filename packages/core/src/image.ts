import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Above this many bytes, the build warns that the image bloats the SVG. */
const LARGE_IMAGE = 150 * 1024;

const cache = new Map<string, string>();
const fetched = new Map<string, Promise<string>>();
const warned = new Set<string>();

function warnLarge(label: string, bytes: number) {
  if (bytes <= LARGE_IMAGE || warned.has(label)) {
    return;
  }
  warned.add(label);
  console.warn(
    `[svgreel] Image ${label} is ${Math.round(bytes / 1024)} KB and is embedded in every output file. ` +
      "Scale it down to about twice its displayed size, or compress it (WebP, JPEG).",
  );
}

const EXTENSIONS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

/** The MIME type from the file's first bytes, or undefined. */
function sniff(b: Uint8Array): string | undefined {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") {
    return "image/png";
  }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }
  if (ascii(0, 4) === "GIF8") {
    return "image/gif";
  }
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return "image/webp";
  }
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) {
    return "image/avif";
  }
  if (/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/.test(ascii(0, Math.min(b.length, 512)))) {
    return "image/svg+xml";
  }
  return undefined;
}

function toDataUri(bytes: Uint8Array, type: string): string {
  return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
}

/**
 * An image as a `data:` URI, for `<Image src>` or a raw `<image href>`. SVG images loaded by
 * `<img>` (READMEs, websites) can't fetch anything, so every image has to be embedded.
 *
 *   loadImage("images/avatar.png")                          // relative to the project root
 *   loadImage(new URL("./avatar.png", import.meta.url))     // relative to the composition
 *   loadImage("data:image/png;base64,…")                    // returned as is
 *
 * PNG, JPEG, GIF, WebP, AVIF and SVG files work. The result is cached per file.
 */
export function loadImage(src: string | URL): string {
  if (typeof src === "string" && /^data:/i.test(src)) {
    if (!/^data:image\//i.test(src)) {
      throw new Error(`Image data URIs must have an image/* type: ${src.slice(0, 40)}…`);
    }
    return src;
  }
  if (typeof src === "string" ? /^https?:/i.test(src) : src.protocol !== "file:") {
    throw new Error(
      `Can't load ${String(src)} while rendering: SVGs shown as images can't fetch it either. ` +
        "Download it at build time with `const avatar = await fetchImage(url)` at the top of the module, and pass that.",
    );
  }
  const file = typeof src === "string" ? path.resolve(src) : fileURLToPath(src);
  const hit = cache.get(file);
  if (hit) {
    return hit;
  }
  if (!fs.existsSync(file)) {
    throw new Error(`Image file not found: ${String(src)} (paths are relative to the project root)`);
  }
  const bytes = fs.readFileSync(file);
  const type = sniff(bytes) ?? EXTENSIONS[path.extname(file).toLowerCase()];
  if (!type) {
    throw new Error(`${String(src)} isn't a PNG, JPEG, GIF, WebP, AVIF or SVG image`);
  }
  warnLarge(String(src), bytes.length);
  const uri = toDataUri(bytes, type);
  cache.set(file, uri);
  return uri;
}

/**
 * Downloads an image at build time and returns it as a `data:` URI. Await it at the top of the
 * composition module:
 *
 *   const avatar = await fetchImage("https://github.com/octocat.png?size=192");
 *   // … <Image src={avatar} width={96} height={96} radius={48} />
 *
 * Each URL is fetched once per build. Ask the server for a small size where it can (GitHub
 * avatars take `?size=`): the image is embedded as is.
 */
export function fetchImage(url: string | URL, init?: RequestInit): Promise<string> {
  const key = String(url);
  let p = fetched.get(key);
  if (!p) {
    p = (async () => {
      const res = await fetch(url, init);
      if (!res.ok) {
        throw new Error(`fetchImage: ${key} returned ${res.status}`);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const header = res.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
      const type = sniff(bytes) ?? (header?.startsWith("image/") ? header : undefined);
      if (!type) {
        throw new Error(`fetchImage: ${key} isn't an image (content-type: ${header ?? "none"})`);
      }
      warnLarge(key, bytes.length);
      return toDataUri(bytes, type);
    })();
    // A failed download can be retried (e.g. in a long-running preview).
    p.catch(() => fetched.delete(key));
    fetched.set(key, p);
  }
  return p;
}

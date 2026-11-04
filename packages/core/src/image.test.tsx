import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { compile } from "./compiler/compile.js";
import { Image } from "./components/Image.js";
import { fetchImage, loadImage } from "./image.js";
import { defineComposition, useCurrentFrame } from "./timeline.js";

// A 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const PNG_URI = `data:image/png;base64,${PNG.toString("base64")}`;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svgreel-image-"));
const file = (name: string, bytes: Uint8Array | string) => {
  const p = path.join(dir, name);
  fs.writeFileSync(p, bytes);
  return p;
};

describe("loadImage", () => {
  it("embeds files by their content type, from paths and file URLs", () => {
    // The extension is wrong on purpose: the bytes decide.
    const p = file("avatar.jpg", PNG);
    expect(loadImage(p)).toBe(PNG_URI);
    expect(loadImage(pathToFileURL(p))).toBe(PNG_URI);
    expect(loadImage(file("a.jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])))).toMatch(/^data:image\/jpeg;base64,/);
    expect(loadImage(file("icon.svg", '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"/>'))).toMatch(
      /^data:image\/svg\+xml;base64,/,
    );
  });

  it("passes image data URIs through and rejects what can't be embedded", () => {
    expect(loadImage(PNG_URI)).toBe(PNG_URI);
    expect(() => loadImage("data:text/html,<p>")).toThrow(/image\/\* type/);
    expect(() => loadImage("https://github.com/octocat.png")).toThrow(/fetchImage/);
    expect(() => loadImage(path.join(dir, "missing.png"))).toThrow(/not found/);
    expect(() => loadImage(file("notes.txt", "hello"))).toThrow(/isn't a PNG/);
  });
});

describe("fetchImage", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("downloads once per URL and returns a data URI", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response(PNG, { headers: { "content-type": "application/octet-stream" } });
    };
    const url = "https://example.test/avatar.png?size=64";
    expect(await fetchImage(url)).toBe(PNG_URI);
    expect(await fetchImage(url)).toBe(PNG_URI);
    expect(calls).toBe(1);
  });

  it("fails on HTTP errors and non-images, and retries after a failure", async () => {
    globalThis.fetch = async () => new Response("nope", { status: 404 });
    await expect(fetchImage("https://example.test/gone.png")).rejects.toThrow(/404/);
    globalThis.fetch = async () => new Response("<p>hi</p>", { headers: { "content-type": "text/html" } });
    await expect(fetchImage("https://example.test/page")).rejects.toThrow(/isn't an image/);
    globalThis.fetch = async () => new Response(PNG);
    expect(await fetchImage("https://example.test/gone.png")).toBe(PNG_URI);
  });
});

describe("<Image>", () => {
  // Compiled rather than rendered: the HTML-mode test parser turns <image> into <img>.
  const markup = (node: ReactNode) =>
    compile(
      defineComposition({
        component: () => <svg>{node}</svg>,
        width: 100,
        height: 100,
        fps: 30,
        durationInFrames: 1,
      }),
    ).svg;

  it("clips to a rounded rectangle and maps fit to preserveAspectRatio", () => {
    const svg = markup(<Image src={PNG_URI} x={10} y={20} width={64} height={64} radius={99} fit="contain" />);
    const id = svg.match(/<clipPath id="([^"]+)"><rect x="10" y="20" width="64" height="64" rx="32"\/>/)?.[1];
    expect(id).toBeTruthy();
    expect(svg).toContain(
      `<image href="${PNG_URI}" x="10" y="20" width="64" height="64" preserveAspectRatio="xMidYMid meet" clip-path="url(#${id})"/>`,
    );
  });

  it("has no clip without a radius", () => {
    const svg = markup(<Image src={PNG_URI} width={10} height={10} />);
    expect(svg).not.toContain("clipPath");
    expect(svg).toContain('preserveAspectRatio="xMidYMid slice"');
  });
});

describe("compile: images", () => {
  it("animates the wrapper and stores an image used twice only once", () => {
    const comp = defineComposition({
      component: () => {
        const frame = useCurrentFrame();
        return (
          <svg viewBox="0 0 200 100">
            <Image src={PNG_URI} x={0} width={80} height={80} radius={40} style={{ opacity: frame / 9 }} />
            <Image src={PNG_URI} x={100} width={80} height={80} radius={40} />
            <Image src={PNG_URI} x={0} width={20} height={20} />
          </svg>
        );
      },
      width: 200,
      height: 100,
      fps: 30,
      durationInFrames: 10,
    });
    const svg = compile(comp).svg;
    expect(svg.split(PNG.toString("base64"))).toHaveLength(3); // the shared 80×80 one + the 20×20 one
    expect(svg).toMatch(/<defs><image id="i0" href="data:image\/png;base64,[^"]+" width="80" height="80"/);
    expect(svg.match(/<use href="#i0" x="(\d+)"/g)).toEqual(['<use href="#i0" x="0"', '<use href="#i0" x="100"']);
    expect(svg).toMatch(/<g class="m a0" style="opacity:1">/);
  });

  it("fails on an image that would have to be fetched", () => {
    const comp = defineComposition({
      component: () => (
        <svg>
          <image href="https://github.com/octocat.png" width={10} height={10} />
        </svg>
      ),
      width: 10,
      height: 10,
      fps: 30,
      durationInFrames: 1,
    });
    expect(() => compile(comp)).toThrow(/fetchImage/);
  });
});

#!/usr/bin/env node
/**
 * svgreel CLI. Run from a project root:
 *
 *   svgreel build                 # every composition in compositions/
 *   svgreel build profile demo    # only these
 *   svgreel build --watch [names] # rebuild on change (dist/index.html refreshes itself)
 *
 * Output: dist/<name>/<name>[-<value>...].svg (+ .still.svg), dist/index.html (preview).
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { register } from "tsx/esm/api";

import { compile } from "../compiler/compile.js";
import { registerFonts } from "../fonts.js";
import type { Composition } from "../timeline.js";
import { expandVariants, normalizeAxes, variantFileName, type Variant } from "../variants.js";

const HELP = `Usage: svgreel build [names...] [options]

Builds compositions/<name>/index.tsx into <out>/<name>/*.svg and writes <out>/index.html,
a preview page that works when opened straight from disk.

Options:
  --watch        Rebuild when compositions or fonts change
  --dir <dir>    Folder with compositions (default: compositions)
  --out <dir>    Output folder (default: dist)
  -h, --help     Show this help
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    watch: { type: "boolean", default: false },
    dir: { type: "string", default: "compositions" },
    out: { type: "string", default: "dist" },
    help: { type: "boolean", short: "h", default: false },
  },
});

const [command, ...names] = positionals;
if (values.help || command !== "build") {
  process.stdout.write(HELP);
  process.exit(values.help ? 0 : 1);
}

const ROOT = process.cwd();
const COMPOSITIONS = path.resolve(ROOT, values.dir!);
const OUT = path.resolve(ROOT, values.out!);
/** Prebuilt preview UI shipped with the package (dist/preview, from `vp build`). */
const PREVIEW_ASSETS = path.resolve(fileURLToPath(import.meta.url), "../../../dist/preview");
const PREVIEW_ASSETS_PACKED = path.resolve(fileURLToPath(import.meta.url), "../preview");

/** Every <dir>/<name>/index.tsx, except folders starting with "_". */
function discover(): string[] {
  if (!fs.existsSync(COMPOSITIONS)) {
    return [];
  }
  return fs
    .readdirSync(COMPOSITIONS, { withFileTypes: true })
    .filter(
      (d) => d.isDirectory() && !d.name.startsWith("_") && fs.existsSync(path.join(COMPOSITIONS, d.name, "index.tsx")),
    )
    .map((d) => d.name)
    .sort();
}

export interface Output {
  variant: Variant;
  /** False for motion "still". */
  animated: boolean;
  file: string;
  bytes: number;
}

export interface Manifest {
  name: string;
  title?: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  stillFrame: number;
  markers: { frame: number; label: string }[];
  /** Variant keys and their values, in file-name order (motion last). */
  variants: [string, string[]][];
  outputs: Output[];
  stats?: {
    frames: number;
    elements: number;
    animatedElements: number;
    tracks: number;
    keyframes: number;
    ms: number;
  };
  error?: string;
  builtAt: string;
}

async function buildOne(name: string): Promise<boolean> {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const t0 = performance.now();
  let manifest: Manifest;
  try {
    const mod = await import(pathToFileURL(path.join(COMPOSITIONS, name, "index.tsx")).href);
    const comp: Composition = mod.default;
    if (!comp?.component) {
      throw new Error(
        `${path.relative(ROOT, COMPOSITIONS)}/${name}/index.tsx must \`export default defineComposition({...})\``,
      );
    }
    registerFonts(comp.fonts ?? []);
    const axes = normalizeAxes(comp.variants);
    const keys = axes.map(([k]) => k);
    const outputs: Output[] = [];
    let stats: Manifest["stats"];
    for (const variant of expandVariants(comp.variants)) {
      const res = compile(comp, variant);
      const file = variantFileName(name, variant, keys);
      fs.writeFileSync(path.join(dir, file), res.svg);
      outputs.push({
        variant,
        animated: res.animated,
        file,
        bytes: Buffer.byteLength(res.svg),
      });
      if (res.animated) {
        stats ??= {
          ...res.stats,
          ms: 0,
        };
      }
    }
    const ms = Math.round(performance.now() - t0);
    manifest = {
      name,
      title: comp.title,
      width: comp.width,
      height: comp.height,
      fps: comp.fps,
      durationInFrames: comp.durationInFrames,
      stillFrame: comp.stillFrame ?? comp.durationInFrames - 1,
      markers: comp.markers ?? [],
      variants: axes.map(([k, v]) => [k, [...v]]),
      outputs,
      stats: stats && { ...stats, ms },
      builtAt: new Date().toISOString(),
    };
    const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
    console.log(`✓ ${name}  ${ms} ms, ${comp.durationInFrames} frames, ${stats?.keyframes} keyframes`);
    for (const o of outputs) {
      console.log(`    ${path.relative(ROOT, path.join(dir, o.file))}  ${kb(o.bytes)}`);
    }
  } catch (e) {
    const err = e instanceof Error ? (e.stack ?? e.message) : String(e);
    console.error(`✗ ${name}\n${err}`);
    manifest = {
      name,
      width: 0,
      height: 0,
      fps: 30,
      durationInFrames: 1,
      stillFrame: 0,
      markers: [],
      variants: [],
      outputs: [],
      error: err,
      builtAt: new Date().toISOString(),
    };
  }
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return !manifest.error;
}

/** Bundles every built composition (SVG text included) into preview-data.js for the preview page. */
function writePreviewData() {
  const comps = discover()
    .map((n) => path.join(OUT, n, "manifest.json"))
    .filter((f) => fs.existsSync(f))
    .map((f) => {
      const m: Manifest = JSON.parse(fs.readFileSync(f, "utf8"));
      return {
        ...m,
        outputs: m.outputs.map((o) => ({
          ...o,
          svg: fs.readFileSync(path.join(OUT, m.name, o.file), "utf8"),
        })),
      };
    });
  const data = {
    buildId: `${Date.now()}`,
    compositions: comps,
  };
  // A classic script (not JSON + fetch), so the page also works when opened from file://.
  fs.writeFileSync(
    path.join(OUT, "preview-data.js"),
    `window.__SVGREEL__ = ${JSON.stringify(data).replace(/</g, "\\u003c")};\n`,
  );
}

/** Copies the prebuilt preview UI next to the output and writes index.html. */
function writePreviewPage() {
  const assets = [PREVIEW_ASSETS_PACKED, PREVIEW_ASSETS].find((d) => fs.existsSync(path.join(d, "app.js")));
  if (!assets) {
    console.warn("[svgreel] Preview UI not found (in this repository, run `vp build` first). Skipping index.html.");
    return;
  }
  fs.cpSync(assets, path.join(OUT, "_preview"), { recursive: true });
  // The preview's CSS is generated by Stillwind under a hashed name; its manifest lists the files.
  const manifest = JSON.parse(fs.readFileSync(path.join(assets, "stillwind-manifest.json"), "utf8")) as {
    parts: { href: string }[];
  };
  const links = manifest.parts
    .map((p) => `<link rel="stylesheet" href="_preview/${p.href.replace(/^\//, "")}">`)
    .join("\n");
  fs.writeFileSync(
    path.join(OUT, "index.html"),
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>svgreel preview</title>
${links}
</head>
<body>
<div id="root"></div>
<script src="preview-data.js"></script>
<script src="_preview/app.js"></script>
</body>
</html>
`,
  );
}

async function main() {
  const all = discover();
  const unknown = names.filter((n) => !all.includes(n));
  if (unknown.length) {
    console.error(`Unknown composition(s): ${unknown.join(", ")}. Available: ${all.join(", ") || "(none)"}`);
    return false;
  }
  if (!all.length) {
    console.error(`No compositions found: add ${path.relative(ROOT, COMPOSITIONS) || "."}/<name>/index.tsx`);
    return false;
  }
  // Compositions are TypeScript + JSX; tsx compiles them on import (using the project's tsconfig).
  register();
  fs.mkdirSync(OUT, { recursive: true });
  let ok = true;
  for (const n of names.length ? names : all) {
    ok = (await buildOne(n)) && ok;
  }
  writePreviewData();
  writePreviewPage();
  console.log(`\nPreview: ${pathToFileURL(path.join(OUT, "index.html")).href}`);
  return ok;
}

/**
 * Watch mode: each rebuild runs in a fresh child process, so edited modules are re-imported
 * (Node caches ES modules for the life of a process).
 */
function watch() {
  const args = process.argv.slice(2).filter((a) => a !== "--watch");
  let timer: NodeJS.Timeout | undefined;
  let running = false;
  let again = false;
  const run = () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    const child = spawn(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), ...args], {
      stdio: "inherit",
    });
    child.on("exit", () => {
      running = false;
      console.log(`\n[watch] ${new Date().toLocaleTimeString()}: waiting for changes (Ctrl+C to stop)`);
      if (again) {
        again = false;
        run();
      }
    });
  };
  for (const dir of [COMPOSITIONS, path.join(ROOT, "fonts")]) {
    if (!fs.existsSync(dir)) {
      continue;
    }
    fs.watch(dir, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(run, 150);
    });
  }
  run();
}

if (values.watch) {
  watch();
} else {
  process.exitCode = (await main()) ? 0 : 1;
}

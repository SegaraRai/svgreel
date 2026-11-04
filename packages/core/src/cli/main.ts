#!/usr/bin/env node
/**
 * svgreel CLI. Run from a project root:
 *
 *   svgreel build                 # every composition in compositions/
 *   svgreel build profile demo    # only these
 *   svgreel build --watch [names] # rebuild on change; serves the preview on localhost, where
 *                                 # its param controls re-render the SVGs live
 *   svgreel build --param accent=#f00   # override a param default
 *
 * Output: dist/<name>/<name>[-<value>...].svg (+ .still.svg), dist/index.html (preview).
 */

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { register } from "tsx/esm/api";

import { compile } from "../compiler/compile.js";
import { registerFonts } from "../fonts.js";
import { describeParams, parseParamValue, type ParamInfo, type ParamValues } from "../params.js";
import type { Composition } from "../timeline.js";
import { expandVariants, normalizeAxes, variantFileName, type Variant } from "../variants.js";
import {
  startWatchServer,
  type RenderedOutput,
  type RenderRequest,
  type RenderResponse,
  type WatchInfo,
} from "./serve.js";

const HELP = `Usage: svgreel build [names...] [options]

Builds compositions/<name>/index.tsx into <out>/<name>/*.svg and writes <out>/index.html,
a preview page that works when opened straight from disk.

Options:
  --watch        Rebuild when compositions or fonts change, and serve the preview on
                 localhost, where param controls re-render the SVGs live
  --port <n>     Port for --watch (default: 5331, or the next free one)
  --dir <dir>    Folder with compositions (default: compositions)
  --out <dir>    Output folder (default: dist)
  --param <k=v>  Override a param default in every composition that declares it (repeatable)
  -h, --help     Show this help
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    watch: { type: "boolean", default: false },
    dir: { type: "string", default: "compositions" },
    out: { type: "string", default: "dist" },
    param: { type: "string", multiple: true, default: [] },
    port: { type: "string", default: "5331" },
    /** Internal: the live render process that --watch starts. */
    worker: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const [command, ...names] = positionals;
if (values.help || command !== "build") {
  process.stdout.write(HELP);
  process.exit(values.help ? 0 : 1);
}

/** `--param key=value`, as given (parsed per composition, by the param's kind). */
const PARAM_ARGS = new Map<string, string>();
for (const arg of values.param!) {
  const i = arg.indexOf("=");
  if (i <= 0) {
    console.error(`--param expects key=value, got "${arg}".`);
    process.exit(1);
  }
  PARAM_ARGS.set(arg.slice(0, i), arg.slice(i + 1));
}
/** --param keys some composition declared; the rest are reported as unknown. */
const usedParams = new Set<string>();

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
  /** Param values this file was built with. */
  params: ParamValues;
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
  params: ParamInfo[];
  /** Param keys set with --param. */
  overridden: string[];
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

/** Imports a composition, registers its fonts and parses the --param values it declares. */
async function loadComposition(name: string): Promise<{ comp: Composition; overrides: ParamValues }> {
  const mod = await import(pathToFileURL(path.join(COMPOSITIONS, name, "index.tsx")).href);
  const comp: Composition = mod.default;
  if (!comp?.component) {
    throw new Error(
      `${path.relative(ROOT, COMPOSITIONS)}/${name}/index.tsx must \`export default defineComposition({...})\``,
    );
  }
  registerFonts(comp.fonts ?? []);
  const overrides: Record<string, string | number | boolean> = {};
  for (const [key, raw] of PARAM_ARGS) {
    const p = comp.params?.[key];
    if (p) {
      overrides[key] = parseParamValue(key, p, raw);
      usedParams.add(key);
    }
  }
  return { comp, overrides };
}

async function buildOne(name: string): Promise<boolean> {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const t0 = performance.now();
  let manifest: Manifest;
  try {
    const { comp, overrides } = await loadComposition(name);
    const axes = normalizeAxes(comp.variants);
    const keys = axes.map(([k]) => k);
    const outputs: Output[] = [];
    let stats: Manifest["stats"];
    for (const variant of expandVariants(comp.variants)) {
      const res = compile(comp, variant, overrides);
      const file = variantFileName(name, variant, keys);
      fs.writeFileSync(path.join(dir, file), res.svg);
      outputs.push({
        variant,
        animated: res.animated,
        params: res.params,
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
      params: describeParams(comp.params),
      overridden: Object.keys(overrides),
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
      params: [],
      overridden: [],
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
  const unusedParams = [...PARAM_ARGS.keys()].filter((k) => !usedParams.has(k));
  if (unusedParams.length) {
    console.error(`\n✗ No built composition declares param(s): ${unusedParams.join(", ")}`);
    ok = false;
  }
  writePreviewData();
  writePreviewPage();
  // Under --watch the parent serves the preview and passes its URL down.
  console.log(`\nPreview: ${process.env.SVGREEL_PREVIEW_URL ?? pathToFileURL(path.join(OUT, "index.html")).href}`);
  return ok;
}

/** Compiles the requested files of one composition with the preview's param values. */
async function renderLive(req: RenderRequest): Promise<RenderResponse> {
  const t0 = performance.now();
  if (!discover().includes(req.name)) {
    return { error: `Unknown composition "${req.name}".` };
  }
  const { comp, overrides } = await loadComposition(req.name);
  const keys = normalizeAxes(comp.variants).map(([k]) => k);
  const wanted = new Set(req.files);
  const outputs: RenderedOutput[] = [];
  for (const variant of expandVariants(comp.variants)) {
    const file = variantFileName(req.name, variant, keys);
    if (!wanted.has(file)) {
      continue;
    }
    const res = compile(comp, variant, { ...overrides, ...req.params });
    outputs.push({
      file,
      variant,
      animated: res.animated,
      params: res.params,
      bytes: Buffer.byteLength(res.svg),
      svg: res.svg,
    });
  }
  return { outputs, ms: Math.round(performance.now() - t0) };
}

/**
 * The live render process: imports compositions on request and keeps them loaded. Watch mode
 * replaces it after every change, so edited modules are imported fresh.
 */
function runWorker() {
  register();
  process.on("disconnect", () => process.exit(0));
  process.on("message", (msg: { id: number; req: RenderRequest }) => {
    void renderLive(msg.req)
      .catch((e: unknown): RenderResponse => ({ error: e instanceof Error ? e.message : String(e) }))
      .then((res) => process.send!({ id: msg.id, res }));
  });
}

/**
 * Watch mode: each rebuild runs in a fresh child process, so edited modules are re-imported
 * (Node caches ES modules for the life of a process). The preview is served on localhost; its
 * live renders run in another child, started on the first request and replaced after a change.
 */
async function watch() {
  const args = process.argv.slice(2).filter((a) => a !== "--watch");
  const script = [...process.execArgv, fileURLToPath(import.meta.url)];

  let worker: ChildProcess | undefined;
  let nextId = 0;
  const pending = new Map<number, (res: RenderResponse) => void>();
  /** Ends the worker; open requests get `res` (a rebuild: ask again; a crash: an error). */
  const stopWorker = (res: RenderResponse = { error: "Rebuilding after a change.", retry: true }) => {
    worker?.kill();
    worker = undefined;
    for (const done of pending.values()) {
      done(res);
    }
    pending.clear();
  };
  const render = (req: RenderRequest) =>
    new Promise<RenderResponse>((resolve) => {
      if (!worker) {
        const child = spawn(process.execPath, [...script, ...args, "--worker"], {
          stdio: ["ignore", "inherit", "inherit", "ipc"],
        });
        child.on("message", (msg: { id: number; res: RenderResponse }) => {
          pending.get(msg.id)?.(msg.res);
          pending.delete(msg.id);
        });
        child.on("exit", (code) => {
          if (worker === child) {
            stopWorker({ error: `The render process exited (code ${code}); see the terminal.` });
          }
        });
        worker = child;
      }
      const id = nextId++;
      pending.set(id, resolve);
      worker.send({ id, req });
    });

  let build: ChildProcess | undefined;
  const cliFile = fileURLToPath(import.meta.url);
  const info: WatchInfo = {
    out: OUT,
    config: JSON.stringify({
      dir: COMPOSITIONS,
      names: [...names].sort(),
      params: [...PARAM_ARGS].map(([k, v]) => `${k}=${v}`).sort(),
    }),
    cli: `${cliFile}@${fs.statSync(cliFile).mtimeMs}`,
    pid: process.pid,
  };
  try {
    const started = await startWatchServer({
      root: OUT,
      port: Number(values.port),
      info,
      render,
      onShutdown: () => {
        console.log("\n[watch] Another watch for this output took over. Stopping.");
        stopWorker();
        build?.kill();
        process.exit(0);
      },
    });
    if (started.kind === "running") {
      // It rebuilds on its own, and the preview reloads itself: nothing to restart.
      console.log(
        `[watch] Already running for ${path.relative(ROOT, OUT) || "."} with these options (pid ${started.running.pid}).\n` +
          `Preview: ${started.url}`,
      );
      return;
    }
    if (started.replaced) {
      console.log(
        `[watch] Replaced the watch for ${path.relative(ROOT, OUT) || "."} (pid ${started.replaced.pid}), ` +
          "which had other options or an older CLI.",
      );
    }
    process.env.SVGREEL_PREVIEW_URL = started.url;
  } catch (e) {
    console.error(`[watch] Could not start the preview server (${String(e)}); open the file instead.`);
  }

  let timer: NodeJS.Timeout | undefined;
  let running = false;
  let again = false;
  const run = () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    const child = spawn(process.execPath, [...script, ...args], {
      stdio: "inherit",
    });
    build = child;
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
      stopWorker();
      clearTimeout(timer);
      timer = setTimeout(run, 150);
    });
  }
  run();
}

if (values.worker) {
  runWorker();
} else if (values.watch) {
  await watch();
} else {
  process.exitCode = (await main()) ? 0 : 1;
}

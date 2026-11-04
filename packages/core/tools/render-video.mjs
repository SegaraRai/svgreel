#!/usr/bin/env node
// Renders a built composition to a video, frame by frame, with its audio.
//
// Copy this file into your project (`tools/render-video.mjs`) and run it from the project root
// after `svgreel build`:
//
//   node tools/render-video.mjs <name> [options]
//
// Needs, installed by you (they are not svgreel dependencies):
//   - Playwright:  pnpm add -D playwright && pnpm exec playwright install chromium
//   - ffmpeg on PATH (or FFMPEG=/path/to/ffmpeg), unless you only write frames (--frames)
//
// Each frame is a screenshot of the SVG with its CSS animations paused at that frame's time, so
// the video has exactly the frames the SVG shows, however slow the machine. Audio comes from the
// composition's `audio` (dist/_audio/), placed at its `offset`. See svgreel's docs/tools.md.
//
// This file is yours: change it freely. svgreel ships the original in node_modules/svgreel/tools/;
// after updating svgreel, diff the two and take what you want.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const HELP = `node tools/render-video.mjs <name> [options]

  --dist <dir>          build output folder (default: dist)
  --out <file>          output video (default: video/<name>.mp4; .webm also works)
  --variant k=v         pick the output with this variant value, repeatable (e.g. theme=dark)
  --file <name.svg>     pick the output file directly
  --scale <n>           pixel density (default: 2; the video is width*n x height*n)
  --from <frame>        first frame (default: 0)
  --to <frame>          frame after the last (default: durationInFrames)
  --loops <n>           repeat the animation n times (default: 1)
  --background <color>  page color behind the SVG (default: #ffffff)
  --color-scheme <s>    light or dark, for SVGs that follow prefers-color-scheme (default: light)
  --no-audio            leave the audio out
  --crf <n>             quality, lower is better (default: 18)
  --frames <dir>        write numbered PNGs to <dir> instead of a video (no ffmpeg needed)
`;

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dist: { type: "string", default: "dist" },
    out: { type: "string" },
    variant: { type: "string", multiple: true, default: [] },
    file: { type: "string" },
    scale: { type: "string", default: "2" },
    from: { type: "string" },
    to: { type: "string" },
    loops: { type: "string", default: "1" },
    background: { type: "string", default: "#ffffff" },
    "color-scheme": { type: "string", default: "light" },
    "no-audio": { type: "boolean", default: false },
    crf: { type: "string", default: "18" },
    frames: { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
});

const name = positionals[0];
if (opt.help || !name) {
  process.stdout.write(HELP);
  process.exit(name || opt.help ? 0 : 1);
}

function fail(message) {
  console.error(`render-video: ${message}`);
  process.exit(1);
}

const dist = path.resolve(opt.dist);
const manifestPath = path.join(dist, name, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  fail(`${path.relative(process.cwd(), manifestPath)} not found. Run \`svgreel build ${name}\` first.`);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.error) {
  fail(`the last build of ${name} failed:\n${manifest.error}`);
}

// Pick the SVG.
const wanted = Object.fromEntries(
  opt.variant.map((kv) => {
    const i = kv.indexOf("=");
    if (i < 0) {
      fail(`--variant takes key=value, got "${kv}"`);
    }
    return [kv.slice(0, i), kv.slice(i + 1)];
  }),
);
const output = opt.file
  ? manifest.outputs.find((o) => o.file === opt.file)
  : manifest.outputs.find((o) => o.animated && Object.entries(wanted).every(([k, v]) => o.variant[k] === v));
if (!output) {
  const files = manifest.outputs.map((o) => `${o.file}  ${JSON.stringify(o.variant)}`).join("\n  ");
  fail(`no output matches. Outputs:\n  ${files}`);
}

const fps = manifest.fps;
const from = opt.from === undefined ? 0 : Number(opt.from);
const to = opt.to === undefined ? manifest.durationInFrames : Number(opt.to);
const loops = Math.max(1, Number(opt.loops));
const scale = Number(opt.scale);
const total = (to - from) * loops;
if (!(to > from)) {
  fail(`--to (${to}) must be after --from (${from})`);
}

let playwright;
try {
  playwright = await import("playwright");
} catch {
  fail("Playwright isn't installed. Run: pnpm add -D playwright && pnpm exec playwright install chromium");
}

// Inline the SVG in a bare page so the background and size are under control.
const svg = fs.readFileSync(path.join(dist, name, output.file), "utf8");
const html = `<!doctype html><html><head><style>
html,body{margin:0;background:${opt.background};overflow:hidden}
body>svg{display:block;width:${manifest.width}px;height:${manifest.height}px}
</style></head><body>${svg}</body></html>`;

const browser = await playwright.chromium.launch();
const page = await browser.newPage({
  viewport: { width: manifest.width, height: manifest.height },
  deviceScaleFactor: scale,
  colorScheme: opt["color-scheme"] === "dark" ? "dark" : "light",
  reducedMotion: "no-preference",
});
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));

// Frames go straight into ffmpeg's stdin, or to PNG files with --frames.
let ffmpeg;
let outFile;
if (opt.frames) {
  fs.mkdirSync(opt.frames, { recursive: true });
} else {
  outFile = path.resolve(opt.out ?? path.join("video", `${name}.mp4`));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const webm = outFile.endsWith(".webm");
  const args = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "-"];
  const audio = !opt["no-audio"] && manifest.audio;
  const seconds = total / fps;
  if (audio) {
    // Audio file time 0 plays at timeline second `offset`. Shift it by the frames skipped with
    // --from, then trim or delay it to line up with the first frame.
    const shift = audio.offset - from / fps;
    const trim = Math.max(0, -shift);
    const delay = Math.round(Math.max(0, shift) * 1000);
    args.push("-i", path.join(dist, audio.file));
    // One loop's worth of audio (padded with silence if the file ends first), repeated --loops times.
    const once = `[1:a]atrim=start=${trim},asetpts=PTS-STARTPTS,adelay=${delay}:all=1,apad,atrim=duration=${(to - from) / fps}`;
    const parts = Array.from({ length: loops }, (_, k) => `[s${k}]`).join("");
    const graph = loops > 1 ? `${once},asplit=${loops}${parts};${parts}concat=n=${loops}:v=0:a=1[a]` : `${once}[a]`;
    args.push("-filter_complex", graph, "-map", "0:v", "-map", "[a]");
    args.push(...(webm ? ["-c:a", "libopus", "-b:a", "160k"] : ["-c:a", "aac", "-b:a", "192k"]));
  }
  // Even dimensions for yuv420p.
  args.push("-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-t", String(seconds));
  args.push(
    ...(webm
      ? ["-c:v", "libvpx-vp9", "-crf", opt.crf, "-b:v", "0", "-pix_fmt", "yuv420p"]
      : ["-c:v", "libx264", "-crf", opt.crf, "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]),
    outFile,
  );
  ffmpeg = spawn(process.env.FFMPEG || "ffmpeg", args, { stdio: ["pipe", "inherit", "inherit"] });
  ffmpeg.on("error", (e) => fail(`couldn't run ffmpeg (${e.message}). Install it, set FFMPEG, or use --frames <dir>.`));
}

const write = (buf) =>
  new Promise((resolve) => {
    if (ffmpeg.stdin.write(buf)) {
      resolve();
    } else {
      ffmpeg.stdin.once("drain", resolve);
    }
  });

const t0 = performance.now();
for (let i = 0; i < total; i++) {
  const frame = from + (i % (to - from));
  // +1 ms: land inside the frame, not on the keyframe boundary before it.
  const ms = (frame / fps) * 1000 + 1;
  await page.evaluate((t) => document.getAnimations().forEach((a) => (a.currentTime = t)), ms);
  const png = await page.screenshot({ type: "png" });
  if (opt.frames) {
    fs.writeFileSync(path.join(opt.frames, `${String(i).padStart(5, "0")}.png`), png);
  } else {
    await write(png);
  }
  if (process.stdout.isTTY && (i % 10 === 0 || i === total - 1)) {
    process.stdout.write(`\rframe ${i + 1}/${total}`);
  }
}
await browser.close();

if (ffmpeg) {
  ffmpeg.stdin.end();
  const code = await new Promise((resolve) => ffmpeg.on("close", resolve));
  if (code !== 0) {
    fail(`ffmpeg exited with ${code}`);
  }
}
const secs = ((performance.now() - t0) / 1000).toFixed(1);
const where = path.relative(process.cwd(), opt.frames ? path.resolve(opt.frames) : outFile);
console.log(
  `${process.stdout.isTTY ? "\n" : ""}${where}  ${total} frames, ${(total / fps).toFixed(2)} s, rendered in ${secs} s`,
);

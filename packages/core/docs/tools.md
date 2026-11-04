# Tools

svgreel ships optional helper scripts in `node_modules/svgreel/tools/`. They aren't part of the
library or the CLI, and their dependencies (Python, Playwright, ffmpeg) aren't svgreel
dependencies: a project that never needs them installs nothing.

| Tool               | What it does                                                                  | Needs                                                              |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `beatmap.py`       | Finds beats, bars, tempo changes and sections in music ([audio.md](audio.md)) | [uv](https://docs.astral.sh/uv/) (installs Python packages itself) |
| `render-video.mjs` | Renders a built composition to MP4/WebM, with its audio                       | Playwright with Chromium, ffmpeg                                   |

## Using a tool

Copy it into the project and run the copy:

```sh
mkdir -p tools
cp node_modules/svgreel/tools/render-video.mjs tools/
```

The copy is the project's own file: commit it and change it whenever the project needs something
different (another output size, a fixed background, other analysis settings). Copy only the tools
the project uses.

Install what the tool needs the first time it's used, and tell the user what you installed. Each
tool's header comment lists its requirements, and it prints an install hint when one is missing.

## After updating svgreel

Compare each copied tool with the new original and bring over the changes that help:

```sh
git diff --no-index node_modules/svgreel/tools/render-video.mjs tools/render-video.mjs
```

Lines only in the copy are the project's own changes; keep them. Fixes and new options from the
original are usually worth taking. The tools read svgreel's outputs (`dist/<name>/manifest.json`,
the beat map format), so check the changelog for changes to those too.

## render-video.mjs

```sh
svgreel build banner
node tools/render-video.mjs banner                      # → video/banner.mp4
node tools/render-video.mjs banner --variant theme=dark --scale 1 --loops 3 --out video/banner-dark.mp4
```

It opens the built SVG in headless Chromium, pauses its CSS animations, and screenshots every
frame at that frame's time, then pipes the frames to ffmpeg. The video has exactly the SVG's
frames, however slow the machine. The composition's `audio` is mixed in at its `offset`.

- `--scale` (default 2) sets the pixel density: 2 makes an 800 × 400 composition 1600 × 800.
- `--from` / `--to` render a range of frames; `--loops n` repeats it, audio included.
- `--background` is the color behind transparent parts (default white). Rounded corners show it.
- `--variant key=value` or `--file` picks one output when there are variants.
- `--frames <dir>` writes numbered PNGs instead, without ffmpeg.
- Install: `pnpm add -D playwright`, `pnpm exec playwright install chromium`, and ffmpeg from
  the OS package manager (`winget install ffmpeg`, `brew install ffmpeg`, `apt install ffmpeg`).

## beatmap.py

See [audio.md](audio.md#analyzing-music).

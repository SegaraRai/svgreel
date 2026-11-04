---
"svgreel": minor
---

New tool `tools/render-video.mjs` renders a built composition to MP4 or WebM, frame-exact, with its `audio` mixed in at its offset (`node tools/render-video.mjs <name>`; options for scale, frame range, loops, variant and background, or `--frames` for a PNG sequence). The scripts in `node_modules/svgreel/tools/` are meant to be copied into your project's `tools/` and adapted; after updating svgreel, diff your copies against the new originals. Their requirements (Playwright and ffmpeg for video, uv for `beatmap.py`) are not svgreel dependencies. See `docs/tools.md`.

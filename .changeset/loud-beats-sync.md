---
"svgreel": minor
---

Audio and beat sync. A composition can set `audio: { src: "music.mp3", offset }`: the preview plays it in sync with the timeline (tick "sound"; under `--watch` the audio drives the clock), while the SVG stays silent and the file is copied to `dist/_audio/`, not into `dist/<name>/`. New beat-sync APIs work from a beat map: `useBeatGrid()` / `beatGrid()` give the frames of bars, beats and sections (`grid.bar(8)`, `grid.section(1)`, `grid.snap(frame, "bar")`) for placing scenes and text, with frames in the current `<Sequence>`'s time so they go straight into `from` and `delay`; `useBeat`, `useSection`, `useOnset`, `useBeatConfidence`, `useTempo` and `decay` drive motion that reacts to the music. The beat map comes from `tools/beatmap.py` (shipped in the package, run with `uv run`), which uses the Beat This! model to find beats, bars, tempo changes, additive meters, sections and attacks. See `docs/audio.md` and `examples/beat-sync`.

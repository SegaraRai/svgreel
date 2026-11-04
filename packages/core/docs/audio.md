# Audio and beat sync

A composition can carry a sound track: music to time the motion to, or narration. The SVG stays
silent (a README image can't play sound), but:

- the preview plays the track in sync with the timeline, and
- a beat map from `tools/beatmap.py` tells you where the beats, bars and sections are, so scenes
  and text can land on them (`useBeatGrid`) and motion can react to them (`useBeat`, …).

The example is `examples/beat-sync` (`node_modules/svgreel/examples/beat-sync`).

## Attaching audio

```tsx
export default defineComposition({
  component: Banner,
  fps: 30,
  durationInFrames: 480,
  audio: { src: "music.mp3", offset: -12.5 },
  ...
});
```

- `src` is relative to the composition's folder. Any format the browser plays (mp3, wav, ogg,
  m4a). The build copies it to `dist/_audio/<name>.<ext>` for the preview, not into
  `dist/<name>/`, so copying that folder into a README still takes only SVGs.
- `offset` is the timeline time in seconds at which the file's 0 s plays. Negative skips the
  start of the file (`-12.5` starts the composition 12.5 s into the song). The beat hooks apply
  it too, so beat-map times stay as the analysis wrote them.

In the preview, tick **sound** in the transport bar. Sound plays at 1× speed only. Under
`svgreel build --watch` (served over http) the audio is the clock: the frame shown is the one
that matches what you hear, output latency included. Opened from disk (`file://`), the
preview plays the file with an `<audio>` element and keeps it within about 0.1 s of the clock.
Use `--watch` to judge sync.

## Analyzing music

`beatmap.py` finds beats, bars, tempo changes, sections and attacks, using the
[Beat This!](https://github.com/CPJKU/beat_this) model. It is a single Python file shipped in
`node_modules/svgreel/tools/`: copy it into the project's `tools/` first (see [tools.md](tools.md)).
Run it with [uv](https://docs.astral.sh/uv/), which installs its dependencies (PyTorch, librosa)
on the first run. A CUDA GPU is used when PyTorch finds one; on CPU a 3-minute song takes about 30 s.

```sh
uv run tools/beatmap.py analyze music.mp3 -o music.analysis.json --png music.png
uv run tools/beatmap.py export music.analysis.json -o compositions/banner/beats.json
```

`analyze` prints a summary and draws `music.png`. `export` writes the beat map the composition
imports (`import beatsJson from "./beats.json" with { type: "json" }`, then `const beats: BeatMap = beatsJson`). With no
options it uses the summary's `suggest`; `--from S --to S` keeps an excerpt.

You can't hear the music, and the analysis can be wrong, so check its output before you build
on it. Then ask the user to listen in the preview.

### The normal case

Most music people bring is produced (DTM, BGM, pop) with one fixed tempo in 4/4. Its summary
looks like this:

```text
music.mp3: tempo 125.00@0.0s
  meter 4 (downbeat agreement 0.98), phase 2, suggest {'every': 1, 'bar': 4, 'phase': 2}
  accent cycle 4 r=0.684 (2nd 0.474)
  low confidence [[92.0, 100.0]]  sections [16.36, 45.16, 62.44, 77.80]
```

Healthy signs: one tempo segment with a round-ish BPM (125.00, 128.00, 158.00), downbeat
agreement of 0.9 or more, an accent cycle equal to the meter (or a multiple of it), and low
confidence only at the start or end. In the plot, red lines (downbeats) sit on the big attacks in
the waveform and the black ticks (raw detections) line up with the grid.

### When the summary looks unusual

Each of these is rare; most songs need none of them.

- **The beat is very fast (above ~160 BPM).** The grid is often eighth notes. `suggest` already
  picks the level nearest 120 BPM (`every: 2` or `3`). If the meter is ambiguous, such as 6/8 or
  a fast 3/4, ask the user.
- **Low downbeat agreement (below 0.8), or an accent cycle that isn't a multiple of the
  meter.** The bars may be additive, such as 3+2 | 3+2 | 3+3 | 3+3. The summary then shows
  something like `accent cycle 22 r=0.65 (2nd 0.23)` and a `pattern` in `suggest`, which `export`
  uses. To override it, pass `--pattern "3+2,3+2,3+3,3+3" --phase P`. Pulses are then the group
  heads, unevenly spaced; the hooks handle that. Tell the user the pattern you found. People who
  bring such music usually know its meter.
- **Several tempo segments** (`125.00@0.0s → 139.50@20.1s`). Each step change gets its own
  grid and bar phase; nothing else is needed. A tempo change is a good place for a scene change.
- **`free` segments.** The tempo isn't steady there (a ritardando, rubato, a fermata, the end
  of the song). The beat map keeps the raw detected beats. Prefer phrase-level motion there.
- **Low-confidence stretches** (yellow in the plot). The music gives few rhythmic cues (a soft
  intro, sustained pads, solo piano), so downbeats there are guesses. `useBeatConfidence()` is 0
  there: use it to soften hits, or start the beat-driven part at the next section.
- **Wrong or missing sections.** Sections are found by clustering bars by harmony and timbre.
  Short pieces (under ~16 bars) have too few bars for it. Edit `sections` in beats.json; any
  downbeat time works.
- **Nothing fits** (no stable segment, high residuals everywhere): live or rubato music. Don't
  force a grid. Time the motion to sections and onsets, or ask the user where the beats are.

Whenever you make a call (beat level, meter, pattern, edited sections), say so in your reply so
the user can correct it after listening.

## Placing scenes and text on the music

Most of the time the music decides _when_ things happen: a scene cuts where a section starts, a
title lands on a downbeat, words come in one per beat. Get those frames from the beat grid:

```tsx
import { beatGrid, charAnimations, defineComposition, Sequence, Text, useBeatGrid, useCurrentFrame,
  useVideoConfig, type BeatMap } from "svgreel";
import beatsJson from "./beats.json" with { type: "json" };

const beats: BeatMap = beatsJson;
const OFFSET = -12.5;
const grid = beatGrid(beats, { fps: 30, offset: OFFSET }); // composition frames
const LAND = Math.round(0.23 * 30); // pop reaches full size 0.23 s after it starts

function Chorus() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const g = useBeatGrid(beats); // frames counted from this Sequence's start
  return ["Make", "it", "move"].map((w, i) => (
    <Text key={w} charStyle={charAnimations.pop({ frame, fps, delay: g.bar(9, 1 + i) - LAND, stagger: 0 })} …>{w}</Text>
  ));
}

function Banner() {
  return (
    <svg …>
      <Sequence durationInFrames={grid.section(1)}><Intro /></Sequence>
      <Sequence from={grid.section(1)}><Chorus /></Sequence>
    </svg>
  );
}

export default defineComposition({
  component: Banner,
  fps: 30,
  durationInFrames: grid.bar(16), // exactly 16 bars from the first downbeat
  audio: { src: "music.mp3", offset: OFFSET },
  markers: [{ frame: grid.section(1), label: "chorus" }],
  …
});
```

- `grid.bar(n, pos)` is the usual tool: bars are how music is counted, and `pos` past the bar's
  end runs on, so `bar(9, 1 + i)` puts word `i` on the `i`-th beat from bar 9.
- **Make entrances land on the beat, not start on it.** A beat is heard as one instant, so the
  moment a word is fully there should be the beat. Start the entrance that much earlier: `pop`
  reaches full size 0.23 s after it starts, `rise` 0.3 s, `fade` after its `duration`. Use
  `stagger: 0` for a word that lands on a beat, or its last letters arrive late. A cut (a new
  `<Sequence>`, a color switch) is instant and goes exactly on the frame.
- **Give the first entrance a shorter lead.** Once a few things have landed on beats, viewers
  expect the next one and an early start reads as on time. The first one after nothing has no
  such expectation, so its early start reads as early. Start it about half as early (for `pop`,
  0.13 s: fully opaque and mostly grown on the beat).
- `useBeatGrid()` counts in the current `<Sequence>`'s time, so its frames go straight into
  `delay` or a nested `<Sequence from>`. Use `beatGrid()` outside components, with the same
  `offset` as `audio`.
- Have a rough frame from the storyboard? `grid.snap(frame, "bar")` moves it to the nearest
  downbeat, `grid.next(frame)` to the next beat.
- Narration has no beats: write down the seconds where each line starts (listen, or run a
  speech-to-text tool with timestamps) and use `grid.time(seconds)`.
- To loop a banner seamlessly, end it on a bar line: `durationInFrames: grid.bar(n)`.

## Reacting to the beat

For motion that follows the music continuously (a pulse, a flash on each snare), the hooks report
where the music is now:

```tsx
function Pulse() {
  const { fps } = useVideoConfig();
  const b = useBeat(beats);
  const k = decay(b.since, fps, b.isDownbeat ? 0.12 : 0.07) * (b.isDownbeat ? 1 : 0.5) * useBeatConfidence(beats);
  return <circle r={80} style={{ transform: `scale(${round(1 + 0.2 * k, 3)})` }} />;
}
```

- Big changes (scene cuts, color shifts) go on **section starts**: that's where the song builds
  up, and viewers notice it most.
- Medium accents go on **downbeats** and small pulses on **beats**. A big move on every beat gets
  tiring; keep most of them small, or skip them entirely and let the scene timing carry the sync.
- Use **onsets** (`useOnset`) for sound-specific touches like a ring on each snare, not for
  structure.
- Make hits a sharp attack plus a decay (`decay(since, fps, halfLife)`).
- These hooks follow the composition's timeline, not `<Sequence>` time, because the audio plays
  on the composition's timeline.

## Frame rounding

Audio times become frames by rounding down: a hit is at most one frame early, never late. Viewers
accept sound lagging the picture far more than the reverse. 60 fps halves the error but makes the
files about 50 % larger.

## Checking sync without ears

Seek the compiled SVG's animations to a beat's frame and the frame before it (in a browser,
`svg.getAnimations()` and `currentTime`). The hit must start on the beat's frame. Then play it in
the `--watch` preview with sound on, and ask the user to listen.

## Sharing the result

The SVG is silent. For a video with the sound (social media, a demo), render one with
`render-video.mjs` ([tools.md](tools.md)).

## Beat map format

```jsonc
{
  "bpm": 125.0, // median pulse tempo
  "meter": 4, // pulses in the longest bar
  "pattern": null, // or "3+2,3+2,3+3,3+3" (grid steps per group)
  "tempo": [{ "start": 0, "bpm": 125.0, "free": false }],
  "beats": [[0.519, 1, -2.5]], // [time s, position in bar (1 = downbeat), loudness dB]
  "sub": [0.759], // grid beats between pulses
  "sections": [16.36], // section starts, on downbeats
  "onsets": [[0.52, 0.81]], // [time s, strength 0..1]
  "lowConfidence": [[0, 8]], // [start s, end s]
}
```

Times are seconds in the audio file.

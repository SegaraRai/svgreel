# API reference

Everything is imported from `svgreel`:

```tsx
import { defineComposition, Text, spring, useCurrentFrame } from "svgreel";
```

The working examples are the best reference. They ship with the package, so in a project they
are at `node_modules/svgreel/examples/`: `components` has one card per component, `animation`
covers scenes, loops and motion helpers, and `typography` covers text. These three share their
header and cards from `_shared/showcase.tsx`; copy it along with them. The template's
`compositions/profile` is a complete banner.

## Composition

```tsx
export default defineComposition({
  component: MyComp,          // renders a single root <svg>
  width: 1200, height: 600,   // output size (also the default viewBox)
  fps: 30,
  durationInFrames: 300,      // loop length
  fonts: [...],               // see "Fonts" below
  variants: { theme: ["dark", "light"] }, // one file per combination, see "Variants"
  params: { accent: param.color("#7c3aed") }, // tunable values, see "Params"
  stillFrame: 120,            // frame for *.still.svg (default: last)
  title: "Accessible label",
  markers: [{ frame: 0, label: "intro" }], // jump targets in the preview
  audio: { src: "music.mp3", offset: 0 }, // played by the preview, not in the SVG; see audio.md
});
```

|                                    |                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `useCurrentFrame()`                | Current frame, relative to the innermost `<Sequence>`                   |
| `useVideoConfig()`                 | `{ width, height, fps, durationInFrames }`                              |
| `useVariant()`                     | The variant being compiled, e.g. `{ theme: "dark", motion: "default" }` |
| `useParams()`                      | The param values, e.g. `{ accent: "#7c3aed" }`                          |
| `<DirectionProvider dir>`          | Sets the writing direction (`"ltr"` or `"rtl"`) for its children        |
| `useDirection()`                   | The nearest provider's direction, or `"ltr"`                            |
| `<Sequence from durationInFrames>` | Shifts time for its children and hides them outside the range           |

## Variants

`variants` lists the values of each key. Every combination is compiled to its own file, and the
component reads the current one with `useVariant()`:

```tsx
const variants = defineVariants({ theme: ["dark", "light"], lang: ["en", "ja"] });

function Banner() {
  const { theme, lang, motion } = useVariant<typeof variants>(); // literal types via defineVariants
  return <svg>{/* branch on theme / lang / motion */}</svg>;
}

export default defineComposition({ component: Banner, variants, ... });
```

Use the predefined keys and values when they fit: the preview labels them, and theme and motion
map to media queries in the generated embed code. Other keys and values work too (letters,
digits, `-`, `_`).

| Key      | Predefined values            | Effect                                                                    |
| -------- | ---------------------------- | ------------------------------------------------------------------------- |
| `theme`  | `dark`, `light`              | Preview background; `prefers-color-scheme` in the embed code              |
| `lang`   | `en`, `ja`, `en-US`, `ja-JP` | `lang` on the root `<svg>`                                                |
| `motion` | `default`, `still`           | `still` is frame `stillFrame` without animation; `prefers-reduced-motion` |

`motion` defaults to `["default", "still"]`, so every combination also gets a still file. Set
`motion: ["default"]` to skip them, or add your own values (e.g. `"subtle"`), which are animated
like `default`. For a better static version, branch on `motion === "still"` in the component.

Files are named `<name>-<value>-<value>…`, in key order. For motion, `default` adds nothing,
`still` adds `.still` and other values add `-<value>`: `dist/banner/banner-dark-ja.svg`,
`banner-dark-ja.still.svg`. Without variants the files are `<name>.svg` / `<name>.still.svg`.

## Params

`params` names values the component reads with `useParams()`: an accent color, a speed, a
headline. Unlike variants they don't add files. Every file is built with the defaults, and
`svgreel build --param key=value` overrides one for a build:

```tsx
const params = defineParams({
  accent: param.color("#7c3aed"),
  speed: param.number(1, { min: 0.5, max: 2, step: 0.1 }),
  grid: param.boolean(true),
  headline: param.text("Hello", { label: "Headline" }),
  align: param.select(["left", "center", "right"], "center"),
});

function Banner() {
  const { accent, speed, align } = useParams<typeof params>(); // value types via defineParams
  return <svg>{/* ... */}</svg>;
}

export default defineComposition({ component: Banner, params, ... });
```

| Builder                                     | Value                                                   |
| ------------------------------------------- | ------------------------------------------------------- |
| `param.color(default)`                      | A color string (`#hex`, `rgb()`, `hsl()`, named colors) |
| `param.number(default, { min, max, step })` | A number; values outside `min`…`max` fail the build     |
| `param.boolean(default)`                    | `true` or `false`                                       |
| `param.text(default, { multiline })`        | A string                                                |
| `param.select(options, default)`            | One of `options`, typed as their union                  |

Every builder also takes `label` and `description`, shown in the preview. A default can be a
function of the variant, for a value per theme:
`param.color((v) => (v.theme === "dark" ? "#e6edf3" : "#1f2328"))`.

`--param` is repeatable and applies to every built composition that declares the key; a key that
none declares fails the build. Numbers and booleans are parsed from the text
(`--param speed=1.5 --param grid=false`). The preview lists each param with the values the files
were built with.

To tune them by eye, run `svgreel build --watch`: it also serves the preview on
`http://127.0.0.1:5331/` (`--port` to change; the next free port if taken), where every param
gets a control (color picker, slider when `min` and `max` are set, checkbox, text field, select).
A change re-renders the shown files in a few hundred ms and marks them "live"; the files on
disk keep the built values. "copy --param" and "copy values" copy the changed values, to pass to a
build or to paste in as the new defaults. Edits survive rebuilds after a source change.

Only one watch runs per output folder. Starting `--watch` again with the same options prints the
running one's URL and exits, because it already rebuilds on every change. With other options
(names, `--dir`, `--param`) or an updated svgreel, the new watch stops the old one and takes over
its port, so an open preview tab keeps working. Watches of other projects are left alone.

## Animation math

All of these are pure functions of the frame number.

|                                                                                                                            |                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `interpolate(x, [in…], [out…], { easing, extrapolateLeft, extrapolateRight })`                                             | Piecewise-linear mapping. Extrapolation: `"extend"` (default), `"clamp"`, `"identity"`                                         |
| `tween(frame, [from, to], [a, b] = [0, 1], easing = out(cubic))`                                                           | `interpolate` clamped on both sides; the everyday tool                                                                         |
| `spring({ frame, fps, config, from, to, delay, durationInFrames })`                                                        | Damped spring, 0 → 1. `config: { mass, damping, stiffness, overshootClamping }` (defaults 1, 10, 100, false)                   |
| `measureSpring({ fps, config })`                                                                                           | Frames until a spring settles                                                                                                  |
| `Easing.linear / ease / quad / cubic / poly(n) / sin / circle / exp / elastic(b) / back(s) / bounce / bezier(x1,y1,x2,y2)` | Easings, plus `Easing.in / out / inOut(e)`                                                                                     |
| `presence(frame, start, end, fade = 15, loop?)`                                                                            | 0 → 1 → 0 envelope for a visibility window                                                                                     |
| `pulse(frame, at, rise, fall)`                                                                                             | Short 0 → 1 → 0 blip                                                                                                           |
| `blink(frame, period)`                                                                                                     | 1/0 square wave (carets)                                                                                                       |
| `round(n, digits = 2)`                                                                                                     | Rounding for animated values. Use 4 digits for scales or fractions applied to large sizes, or motion turns into visible steps  |
| `interpolateColors(x, [in…], [colors…])`, `mixColors(a, b, t)`, `withAlpha(c, a)`, `parseColor(c)`                         | Colors: hex, rgb(a), hsl(a)                                                                                                    |
| `oscillate(frame, period, loop, phase = 0)`                                                                                | Sine wave in [-1, 1] whose period is snapped (with `loopPeriod(period, loop)`) to fit the loop, so it has no seam              |
| `random(seed)`                                                                                                             | Deterministic number in [0, 1) per seed. Use instead of `Math.random()`, which changes every frame                             |
| `noise1D(x, seed, repeat?)`, `noise2D(x, y, seed)`                                                                         | Smooth value noise in [-1, 1]. With `repeat`, the 1D curve repeats, for wobble that loops                                      |
| `pathGeometry(d)` → `{ length, at(t) }`, `pointOnPath(d, t)`                                                               | Length of SVG path data and `{ x, y, angle }` at a fraction of it, without a DOM. `angle` is continuous, so it can be animated |

## Beat sync

Timing from a `BeatMap` written by `tools/beatmap.py` (see [audio.md](audio.md)). Import the
JSON and annotate it: `const beats: BeatMap = beatsJson`. Everything applies the composition's
`audio.offset` unless you pass `offset`.

**Placing things on the music.** `useBeatGrid(map)` returns frames in the current `<Sequence>`'s
time, ready for a nested `<Sequence from>` or an animation's `delay`. `beatGrid(map, { fps,
offset })` is the same in composition frames, for use outside components (`durationInFrames`,
`markers`).

|                                        |                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `grid.bar(n, pos = 1)`                 | Frame of bar `n` (0 = first downbeat), beat `pos`; a `pos` past the bar continues into the next |
| `grid.beat(i)`                         | Frame of beat `i` (an index into `map.beats`)                                                   |
| `grid.section(i)`                      | Frame where section `i` starts (0 = the audio's start); throws past the last section            |
| `grid.time(seconds)`                   | Frame showing that moment of the audio file (narration cues), rounded down                      |
| `grid.prev / next / snap(frame, unit)` | Last at or before, first at or after, nearest; `unit` `"beat"` (default) or `"bar"`             |
| `grid.at(frame)`                       | The beat at `frame`, as `useBeat()` returns it                                                  |
| `grid.barCount`, `grid.sectionCount`   | Bars from the first downbeat on; sections including the one before the first boundary           |

Beats and bars past either end are extrapolated at `bpm` and `meter`, so
`grid.bar(grid.barCount)` is where the last bar ends.

**Reacting to the music.** These follow the composition's timeline, not `<Sequence>` time.

|                                                  |                                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `useBeat(map, { offset })`                       | `{ index, pos, bar, since, length, progress, db, isDownbeat }` for the current beat               |
| `useSection(map, { offset })`                    | `{ index, since }`: current section (0 before the first boundary) and frames since it started     |
| `useOnset(map, { minStrength = 0.4, offset })`   | `{ since, strength }` of the latest onset at or above `minStrength` (`since` Infinity before one) |
| `useBeatConfidence(map, { fade = 0.5, offset })` | 1 where the beat is clear, 0 inside `lowConfidence` stretches; scale hits by it                   |
| `useTempo(map, { offset })`                      | `{ bpm, free, index }` of the current tempo segment (`bpm` null in free time)                     |
| `decay(since, fps, halfLife = 0.08)`             | 1 on a hit's frame, halving every `halfLife` seconds; 0 before the hit and once below 0.02        |

## Text

```tsx
<Text
  x={80}
  y={200}
  family="Inter"
  weight={800}
  size={72} // family may be an array: tried in order
  letterSpacing={-2}
  features={["tnum"]} // OpenType features
  maxWidth={520}
  lineHeight={30} // wrapping (also splits on "\n")
  anchor="start | middle | end"
  baseline="alphabetic | top | middle" // what y means; "middle" centres capitals on y
  fill="#fff"
  charStyle={({ index, count, line, char, offset, advance, size }) => ({ opacity, transform })}
>
  Hello
</Text>
```

- `charStyle` transforms are relative to each glyph's baseline-left corner, in px. `index`
  counts visible glyphs only (no spaces); `offset` is the character's position in the line's
  text, which is what to compare against when revealing a string character by character.
- `charAnimations.fade / rise / pop / slide / wave / type({ frame, fps, delay, stagger, … })`
  return ready-made `charStyle` functions. To combine two, call both and join their transforms
  (see the outro in the template's `compositions/profile`).
- `measureText(text, style)` gives the width of one line. `measureTextBlock(text, style)` gives
  `{ lines, width, height }` with wrapping. `fitFontSize(text, style, maxWidth)` gives the largest
  size that fits.

## Components

|                                                                                                  |                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<Appear at duration preset exitAt exitDuration distance origin>`                                | Entrance (and exit) wrapper. Presets: `fade up down left right scale pop`                                                                                                                                                                                                     |
| `<Once>`                                                                                         | Children's animations play once and hold their last frame; the rest keeps looping                                                                                                                                                                                             |
| `<Typewriter text start speed eraseAt caret>`                                                    | Typed single line with caret                                                                                                                                                                                                                                                  |
| `<SlotCounter value delay stagger turns>`                                                        | Rolling digits (`"1,284"`, `"42k"`). `slotCounterWidth()` measures it                                                                                                                                                                                                         |
| `<Pill text height padding fill stroke color>`                                                   | Rounded label sized to its text. `pillWidth()` measures it                                                                                                                                                                                                                    |
| `<PillRow items at stagger gap …pill>`                                                           | Row of pills popping in                                                                                                                                                                                                                                                       |
| `<DrawPath d progress>`                                                                          | Stroke that draws itself, 0 → 1                                                                                                                                                                                                                                               |
| `<CodeBlock lines file lang theme font start speed>`                                             | Editor card with highlighting and typing. Pass `tokens` (from `highlightCode()`) instead of `lines` for language-aware highlighting. See "Code highlighting" below. `codeBlockHeight()` measures it                                                                           |
| `<WindowFrame width height title font preset controls controlsSide titleAlign>`                  | Window chrome; children are clipped to the content area. See "Window frames" below                                                                                                                                                                                            |
| `<ProgressBar width value start marks>`                                                          | Track, fill and milestone dots                                                                                                                                                                                                                                                |
| `<Wipe colors duration direction>`                                                               | Slanted bands sweeping the frame. Put it in a `<Sequence>` at the cut                                                                                                                                                                                                         |
| `<Rings r color speed>`                                                                          | Decorative spinning rings                                                                                                                                                                                                                                                     |
| `<GlowOrb color r intensity style>`                                                              | Soft radial glow at (0, 0). Move it via `style.transform`                                                                                                                                                                                                                     |
| `<DotGrid color spacing fade>`                                                                   | Dotted backdrop                                                                                                                                                                                                                                                               |
| `<Series>` with `<Series.Scene duration>` and `<Series.Transition duration presentation easing>` | Scenes back to back with overlapping transitions (`transitions.fade() / slide(from) / push(from)`, or your own `Presentation`). A trailing transition carries the last scene into the first across the loop seam. `seriesTimeline()` gives the start frames, e.g. for markers |
| `<TextRotator words hold transition start effect>`                                               | A word that cycles in place ("I build [tools / games]"). `textRotatorWidth()` gives its width at a frame, to place the text after it; `rotatorState()` the timing                                                                                                             |
| `<Marquee width height itemWidth gap speed direction>`                                           | Endless scrolling strip. The speed is adjusted (`marqueeSpeed()`) so the loop is seamless                                                                                                                                                                                     |
| `<Reveal width height progress direction mode>`                                                  | Shows children through a rectangle: `"slide"` moves them in from behind an edge, `"wipe"` sweeps the edge across them. No clip ids                                                                                                                                            |
| `<Camera shots duration easing>`                                                                 | Pans and zooms between framed regions (`{ at, rect: [x, y, w, h] }`), zooming on a log scale. `cameraRect()` / `cameraTransform()` for custom use                                                                                                                             |
| `<ArcProgress r value from startAngle sweep track>`                                              | Ring, gauge or donut segment that fills along its arc. `arcPath()` gives the path data                                                                                                                                                                                        |
| `<FollowPath d progress rotate angleOffset>`                                                     | Moves children along a path, optionally facing the direction of travel                                                                                                                                                                                                        |
| `<Terminal lines width height font theme prompt speed>`                                          | Terminal window replaying typed commands and output, scrolling when full. `terminalTimeline()` gives when each line starts                                                                                                                                                    |
| `<Image src x y width height fit radius style>`                                                  | Embedded raster (or SVG) image, cropped to `fit` (`cover contain fill`) and rounded by `radius` (half the size for a circle). See "Images" below                                                                                                                              |
| `useSvgId(prefix)`                                                                               | Unique id for gradients, masks, clip paths                                                                                                                                                                                                                                    |

## Code highlighting

`<CodeBlock lines>` colors each line with `highlight()`, a small regex highlighter that knows no
language: it colors comments, strings, keywords, numbers and tags with the `CodeTheme`'s colors,
and constructs spanning lines (block comments, template literals) aren't recognized.

For accurate highlighting, `highlightCode(code, { lang, theme })` runs
[shiki](https://shiki.style/) (VS Code's TextMate grammars) and returns
`{ tokens, background, foreground }`. Pass `tokens` to `<CodeBlock>` instead of `lines`. It is
async: `await` it at the top of the composition. `lang` is any language shiki bundles (`"tsx"`,
`"rust"`, `"css"`, …). `theme` is one of shiki's themes (`"github-dark"`, …), a VS Code theme
object, or a `CodeTheme`: its colors are mapped onto the grammar's scopes, and its optional
`function` and `type` colors (default `text`) apply only here. `codeThemeToShiki()` gives that
mapping as a shiki theme.

```tsx
const { tokens } = await highlightCode(source, { lang: "tsx", theme: codeTheme });
// or, with a shiki theme, take its background for the card:
const dark = await highlightCode(source, { lang: "tsx", theme: "github-dark" });

<CodeBlock tokens={tokens} theme={codeTheme} width={640} font={font} />;
<CodeBlock tokens={dark.tokens} theme={{ ...codeTheme, background: dark.background }} width={640} font={font} />;
```

`tokens` from another highlighter work too: one array of `CodeToken` (`{ text, color?, weight? }`)
per line. A token without `color` uses `theme.text`. The theme's `background`, `header`,
`border`, `text` and `accent` still color the card. Bold tokens need a bold face of the code font
registered; italic and underline aren't drawn.

## Window frames

`preset` picks the look of `<WindowFrame>` (and `<Terminal>`, which passes `preset`,
`controls`, `controlsSide` and `titleAlign` on). Any of those props given explicitly, and
`barHeight` and `radius`, override the preset. Colors stay separate: `background`, `bar`,
`border`, `titleColor` and `controlColor` (default: `titleColor`).

| `preset`          | `controls`       | `controlsSide` | `titleAlign` | `barHeight` | `radius` |
| ----------------- | ---------------- | -------------- | ------------ | ----------- | -------- |
| `macos` (default) | `traffic-lights` | `start`        | `center`     | 40          | 14       |
| `windows`         | `glyphs`         | `end`          | `start`      | 32          | 8        |
| `gnome`           | `close`          | `end`          | `center`     | 40          | 12       |
| `plain`           | `none`           | `end`          | `center`     | 40          | 14       |

`controls`: `traffic-lights` (red, yellow, green circles), `dots` (three circles in
`controlColor`), `glyphs` (minimize, maximize, close), `close` (one × on a faint circle),
`none`. `titleAlign`: `start`, `center`, `end`, `left`, `right`. `start` and `end` (for the title
and the buttons) follow `useDirection()`: under `<DirectionProvider dir="rtl">` the buttons
move to the other side, mirrored. A centered title is centered on the whole bar, so keep it
short enough to clear the buttons.

```tsx
<WindowFrame preset="windows" titleAlign="center" width={480} height={300} title="app" font={font}>
  …
</WindowFrame>
```

## Images

```tsx
const avatar = await fetchImage("https://github.com/octocat.png?size=192"); // top of the module

<Image src={avatar} x={40} y={40} width={96} height={96} radius={48} />
<Image src="images/screenshot.png" width={480} height={300} fit="contain" />
<Image src={new URL("./photo.jpg", import.meta.url)} width={200} height={120} radius={12} />
```

- An SVG shown as an image (README, `<img>`) can't load anything, so images are embedded as
  `data:` URIs. `src` is a path relative to the project root, a file URL, or a `data:` URI;
  PNG, JPEG, GIF, WebP, AVIF and SVG work. An `http(s)` URL in `src` is an error: download it
  with `fetchImage(url)` at build time instead.
- `fetchImage(url)` downloads once per build and returns a `data:` URI. `loadImage(src)` returns
  one for a file, e.g. for a raw `<image href>` or a `<pattern>`.
- The bytes go in unchanged, in every output file. Use an image about twice its displayed size
  (GitHub avatars take `?size=`), and prefer WebP or JPEG for photos. The build warns above
  150 KB. The same image at the same size is stored once per file, however often it is drawn.
- Animate it through `style` (opacity, transform), which goes on a wrapping `<g>` so the rounded
  clip moves with it. An animated GIF plays at its own speed, out of step with the timeline.

## Fonts

```tsx
fonts: [
  ...fontsource("inter", { family: "Inter", weights: [400, 800] }),
  ...fontsource("noto-sans-jp", { family: "Noto Sans JP", weights: [400, 700], subsets: ["japanese"], fallback: true }),
  { family: "Brand", weight: 700, src: "fonts/Brand-Bold.otf", features: ["ss01"] },
];
```

- `fontsource(pkg, …)` points at `node_modules/@fontsource/<pkg>`. Add the package first, e.g.
  `pnpm add @fontsource/roboto`. Use the static `@fontsource/*` packages; `@fontsource-variable/*`
  WOFF2 files don't work with fontkit's variation support.
- Local files go in `fonts/`, with paths relative to the project root. TTF, OTF, WOFF, WOFF2 and
  TTC all work.
- `fallback: true` adds the family to the fallback chain: any character missing from the
  requested family comes from the fallback families, in registration order.
- The build warns about characters no registered font covers. Fix every such warning: the glyph
  is rendered as an empty box.
- Only the glyphs you use end up in the SVG, so large CJK fonts don't bloat the output.

See [text.md](text.md) for the details of text rendering.

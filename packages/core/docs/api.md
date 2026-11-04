# API reference

Everything is imported from `svgreel`:

```tsx
import { defineComposition, Text, spring, useCurrentFrame } from "svgreel";
```

The working examples are the best reference. They ship with the package, so in a project they
are at `node_modules/svgreel/examples/`: `demo-components` has one cell per component, and
`demo-text` covers text. The template's `compositions/profile` is a complete banner.

## Composition

```tsx
export default defineComposition({
  component: MyComp,          // renders a single root <svg>
  width: 1200, height: 600,   // output size (also the default viewBox)
  fps: 30,
  durationInFrames: 300,      // loop length
  fonts: [...],               // see "Fonts" below
  variants: { theme: ["dark", "light"] }, // one file per combination, see "Variants"
  stillFrame: 120,            // frame for *.still.svg (default: last)
  title: "Accessible label",
  markers: [{ frame: 0, label: "intro" }], // jump targets in the preview
});
```

|                                    |                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `useCurrentFrame()`                | Current frame, relative to the innermost `<Sequence>`                   |
| `useVideoConfig()`                 | `{ width, height, fps, durationInFrames }`                              |
| `useVariant()`                     | The variant being compiled, e.g. `{ theme: "dark", motion: "default" }` |
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
| `<CodeBlock lines file lang theme font start speed>`                                             | Editor card with highlighting and typing. `codeBlockHeight()` measures it                                                                                                                                                                                                     |
| `<WindowFrame width height title font>`                                                          | Window chrome; children are clipped to the content area                                                                                                                                                                                                                       |
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
| `useSvgId(prefix)`                                                                               | Unique id for gradients, masks, clip paths                                                                                                                                                                                                                                    |

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

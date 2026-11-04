# Composition rules

svgreel renders your component once per frame, diffs the frames, and turns every value that
changes into CSS `@keyframes`. That only works if the frames are comparable, which gives these
rules. Breaking one fails the build with a message pointing at the element.

## 1. Same element tree on every frame

Don't add or remove elements over time (`{frame > 30 && <Foo />}`). Render everything on every
frame and hide it with `opacity`, `visibility` or `<Sequence>`, which sets `visibility: hidden`
outside its range.

Branching on props or on `useVariant()` (theme, lang, …) is fine, because they don't change
between frames.
For the same reason, don't use `Math.random()`: use `random(seed)`, which gives the same value
on every frame.

## 2. Only CSS-animatable properties may change

These may differ between frames:

`transform` · `opacity` · `visibility` · `fill` · `fill-opacity` · `stroke` · `stroke-opacity` ·
`stroke-width` · `stroke-dasharray` · `stroke-dashoffset` · `stop-color` · `stop-opacity` ·
`color` · `filter`

Geometry attributes (`x`, `y`, `cx`, `r`, `width`, `d`, `points`, …) must stay constant. Move,
scale and rotate with `transform` instead. To draw a line on, use `<DrawPath>`, which uses
`stroke-dashoffset`.

## 3. Animate `transform` through `style`, in CSS syntax

```tsx
<g style={{ transform: `translate(${x}px, ${y}px) rotate(${a}deg)` }}>   // ✓ animated
<g transform={`translate(${x} ${y})`}>                                   // ✓ static only
```

- Units are required in CSS syntax (`px`, `deg`).
- Don't put a static `transform` attribute and an animated CSS `transform` on the same element,
  because CSS overrides the attribute. Position with an outer `<g transform>` and animate an
  inner `<g style>`.
- The CSS transform origin is the element's local (0, 0). To spin something around its centre,
  draw it centred on the origin inside `<g transform="translate(cx cy)">`, or set
  `transformOrigin` in px.

## 4. Text only through `<Text>` (or components built on it)

Raw `<text>` would need web fonts, which GitHub's image proxy blocks, and text content can't
animate. `<Text>` emits glyph outlines. To change the words over time, render each version and
cross-fade them, or use `charStyle` to show and hide glyphs (see `<Typewriter>`).

## 5. Unique ids

`<clipPath>`, `<mask>`, gradients and patterns need ids. Use `useSvgId("name")`, or clip with a
nested `<svg overflow="hidden">`, which needs no id. Never hard-code an id inside a component
that can be rendered twice.

## 6. Keep keyframes cheap

Each distinct value is a potential keyframe. Some habits keep files small:

- Round animated numbers with `round()` (2 decimals). The compiler rounds to 3 anyway. For
  factors multiplied by a large size (`scaleX` on a wide bar, dash fractions), round to 4
  (`round(v, 4)`): 0.01 of 1000 px is a 10 px jump, which shows as stutter.
- Freeze idle motion when it can't be seen, e.g. `Math.min(frame, sceneEnd)` for an element that
  is hidden after its scene.
- Prefer one transform on a group over animating many children the same way.
- Periodic motion (`Math.sin`, rotations) should complete whole cycles over the composition's
  length so the loop has no jump: for a period in frames, pick a divisor of `durationInFrames`.
  `oscillate()` and `loopPeriod()` do this for you.

## 7. Looping

The SVG loops forever, and frame `durationInFrames` is frame 0 again. Plan the seam: either
return to the opening state at the end, or cover the cut with a transition (the `profile`
composition runs one `<Wipe>` across the loop point). `presence(…, loop)` fades windows that
touch either end across the seam.

To play something only the first time (an intro that should stay put afterwards), wrap it in
`<Once>`. Its animations run a single time and hold their last frame, so its last frame must be
the state you want shown for good. The preview player restarts them on each loop; browsers and
GitHub play them once.

## 8. Reduced motion

Every build also writes `*.still.svg` (the `still` value of the `motion` variant key). It's frame
`stillFrame` (default: the last frame), rendered with `useVariant().motion === "still"`, so the
component can show a better static version, e.g. everything at once. A still file has one frame,
so this branch may render a different tree. The animated SVG itself also stops at `stillFrame`
under `prefers-reduced-motion` (`<Once>` content shows its last frame).

## 9. Embed images

An SVG shown as an image loads nothing from the network, so `<image href="https://…">` stays
blank. Use `<Image>` (or `loadImage()` / `fetchImage()` for a raw `<image>`), which embeds the
file as a `data:` URI. Keep images small: they are copied into every output file.

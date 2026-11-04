# Text rendering

Text is shaped with [fontkit](https://github.com/foliojs/fontkit) at build time and written as
`<path>` outlines. The SVG needs no fonts and looks the same in every browser and in GitHub's
image proxy, which blocks external resources.

## What you get

- **Kerning and ligatures**: the font's default OpenType features (`kern`, `liga`, `calt`, …)
  are applied. Turn on extra ones per font (`FontSpec.features`) or per text (`<Text features>`):
  `tnum` for tabular numbers in counters, `palt` for tighter Japanese, `zero`, `ss01`, …
- **Fallback chains**: `family` can be a list, and fonts registered with `fallback: true` back up
  everything. Mixed Latin and Japanese text uses Inter for Latin and Noto Sans JP for the rest,
  shaped run by run.
- **Wrapping**: `maxWidth` breaks at spaces and between CJK characters, with basic Japanese
  kinsoku: no `、。」）ー` or small kana at a line start, no `「（` at a line end. Over-long words
  are split by character.
- **Shared glyphs**: each glyph outline is stored once (at a canonical 100-unit size) and reused
  through `<use>`, whatever size it's drawn at.

## Limits

- **No hinting.** Outlines are anti-aliased but not grid-fitted, so text under ~12 px on screen
  looks softer than native text. Remember the SVG is usually scaled down: a 1200-wide banner in a
  GitHub README renders at about 830 px (≈ 0.7×), so 16 px in the composition shows as ≈ 11 px.
  **Keep body text ≥ 18 px and labels ≥ 14 px in a 1200-wide composition.**
- **Precision**: outlines are rounded to 0.001 em, which is invisible below ~300 px font size.
- **No color emoji** (COLR/SVG glyphs). Draw emoji-like icons as paths instead.
- **Left-to-right, horizontal only.** Arabic or Hebrew shaping and vertical Japanese are not
  supported.
- **Variable fonts**: use static instances. fontkit can't apply variations to WOFF2 files.
- `<Typewriter>` handles one line. For multi-line typing, use several, or `charStyle` with
  `charAnimations.type`.

## Checking quality

`examples/demo-text` shows a size ladder, mixed scripts, wrapping and `palt`. To check a font
choice in a project, copy it into `compositions/` and build it. In this repository, run
`pnpm examples`. Look at it at 1 column in the preview, at 100 % zoom.

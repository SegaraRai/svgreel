# svgreel

## 0.3.0

### Minor Changes

- Language-aware code highlighting. `highlightCode(code, { lang, theme })` highlights code with shiki (VS Code's TextMate grammars) and returns tokens for `<CodeBlock>`'s new `tokens` prop, which replaces `lines`: `const { tokens } = await highlightCode(source, { lang: "tsx", theme: "github-dark" })`, then `<CodeBlock tokens={tokens} … />`. `theme` takes any of shiki's themes, a VS Code theme object, or your existing `CodeTheme`, whose new optional `function` and `type` colors apply to function and type names. Block comments, template literals and other multi-line constructs are now colored correctly. `tokens` also accepts runs from any other highlighter (`{ text, color?, weight? }` per line), and `codeBlockHeight()` accepts `tokens` too. `<CodeBlock lines>` and `highlight()` work as before.

### Patch Changes

- `<CodeBlock>`'s caret now moves with the typed text and reaches the end of each line: before, at speeds under one frame per character it jumped to the next line a few characters early, and waited out the line pause at the start of the next, still empty, line. It now rests at the end of the typed line until the next line starts, and no longer slides diagonally between lines.

- The caret of `<CodeBlock>`, `<Terminal>` and `<Typewriter>` no longer lags one character behind the typed text on some frames. With a fractional `speed`, floating-point error made it count one character too few.

- In the preview page, clicking an animated SVG plays or pauses it, like the play button. The transport buttons use icons, and the next-frame button shows a skip-forward icon, so it no longer looks like the play button.

## 0.2.0

### Minor Changes

- Params: declare tunable values with `params: defineParams({ accent: param.color("#7c3aed"), speed: param.number(1, { min: 0.5, max: 2 }) })` in `defineComposition` and read them with `useParams<typeof params>()`. Builders are `param.color`, `param.number`, `param.boolean`, `param.text` and `param.select`; each takes `label` and `description`, and a default can be a function of the variant (a color per theme). Unlike variants, params don't add files: every file uses the defaults, and `svgreel build --param accent=#f0a66a` overrides one for a build (repeatable; values are checked against the param, and a key no composition declares fails the build). The preview lists each composition's params with the values its files were built with.

- New tool `tools/render-video.mjs` renders a built composition to MP4 or WebM, frame-exact, with its `audio` mixed in at its offset (`node tools/render-video.mjs <name>`; options for scale, frame range, loops, variant and background, or `--frames` for a PNG sequence). The scripts in `node_modules/svgreel/tools/` are meant to be copied into your project's `tools/` and adapted; after updating svgreel, diff your copies against the new originals. Their requirements (Playwright and ffmpeg for video, uv for `beatmap.py`) are not svgreel dependencies. See `docs/tools.md`.

- Window styles: `<WindowFrame preset>` picks the look of the window chrome: `"macos"` (default, unchanged), `"windows"` (minimize, maximize and close glyphs on the right, title at the start), `"gnome"` (one close button on the right, centered title) or `"plain"` (no buttons). `controls` (`traffic-lights`, `dots`, `glyphs`, `close`, `none`), `controlsSide` (`start`, `end`), `titleAlign` (`start`, `center`, `end`, `left`, `right`), `barHeight` and `radius` override the preset, and `controlColor` colors the monochrome buttons. `<Terminal>` takes `preset`, `controls`, `controlsSide` and `titleAlign` too. `buttons={false}` still works but is deprecated in favor of `controls="none"`.

  Writing direction: wrap content in `<DirectionProvider dir="rtl">` and read the direction with `useDirection()` (`"ltr"` without a provider). `<WindowFrame>` uses it to put `start` and `end` on the right side, mirroring the buttons; text layout doesn't change yet.

- Faster builds: `svgreel build` compiles variants in parallel worker threads and renders frames with React's production build, and the compiler parses frames and holds them in memory more efficiently. A composition with many variants builds many times faster (svgreel's 40-file promo: 100 s → 7 s on 16 cores), with identical output. `--jobs <n>` (`-j`) caps the number of workers (default: one per CPU; `--jobs 1` compiles in the main thread, as before). Because React now runs in production mode, its development warnings (such as unknown props) no longer show; set `NODE_ENV=development` to get them back.

- Live param controls: `svgreel build --watch` now also serves the preview on `http://127.0.0.1:5331/` (`--port` to change it; the next free port is used if it is taken). There every param gets a control (color picker, slider for numbers with `min` and `max`, checkbox, text field or select), and a change re-renders the shown files in place, marked "live", without touching the files on disk. "copy --param" and "copy values" copy the changed values for a build command or for new defaults. Opening `dist/index.html` from disk works as before, with params shown read-only. Only one watch runs per output folder: running `--watch` again with the same options prints the running one's URL and exits; with other options or an updated svgreel, it replaces the old one on the same port.

- Audio and beat sync. A composition can set `audio: { src: "music.mp3", offset }`: the preview plays it in sync with the timeline (tick "sound"; under `--watch` the audio drives the clock), while the SVG stays silent and the file is copied to `dist/_audio/`, not into `dist/<name>/`. New beat-sync APIs work from a beat map: `useBeatGrid()` / `beatGrid()` give the frames of bars, beats and sections (`grid.bar(8)`, `grid.section(1)`, `grid.snap(frame, "bar")`) for placing scenes and text, with frames in the current `<Sequence>`'s time so they go straight into `from` and `delay`; `useBeat`, `useSection`, `useOnset`, `useBeatConfidence`, `useTempo` and `decay` drive motion that reacts to the music. The beat map comes from `tools/beatmap.py` (shipped in the package, run with `uv run`), which uses the Beat This! model to find beats, bars, tempo changes, additive meters, sections and attacks. See `docs/audio.md` and `examples/beat-sync`.

- Raster images: `<Image src width height fit radius>` embeds a PNG, JPEG, GIF, WebP, AVIF or SVG file as a `data:` URI, cropped with `fit` (`cover`, `contain`, `fill`) and rounded with `radius` (a circle for avatars). `src` takes a path relative to the project root, a file URL such as `new URL("./photo.jpg", import.meta.url)`, or a `data:` URI. To use a remote image such as a GitHub avatar, download it at build time with `const avatar = await fetchImage("https://github.com/<user>.png?size=192")` at the top of the composition module. `loadImage(src)` returns the `data:` URI for a raw `<image>` or `<pattern>`. An image drawn more than once at the same size is stored once per file. A raw `<image>` or `<feImage>` whose `href` points at a URL now fails the build, because SVGs shown as images never load it.

- `svgreel build --no-refresh` writes a preview page for publishing on a website: it doesn't reload `preview-data.js` every second to look for newer builds, and doesn't probe for the `--watch` server. Without the flag the preview behaves as before. The flag can't be combined with `--watch`.

### Patch Changes

- Built SVGs now start with a comment naming svgreel and its repository (`<!-- Built with svgreel: https://github.com/SegaraRai/svgreel -->`), and break lines after the opening `<svg>` tag, the comment and `</style>`, and before `</svg>`, so the file is easier to read. Each file grows by about 70 bytes; the drawing is unchanged.

- `svgreel build` now compiles compositions with [oxc-node](https://github.com/oxc-project/oxc-node) instead of tsx, so svgreel no longer depends on tsx and esbuild. Output is unchanged. A few edge cases behave differently: without a `jsx` option in your tsconfig, JSX now uses the automatic runtime (`react/jsx-runtime`) instead of `React.createElement`, and `require()` of a `.ts` file needs the `.ts` extension.

- The shipped examples are reorganized and restyled: `demo-motion`, `demo-components` and `demo-text` are now `animation`, `components` and `typography`, with a shared title header and captioned cards from `examples/_shared/showcase.tsx`. When you copy one of them into your project, copy `_shared/` with it.

## 0.1.0

### Minor Changes

- Variants are now keyed axes: `variants: defineVariants({ theme: ["dark", "light"], lang: ["en", "ja"] })` builds one SVG per combination, named `name-dark-en.svg`, and `useVariant()` reads the current values. The predefined keys are `theme`, `lang` and `motion`; other keys and values work too. Every build adds `motion: "still"` (files ending in `.still.svg`) for viewers who prefer reduced motion: render an overview when `useVariant().motion === "still"`. This replaces the `stillComponent` option and the previous object form of `variants`, which now fails with a message that shows the new form. The preview has a filter per key and generates the embed code, and the root `<svg>` gets a `lang` attribute when the variant has one.

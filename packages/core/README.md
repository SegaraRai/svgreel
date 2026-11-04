<h1>
  <picture>
    <source media="(prefers-color-scheme: dark) and (not (prefers-reduced-motion: reduce))" srcset="assets/logo-dark.svg">
    <source media="(not (prefers-reduced-motion: reduce))" srcset="assets/logo-light.svg">
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.still.svg">
    <img src="assets/logo-light.still.svg" alt="svgreel" width="240" height="84">
  </picture>
</h1>

Write motion graphics as React components (frame number in, picture out) and compile them
into **self-contained animated SVGs**: CSS keyframes for motion, glyph outlines for text. No
JavaScript, no web fonts, nothing external, so they work inside a GitHub README `<img>`.
Every build also writes a still version for viewers who prefer reduced motion.

**Want a profile banner without reading any of this?** Start from
[svgreel-template](https://github.com/SegaraRai/svgreel-template) and let an AI agent do the
work: its README has a prompt to paste.

## Quick look

```tsx
// compositions/hello/index.tsx
import { charAnimations, defineComposition, fontsource, Text, useCurrentFrame, useVideoConfig } from "svgreel";

function Hello() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <svg viewBox="0 0 1200 400">
      <rect width={1200} height={400} fill="#0d1117" />
      <Text
        x={80}
        y={240}
        family="Inter"
        weight={800}
        size={120}
        fill="#e6edf3"
        charStyle={charAnimations.rise({
          frame,
          fps,
          delay: 10,
        })}
      >
        Hello
      </Text>
    </svg>
  );
}

export default defineComposition({
  component: Hello,
  width: 1200,
  height: 400,
  fps: 30,
  durationInFrames: 90,
  fonts: fontsource("inter", {
    family: "Inter",
    weights: [800],
  }),
});
```

```sh
pnpm add svgreel react react-dom @fontsource/inter
pnpm svgreel build      # → dist/hello/hello.svg, dist/hello/hello.still.svg, dist/index.html
```

`dist/index.html` is a preview page that works straight from disk, with no server. It has
play/pause, frame stepping, scrubbing, scene markers, speed control, dark/light backgrounds, and
synced side-by-side variants. It refreshes itself after every build. Under `--watch` it is also
served on localhost, with live controls for the composition's params.

## CLI

```text
svgreel build [names...] [--watch] [--port 5331] [--dir compositions] [--out dist] [--param key=value] [--no-refresh]
```

Each `<dir>/<name>/index.tsx` that default-exports `defineComposition(...)` becomes
`<out>/<name>/<name>[-<value>…].svg` plus `.still.svg`. Compositions are TypeScript + JSX and
are compiled on the fly (tsx); your `tsconfig.json` needs `"jsx": "react-jsx"`.

To publish the preview page on a website, build with `--no-refresh`: the page then stops checking
for newer builds, which it otherwise does every second by reloading `preview-data.js`.

## Docs

The docs ship with the package (`node_modules/svgreel/docs/`), so they always match the
installed version:

- [rules.md](docs/rules.md): what compositions may and may not do (read this first)
- [api.md](docs/api.md): components, animation helpers, fonts
- [text.md](docs/text.md): how text is rendered, and its limits
- [embedding.md](docs/embedding.md): using the output in a README or elsewhere
- [audio.md](docs/audio.md): a sound track in the preview, and timing motion to music
- [tools.md](docs/tools.md): optional scripts to copy into a project (video export, beat analysis)

Working examples are in [examples/](examples/), also shipped at `node_modules/svgreel/examples/`.

## How it works

1. The composition is rendered with `react-dom/server` once per frame.
2. The frames' SVG trees are compared, and only attributes and styles that change are kept.
3. Each changing property is simplified (Ramer–Douglas–Peucker: only keyframes that linear
   interpolation can't reproduce within tolerance survive) and emitted as CSS `@keyframes`.
4. Text is shaped with fontkit and emitted as paths; repeated glyphs share one `<defs>` entry.

The API is modelled on [Remotion](https://www.remotion.dev/) (`useCurrentFrame`, `<Sequence>`,
`interpolate`, `spring`) but doesn't depend on it.

## Requirements

Node.js 22.12+, React 19 (peer dependency).

## License

[MIT](LICENSE). SVGs you generate are yours; the license covers this code, not your output.

<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark) and (not (prefers-reduced-motion: reduce))" srcset="packages/core/assets/logo-dark.svg">
    <source media="(not (prefers-reduced-motion: reduce))" srcset="packages/core/assets/logo-light.svg">
    <source media="(prefers-color-scheme: dark)" srcset="packages/core/assets/logo-dark.still.svg">
    <img src="packages/core/assets/logo-light.still.svg" alt="svgreel" width="240" height="84">
  </picture>
</h1>

<p align="center">
  Motion graphics as React components, compiled into self-contained animated SVGs that work in a
  GitHub README. This repository holds the package and everything around it.
</p>

<!-- The promo is packages/core/examples/promo, in the viewer's language (apps/localize; languages in content.ts LANGS). -->
<p align="center">
<picture>
  <source media="(prefers-color-scheme: dark) and (not (prefers-reduced-motion: reduce))" srcset="https://svgreel-localize.roundtrip.dev/github/SegaraRai/svgreel/assets/promo-dark-%7Blang%7D.svg?langs=en%2Cja%2Czh-CN%2Czh-TW%2Cko%2Ces%2Cpt%2Cfr%2Cde%2Cru">
  <source media="(not (prefers-reduced-motion: reduce))" srcset="https://svgreel-localize.roundtrip.dev/github/SegaraRai/svgreel/assets/promo-light-%7Blang%7D.svg?langs=en%2Cja%2Czh-CN%2Czh-TW%2Cko%2Ces%2Cpt%2Cfr%2Cde%2Cru">
  <source media="(prefers-color-scheme: dark)" srcset="https://svgreel-localize.roundtrip.dev/github/SegaraRai/svgreel/assets/promo-dark-%7Blang%7D.still.svg?langs=en%2Cja%2Czh-CN%2Czh-TW%2Cko%2Ces%2Cpt%2Cfr%2Cde%2Cru">
  <img src="https://svgreel-localize.roundtrip.dev/github/SegaraRai/svgreel/assets/promo-light-%7Blang%7D.still.svg?langs=en%2Cja%2Czh-CN%2Czh-TW%2Cko%2Ces%2Cpt%2Cfr%2Cde%2Cru" alt="svgreel promo: write a React component where SVG = f(time), compile its frames into CSS keyframes, and get a self-contained animated SVG with outlined text, components, dark/light and language variants, and beat sync." width="100%">
</picture>
</p>

> [!TIP]
> svgreel is made to be used with an AI coding agent. To make your own animated SVG, paste this
> into Claude Code, Codex, Cursor or a similar agent. It sets everything up and asks you what to
> make.
>
> ```text
> Make me an animated SVG with the template at https://github.com/SegaraRai/svgreel-template.
> Read its AGENTS.md first and follow it. Start by asking me what to make.
> ```

| Directory                      | What it is                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| [packages/core](packages/core) | The [`svgreel`](https://www.npmjs.com/package/svgreel) npm package: compiler, components, CLI, preview |
| [template](template)           | The contents of [svgreel-template](https://github.com/SegaraRai/svgreel-template), synced by CI        |
| [apps/localize](apps/localize) | A Cloudflare Worker that serves the SVG matching the viewer's language                                 |
| [apps/website](apps/website)   | The website, [svgreel.roundtrip.dev](https://svgreel.roundtrip.dev/)                                   |

## Development

```sh
pnpm install
pnpm exec vp run check   # build svgreel, then format, lint, type check (and Stillwind checks)
pnpm exec vp run test    # unit tests in every workspace
pnpm exec vp run build   # svgreel, the template's compositions, the website
```

Record a change intent with `pnpm change` for user-visible changes to svgreel. See
[AGENTS.md](AGENTS.md) for the details and the release flow.

## License

[MIT](LICENSE)

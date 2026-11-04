<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="packages/core/assets/logo-dark.svg">
    <img src="packages/core/assets/logo-light.svg" alt="svgreel" width="240" height="84">
  </picture>
</h1>

Motion graphics as React components, compiled into self-contained animated SVGs that work in a
GitHub README. This repository holds the package and everything around it.

| Directory                      | What it is                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| [packages/core](packages/core) | The [`svgreel`](https://www.npmjs.com/package/svgreel) npm package: compiler, components, CLI, preview |
| [template](template)           | The contents of [svgreel-template](https://github.com/SegaraRai/svgreel-template), synced by CI        |
| [apps/localize](apps/localize) | A Cloudflare Worker that serves the SVG matching the viewer's language                                 |
| [apps/website](apps/website)   | The website (placeholder)                                                                              |

**Want a profile banner?** Start from
[svgreel-template](https://github.com/SegaraRai/svgreel-template). To use the package directly,
read [packages/core/README.md](packages/core/README.md).

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

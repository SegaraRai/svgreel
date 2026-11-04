# svgreel template

<a href="https://github.com/SegaraRai/svgreel">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/SegaraRai/svgreel/main/assets/logo-dark.svg">
    <img src="https://raw.githubusercontent.com/SegaraRai/svgreel/main/assets/logo-light.svg" alt="svgreel" width="240" height="84">
  </picture>
</a>

Make animated SVGs (GitHub profile banners, README headers, project showcases) by describing
them to an AI coding agent.

Under the hood, motion graphics are written as React components and compiled by
[svgreel](https://github.com/SegaraRai/svgreel) into a **single self-contained SVG**: CSS
keyframes for motion, glyph outlines for text. No JavaScript, no web fonts, nothing external, so
it works inside a GitHub README `<img>`. Every build also produces a still version for viewers
who prefer reduced motion.

## Use it with an AI agent

Paste one of these into Claude Code, Codex, Cursor or a similar coding agent.

**Starting from nothing** (the agent sets up a private copy for you):

```text
Make me an animated SVG with the template at https://github.com/SegaraRai/svgreel-template.
Read its AGENTS.md first and follow it. Start by asking me what to make.
```

**Already have your copy** (run the agent inside the folder):

```text
Read AGENTS.md and follow it to make me an animated SVG. Start by asking me what to make.
```

The agent asks what you want (content, size, colors, where it'll be shown), builds it, and gives
you a preview page to open in your browser. You can then ask for changes in plain words ("slower
intro", "try a warmer accent", "add my new project") and finally have it copied into your
README. It keeps notes in `PROJECT.md`, so next time it picks up where it left off.

## Use it by hand

Requires Node.js 22.12+ and [pnpm](https://pnpm.io/) (npm also works).

```sh
pnpm install
pnpm build            # every composition → dist/, plus dist/index.html
pnpm build profile    # just one
pnpm watch            # rebuild on save
pnpm check            # format, lint, type check (pnpm fix to auto-fix)
```

Open `dist/index.html` straight from disk; no server needed. It refreshes after every build and
has a player: play/pause, frame stepping, scrubbing, scene markers, speed, and dark/light/checker
backgrounds.

To make your own banner, edit `compositions/profile/content.ts` and rebuild, or copy the folder
to `compositions/<new-name>/` and change anything.

```text
compositions/   your SVGs, one folder each (profile/ is a complete example)
fonts/          font files that aren't on npm (create it when needed)
PROJECT.md      notes for the next session: what, where, decisions
```

The engine is the `svgreel` npm package; `pnpm up svgreel` brings in fixes and new
components. Its docs and more examples are in `node_modules/svgreel/docs` and
`node_modules/svgreel/examples`, or [on GitHub](https://github.com/SegaraRai/svgreel).

If this was useful, a ⭐ on this repository is appreciated.

## License

The template is [MIT](LICENSE). Your compositions and the SVGs you make are yours, under any
terms you like.

## Credits

Fonts are installed from [Fontsource](https://fontsource.org/): Inter, JetBrains Mono and Noto
Sans JP, all under the SIL Open Font License.

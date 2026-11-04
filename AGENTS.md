# Developing svgreel

This monorepo holds the `svgreel` npm package and the projects around it. End users don't work
here. They start from [svgreel-template](https://github.com/SegaraRai/svgreel-template), whose
contents live in `template/` and whose AGENTS.md is the user-facing workflow.

## Layout

```text
packages/core/    the svgreel package (name "svgreel")
  src/
    index.ts        public API (everything users import)
    timeline.tsx    defineComposition, useCurrentFrame, useVariant, <Sequence>
    variants.ts     variant axes (theme, lang, motion, custom) and output file names
    animation/      interpolate, spring, Easing, colors, helpers, charAnimations
    compiler/       per-frame render → tree diff → CSS keyframes
    fonts.ts        fontkit shaping, fallback chains, line breaking
    fontsource.ts   FontSpecs from @fontsource packages
    components/     Text, SlotCounter, CodeBlock, …
    cli/main.ts     `svgreel build`
  preview/          preview page (React), bundled to dist/preview by `vp build`
  docs/             user docs, shipped in the package
  examples/         demo compositions, shipped in the package; also the visual test bed
  assets/           README logo: copies of examples-dist/logo/logo-{light,dark}.svg (refresh after
                    changing examples/logo)
template/         the template repository's contents (package "my-svgreel")
apps/localize/    Cloudflare Worker (Hono): picks the SVG for the viewer's Accept-Language
apps/website/     the website (placeholder on Cloudflare Workers static assets)
.changeset/       pending change intents and the release ledger
scripts/          repository scripts, run with plain `node`
```

Workspace packages other than `svgreel` are private and named `@svgreel-internal/*`
(`my-svgreel` keeps the template's own name).

## Commands

Tooling is [Vite+](https://viteplus.dev) (`vp`) and pnpm. Shared versions are in the catalog in
`pnpm-workspace.yaml`; format, lint and the test project list are in the root `vite.config.ts`.

```sh
pnpm install
pnpm exec vp run check     # build svgreel, Stillwind lint/fmt check, then vp check (format, lint, types)
pnpm exec vp run fix       # auto-fix formatting (vp check --fix, stillwind fmt)
pnpm exec vp run test      # every workspace's unit tests (imports from "vite-plus/test")
pnpm exec vp run build     # svgreel (dist/), the template's compositions, the website
pnpm exec vp run examples  # packages/core/examples → packages/core/examples-dist/index.html
```

The template and apps type check against svgreel's built `dist/` types, so a bare `vp check`
fails until svgreel is built; the `check` task builds it first. Inside one package, `pnpm build`,
`pnpm test` and so on run that package's scripts.

Run `check`, `test` and `examples` before finishing a change, and look at the examples in the
preview when the change is visible.

## Change intents

- Record a change intent for each user-visible change to svgreel: run `pnpm change`, and commit
  the `.changeset/*.md` file with the change. Changes to the template, apps or tooling need none.
- Use `minor` for a new feature or, while 0.x, a breaking change, and `patch` for a fix.
  `versioning.maxBump` in `pnpm-workspace.yaml` keeps releases at minor or below.
- Write the summary for package users, because it becomes the `packages/core/CHANGELOG.md`
  entry and the GitHub Release notes. Describe what users can now do and what they must change.

## Rules

### packages/core

- **Public API = `src/index.ts`.** Anything exported there is used by people's compositions, so
  follow semver: breaking changes need a major version (or a minor one while 0.x) and a note in
  the release.
- **Keep docs in step.** A new export or prop goes into `docs/api.md`; a new restriction goes
  into `docs/rules.md`. Docs ship with the package and agents read them from `node_modules`.
- **Shared state must stay in one chunk.** The CLI and the library are separate entry points,
  but React contexts (`timeline.tsx`) and the font registry (`fonts.ts`) must be one instance.
  After changing the pack config, check that `dist/cli.js` and `dist/index.js` import them from
  the same chunk.
- **Output size matters.** Generated SVGs end up in READMEs. Watch the keyframe count printed by
  the build, and round animated values (see `round()` in `src/animation/helpers.ts`).
- **No Remotion code or dependency.** The API mirrors Remotion's names, but Remotion's license
  isn't compatible with an MIT template used by companies.
- Dependencies: keep runtime dependencies minimal (fontkit, htmlparser2, stillwind, tsx). The
  release-age and install-script protections in `pnpm-workspace.yaml` stay on.
- Paths in the rules above (`src/`, `docs/`, …) are relative to `packages/core/`.

### template

- `template/` is copied to svgreel-template by `.github/workflows/sync-template.yml`
  (`scripts/sync-template.ts`). The copy renames `template.pnpm-workspace.yaml` to
  `pnpm-workspace.yaml` (under its real name it would make `template/` a separate workspace
  root here) and replaces `"svgreel": "workspace:*"` with `^<packages/core version>`.
- The sync runs from `stable` and on published GitHub Releases, and waits until that svgreel
  version is on npm. The template here may use unreleased features; they reach users with the
  release.
- Keep the template's own dependency ranges as plain versions, not `catalog:`: the copy has no
  catalog. Its pnpm-workspace.yaml repeats the supply-chain settings for users.
- It's a user-facing starter: its README and AGENTS.md are written for template users and their
  agents, not for svgreel development.

### apps/localize

- `GET /github/<owner>/<repo>/<path with {lang}>.svg?langs=en,ja[&fallback=en][&ref=main]`
  fetches the file from raw.githubusercontent.com with `{lang}` replaced by the best match for
  Accept-Language (GitHub's camo proxy forwards the viewer's). It is a
  [Hono](https://hono.dev/) app; `src/app.ts` documents it.
- It serves other people's repository content: keep the path validation, the CSP header and the
  size limit. Tests call `createApp()` with a fake `fetch`; they never reach the network.
- `pnpm dev` and `pnpm deploy` use the `cf` CLI, which builds through `@cloudflare/vite-plugin`
  with `cloudflare.config.ts`. Production: `https://svgreel-localize.roundtrip.dev/`.

### apps/website

- A placeholder page built by Vite and served as Cloudflare Workers static assets
  (`cloudflare.config.ts`). Production: `https://svgreel.roundtrip.dev/`; Previews:
  `https://<branch>.svgreel-preview.roundtrip.dev/`. A Preview uses the domains of the last
  production deployment, so `stable` must deploy once before the first Preview.

## Stillwind

- The preview UI (`packages/core/preview/`) styles elements with [Stillwind](https://stillwind.dev/). Stillwind
  compiles Tailwind CSS v4 utilities in `style()` calls into element props and static CSS.
  Compositions and the compiler don't use it.
- Before you change styles, read the relevant Markdown docs in `node_modules/stillwind/docs/`.
  Start with `guides/recommended-practices.md`. `node_modules/stillwind/skills/stillwind/SKILL.md`
  lists the page for each task.
- After you change styles, run `pnpm exec stillwind lint --fix` and `pnpm exec stillwind fmt` in
  `packages/core`, and fix the remaining findings. `vp run check` fails on any finding.

## Releasing

Releases follow the change intents; nobody edits versions by hand.

1. Merging to `main` with pending intents makes the Version PR workflow open (or refresh) the
   `version/main` pull request: `pnpm version -r` bumps `packages/core/package.json`, writes
   `packages/core/CHANGELOG.md` and updates `.changeset/ledger.yaml`. The Release workflow
   verifies and packs that pull request.
2. Merging it runs the Release workflow on `main`: it stages svgreel on npm (environment
   `npm-release`) and drafts the GitHub Release `v<version>`.
3. The maintainer approves the staged version on npm with 2FA, then publishes the draft GitHub
   Release (GitHub creates the tag).
4. Fast-forward `stable` to the release commit. That deploys the production website and localize
   Worker, and syncs the template (the published GitHub Release also triggers the sync).

`main` deploys a Preview of the website on every push.

### GitHub environments

| Environment           | Workflow            | Branch   | Holds                                                    |
| --------------------- | ------------------- | -------- | -------------------------------------------------------- |
| `npm-release`         | `release.yml`       | `main`   | npm trusted publishing; `NPM_TOKEN` secret until trusted |
| `template-sync`       | `sync-template.yml` | `stable` | `TEMPLATE_REPO_TOKEN` secret (svgreel-template contents) |
| `website-preview`     | `deploy.yml`        | `main`   | `CLOUDFLARE_API_TOKEN` secret, `CLOUDFLARE_ACCOUNT_ID`   |
| `website-production`  | `deploy.yml`        | `stable` | `CLOUDFLARE_API_TOKEN` secret, `CLOUDFLARE_ACCOUNT_ID`   |
| `localize-production` | `deploy.yml`        | `stable` | `CLOUDFLARE_API_TOKEN` secret, `CLOUDFLARE_ACCOUNT_ID`   |

Restrict each environment to its branch in the repository settings. The template sync also
runs for release tags, so allow `v*` tags on `template-sync`.

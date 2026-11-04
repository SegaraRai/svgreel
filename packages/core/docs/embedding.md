# Using the output

## GitHub README (profile or repository)

Copy the files from `dist/<name>/` into the target repository, e.g. `assets/`, and reference them
with `<picture>`:

```html
<picture>
  <source
    media="(prefers-color-scheme: dark) and (not (prefers-reduced-motion: reduce))"
    srcset="./assets/banner-dark.svg"
  />
  <source media="(not (prefers-reduced-motion: reduce))" srcset="./assets/banner-light.svg" />
  <source media="(prefers-color-scheme: dark)" srcset="./assets/banner-dark.still.svg" />
  <img src="./assets/banner-light.still.svg" alt="Describe the banner's content here" width="100%" />
</picture>
```

- The first matching `<source>` wins. The animated files are only chosen when the browser can
  tell motion is allowed. Everything else, including old browsers that don't understand
  `not (…)`, falls back to the stills.
- GitHub evaluates `prefers-color-scheme` against the viewer's GitHub theme.
- Without dark/light variants, drop the `prefers-color-scheme` lines.
- The preview's **Embed code** button writes this markup for your composition's files, one block
  per language (or other key that a media query can't pick).
- Write a real `alt`: it's all screen-reader users and broken-image cases get.
- Reference the files with relative paths, as above. GitHub serves those straight from
  `raw.githubusercontent.com`, so a pushed update shows up quickly (the browser may keep the old
  file for up to 5 minutes). Absolute URLs to other hosts go through GitHub's camo proxy instead,
  which caches longer.

For a **profile README**, the repository is `<username>/<username>` (public), and `README.md` at
its root is shown on the profile page.

## Elsewhere

- **Websites**: `<img src="banner.svg">` works as-is. An inline `<svg>` works too, but its CSS
  class names (`.m`, `.a0`, `k0`, …) are generic: wrap it in a shadow root or an `<iframe>` if
  the page has its own styles.
- **Social preview images (og:image), Slack, X**: these need PNG or JPG; animated SVG is not
  accepted. Use the still SVG and convert it (e.g. open it in a browser and screenshot it, or
  use a converter such as `resvg`).
- **Docs sites (Docusaurus, VitePress, …)**: treat it like any image.

## Size budget

Animated SVGs here are usually 100–500 KB. GitHub serves files of a few MB without trouble, but
smaller loads faster. Embedded images (`<Image>`) count in full in every file. If a file grows
past ~1 MB, look at [rules.md](rules.md#6-keep-keyframes-cheap).

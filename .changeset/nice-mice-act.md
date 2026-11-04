---
"svgreel": minor
---

Raster images: `<Image src width height fit radius>` embeds a PNG, JPEG, GIF, WebP, AVIF or SVG file as a `data:` URI, cropped with `fit` (`cover`, `contain`, `fill`) and rounded with `radius` (a circle for avatars). `src` takes a path relative to the project root, a file URL such as `new URL("./photo.jpg", import.meta.url)`, or a `data:` URI. To use a remote image such as a GitHub avatar, download it at build time with `const avatar = await fetchImage("https://github.com/<user>.png?size=192")` at the top of the composition module. `loadImage(src)` returns the `data:` URI for a raw `<image>` or `<pattern>`. An image drawn more than once at the same size is stored once per file. A raw `<image>` or `<feImage>` whose `href` points at a URL now fails the build, because SVGs shown as images never load it.

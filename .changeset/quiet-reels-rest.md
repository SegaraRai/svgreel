---
"svgreel": minor
---

`svgreel build --no-refresh` writes a preview page for publishing on a website: it doesn't reload `preview-data.js` every second to look for newer builds, and doesn't probe for the `--watch` server. Without the flag the preview behaves as before. The flag can't be combined with `--watch`.

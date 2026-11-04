---
"svgreel": patch
---

Built SVGs now start with a comment naming svgreel and its repository (`<!-- Built with svgreel: https://github.com/SegaraRai/svgreel -->`), and break lines after the opening `<svg>` tag, the comment and `</style>`, and before `</svg>`, so the file is easier to read. Each file grows by about 70 bytes; the drawing is unchanged.

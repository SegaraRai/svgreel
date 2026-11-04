---
"svgreel": minor
---

Language-aware code highlighting. `highlightCode(code, { lang, theme })` highlights code with shiki (VS Code's TextMate grammars) and returns tokens for `<CodeBlock>`'s new `tokens` prop, which replaces `lines`: `const { tokens } = await highlightCode(source, { lang: "tsx", theme: "github-dark" })`, then `<CodeBlock tokens={tokens} … />`. `theme` takes any of shiki's themes, a VS Code theme object, or your existing `CodeTheme`, whose new optional `function` and `type` colors apply to function and type names. Block comments, template literals and other multi-line constructs are now colored correctly. `tokens` also accepts runs from any other highlighter (`{ text, color?, weight? }` per line), and `codeBlockHeight()` accepts `tokens` too. `<CodeBlock lines>` and `highlight()` work as before.

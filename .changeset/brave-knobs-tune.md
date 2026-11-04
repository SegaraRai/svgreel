---
"svgreel": minor
---

Params: declare tunable values with `params: defineParams({ accent: param.color("#7c3aed"), speed: param.number(1, { min: 0.5, max: 2 }) })` in `defineComposition` and read them with `useParams<typeof params>()`. Builders are `param.color`, `param.number`, `param.boolean`, `param.text` and `param.select`; each takes `label` and `description`, and a default can be a function of the variant (a color per theme). Unlike variants, params don't add files: every file uses the defaults, and `svgreel build --param accent=#f0a66a` overrides one for a build (repeatable; values are checked against the param, and a key no composition declares fails the build). The preview lists each composition's params with the values its files were built with.

---
"svgreel": patch
---

`svgreel build` now compiles compositions with [oxc-node](https://github.com/oxc-project/oxc-node) instead of tsx, so svgreel no longer depends on tsx and esbuild. Output is unchanged. A few edge cases behave differently: without a `jsx` option in your tsconfig, JSX now uses the automatic runtime (`react/jsx-runtime`) instead of `React.createElement`, and `require()` of a `.ts` file needs the `.ts` extension.

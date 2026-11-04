---
"svgreel": patch
---

The caret of `<CodeBlock>`, `<Terminal>` and `<Typewriter>` no longer lags one character behind the typed text on some frames. With a fractional `speed`, floating-point error made it count one character too few.

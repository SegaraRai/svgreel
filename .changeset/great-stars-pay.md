---
"svgreel": minor
---

Variants are now keyed axes: `variants: defineVariants({ theme: ["dark", "light"], lang: ["en", "ja"] })` builds one SVG per combination, named `name-dark-en.svg`, and `useVariant()` reads the current values. The predefined keys are `theme`, `lang` and `motion`; other keys and values work too. Every build adds `motion: "still"` (files ending in `.still.svg`) for viewers who prefer reduced motion: render an overview when `useVariant().motion === "still"`. This replaces the `stillComponent` option and the previous object form of `variants`, which now fails with a message that shows the new form. The preview has a filter per key and generates the embed code, and the root `<svg>` gets a `lang` attribute when the variant has one.

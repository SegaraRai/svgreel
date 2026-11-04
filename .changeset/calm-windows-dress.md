---
"svgreel": minor
---

Window styles: `<WindowFrame preset>` picks the look of the window chrome: `"macos"` (default, unchanged), `"windows"` (minimize, maximize and close glyphs on the right, title at the start), `"gnome"` (one close button on the right, centered title) or `"plain"` (no buttons). `controls` (`traffic-lights`, `dots`, `glyphs`, `close`, `none`), `controlsSide` (`start`, `end`), `titleAlign` (`start`, `center`, `end`, `left`, `right`), `barHeight` and `radius` override the preset, and `controlColor` colors the monochrome buttons. `<Terminal>` takes `preset`, `controls`, `controlsSide` and `titleAlign` too. `buttons={false}` still works but is deprecated in favor of `controls="none"`.

Writing direction: wrap content in `<DirectionProvider dir="rtl">` and read the direction with `useDirection()` (`"ltr"` without a provider). `<WindowFrame>` uses it to put `start` and `end` on the right side, mirroring the buttons; text layout doesn't change yet.

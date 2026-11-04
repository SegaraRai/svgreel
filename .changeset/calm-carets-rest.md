---
"svgreel": patch
---

`<CodeBlock>`'s caret now moves with the typed text and reaches the end of each line: before, at speeds under one frame per character it jumped to the next line a few characters early, and waited out the line pause at the start of the next, still empty, line. It now rests at the end of the typed line until the next line starts, and no longer slides diagonally between lines.

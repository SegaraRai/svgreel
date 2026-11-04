---
"svgreel": minor
---

Live param controls: `svgreel build --watch` now also serves the preview on `http://127.0.0.1:5331/` (`--port` to change it; the next free port is used if it is taken). There every param gets a control (color picker, slider for numbers with `min` and `max`, checkbox, text field or select), and a change re-renders the shown files in place, marked "live", without touching the files on disk. "copy --param" and "copy values" copy the changed values for a build command or for new defaults. Opening `dist/index.html` from disk works as before, with params shown read-only. Only one watch runs per output folder: running `--watch` again with the same options prints the running one's URL and exits; with other options or an updated svgreel, it replaces the old one on the same port.

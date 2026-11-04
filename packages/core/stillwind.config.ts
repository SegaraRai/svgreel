import { defineConfig, lintPresets } from "stillwind/config";

// Stillwind styles the preview UI only (preview/, bundled by `vp build`). Compositions and the
// compiler emit SVG with per-frame inline styles and don't use it.
export default defineConfig({
  projects: [
    {
      css: "./preview/stillwind.css",
      files: ["preview/**/*.{ts,tsx}"],
      lint: {
        extends: [lintPresets.recommended],
        rules: {
          "no-arbitrary-colors": "deny",
          "no-arbitrary-spacing": "deny",
          "no-arbitrary-breakpoints": "deny",
        },
      },
    },
  ],
});

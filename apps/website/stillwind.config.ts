import { defineConfig, lintPresets } from "stillwind/config";

export default defineConfig({
  projects: [
    {
      css: "./src/styles/stillwind.css",
      files: ["src/**/*.{astro,ts}"],
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

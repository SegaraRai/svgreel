import { defineConfig } from "vite-plus";

// Workspace-wide format, lint and test settings. Each package's own vite.config.ts holds its
// build and test config; `vp test` runs them all as projects.
export default defineConfig({
  fmt: {
    ignorePatterns: [
      "**/dist/**",
      "**/examples-dist/**",
      "**/.cloudflare/**",
      "**/.astro/**",
      "apps/website/public/**",
    ],
    printWidth: 120,
    sortPackageJson: true,
    astro: true,
  },
  lint: {
    ignorePatterns: [
      "**/dist/**",
      "**/examples-dist/**",
      "**/.cloudflare/**",
      "**/.astro/**",
      "apps/website/public/**",
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      curly: "warn",
      // Text is split into code points on purpose: that is the unit fontkit shapes and reports.
      "typescript/no-misused-spread": "off",
    },
  },
  test: {
    projects: ["packages/core/vite.config.ts", "apps/localize/vite.config.ts"],
  },
  // `vp run <task>` from the root. Type checks in template/ and apps/ import svgreel's built
  // types, so check and test build packages/core first.
  run: {
    tasks: {
      check: {
        command: "vp check",
        dependsOn: [
          "svgreel#build",
          "svgreel#lint:stillwind",
          "svgreel#fmt:stillwind:check",
          "@svgreel-internal/apps-website#lint:stillwind",
          "@svgreel-internal/apps-website#fmt:stillwind:check",
        ],
      },
      fix: {
        command: "vp check --fix",
        cache: false,
        dependsOn: ["svgreel#fmt:stillwind", "@svgreel-internal/apps-website#fmt:stillwind"],
      },
      test: {
        command: "vp test --run",
        dependsOn: ["svgreel#build"],
      },
      // dependsOn entries run in parallel, so the template's build (which runs svgreel's CLI)
      // starts only after svgreel's build.
      build: {
        command: "vp run my-svgreel#build",
        dependsOn: ["svgreel#build", "website:build"],
      },
      // The website embeds svgreel's preview page (dist/preview) with the examples built into it.
      "website:build": {
        command: "vp run @svgreel-internal/apps-website#build",
        dependsOn: ["svgreel#build"],
      },
      examples: {
        command: "vp run svgreel#examples",
      },
      // Long-running: rebuilds on save and serves the preview with live param controls. Through
      // vpx, so edits to packages/core/src apply on the next rebuild too.
      "examples:watch": {
        command: "vp run svgreel#examples:watch",
        cache: false,
      },
      // The template's compositions run svgreel's built CLI (dist/), so these build it first.
      // Extra arguments pass through: `vp run template:build profile --param accent=#f00`.
      "template:build": {
        command: "vp run my-svgreel#build",
        dependsOn: ["svgreel#build"],
      },
      // Long-running. Changes to packages/core need a restart (it runs the built CLI).
      "template:watch": {
        command: "vp run my-svgreel#watch",
        cache: false,
        dependsOn: ["svgreel#build"],
      },
    },
  },
});

import { defineConfig } from "vite-plus";

// Workspace-wide format, lint and test settings. Each package's own vite.config.ts holds its
// build and test config; `vp test` runs them all as projects.
export default defineConfig({
  fmt: {
    ignorePatterns: ["**/dist/**", "**/examples-dist/**", "**/.cloudflare/**"],
    printWidth: 120,
    sortPackageJson: true,
  },
  lint: {
    ignorePatterns: ["**/dist/**", "**/examples-dist/**", "**/.cloudflare/**"],
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
        dependsOn: ["svgreel#build", "svgreel#lint:stillwind", "svgreel#fmt:stillwind:check"],
      },
      fix: {
        command: "vp check --fix",
        cache: false,
        dependsOn: ["svgreel#fmt:stillwind"],
      },
      test: {
        command: "vp test --run",
        dependsOn: ["svgreel#build"],
      },
      // dependsOn entries run in parallel, so the template's build (which runs svgreel's CLI)
      // starts only after svgreel's build.
      build: {
        command: "vp run my-svgreel#build",
        dependsOn: ["svgreel#build", "@svgreel-internal/apps-website#build"],
      },
      examples: {
        command: "vp run svgreel#examples",
      },
    },
  },
});

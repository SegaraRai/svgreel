import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { AstroIntegration } from "astro";

/**
 * Examples shown in the embedded preview at /examples/. `promo` is left out: it has ten
 * languages × two themes and weighs about 8 MB.
 */
export const EXAMPLES = ["animation", "components", "typography", "beat-sync", "logo"];

/** The four README logos, served at fixed URLs that svgreel-template's README links to. */
const BRAND_FILES = ["logo-light.svg", "logo-dark.svg", "logo-light.still.svg", "logo-dark.still.svg"];

/**
 * Before each build (and once when the dev server starts), writes generated files into public/:
 *
 * - public/examples/: `svgreel build` of EXAMPLES from packages/core/examples, with its preview page.
 * - public/brand/: copies of packages/core/assets/logo-*.svg.
 *
 * Both are gitignored. Like `vp run examples`, the CLI runs from source through oxc-node, and the
 * examples import svgreel's source (packages/core/tsconfig.json). The preview page comes from
 * dist/preview, so svgreel must be built first (`vp run svgreel#build`).
 */
export function svgreelAssets(): AstroIntegration {
  let publicDir = "";
  const generate = () => {
    const core = path.dirname(fileURLToPath(import.meta.resolve("svgreel/package.json")));

    const brand = path.join(publicDir, "brand");
    fs.mkdirSync(brand, { recursive: true });
    for (const file of BRAND_FILES) {
      fs.copyFileSync(path.join(core, "assets", file), path.join(brand, file));
    }

    const out = path.join(publicDir, "examples");
    fs.rmSync(out, { recursive: true, force: true });
    if (!fs.existsSync(path.join(core, "dist/preview"))) {
      throw new Error("svgreel's preview page is missing. Build svgreel first: vp run svgreel#build");
    }
    // The TypeScript loader the CLI registers for compositions, here also for the CLI itself.
    // Its "./register" export has only an "import" condition, so resolve the package instead.
    const oxcNode = path.dirname(createRequire(path.join(core, "package.json")).resolve("@oxc-node/core/package"));
    const loader = pathToFileURL(path.join(oxcNode, "register.mjs")).href;
    // From packages/core, so the examples compile with its tsconfig and resolve its fonts.
    const result = spawnSync(
      process.execPath,
      ["--import", loader, "src/cli/main.ts", "build", ...EXAMPLES, "--dir", "examples", "--out", out, "--no-refresh"],
      { cwd: core, stdio: "inherit" },
    );
    if (result.status !== 0) {
      throw new Error(`svgreel build failed (exit code ${result.status})`);
    }
  };

  return {
    name: "svgreel-assets",
    hooks: {
      "astro:config:done": ({ config }) => {
        publicDir = fileURLToPath(config.publicDir);
      },
      "astro:build:start": generate,
      "astro:server:setup": generate,
    },
  };
}

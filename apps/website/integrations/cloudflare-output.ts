import path from "node:path";
import { fileURLToPath } from "node:url";

import { cleanBuildOutputDir, writeAssets, writeRootConfig, writeWorkerConfig } from "@cloudflare/build-output-utils";
import { loadAndParseConfig } from "@cloudflare/config";
import type { AstroIntegration } from "astro";

/**
 * Writes Astro's static output as Cloudflare Build Output (.cloudflare/output), the input of
 * `cf deploy` and `cf previews deploy`.
 *
 * Those commands detect Astro and run `astro build`, then deploy .cloudflare/output. Astro's own
 * adapter (@astrojs/cloudflare) targets Wrangler and @cloudflare/vite-plugin v1, so this does what
 * @cloudflare/vite-plugin v2 does for an assets-only Worker: the Worker config from
 * cloudflare.config.ts, the built files as its assets, and the build context. `cf` sets
 * CLOUDFLARE_PREVIEW_BUILD=true for Preview builds.
 */
export function cloudflareOutput(): AstroIntegration {
  let root = "";
  return {
    name: "cloudflare-output",
    hooks: {
      "astro:config:done": ({ config }) => {
        root = fileURLToPath(config.root);
      },
      "astro:build:done": async ({ dir, logger }) => {
        const context = { isPreview: process.env.CLOUDFLARE_PREVIEW_BUILD === "true", mode: "production" };
        const { result } = await loadAndParseConfig(path.join(root, "cloudflare.config.ts"), context);
        if (!result.success) {
          throw new Error(`Invalid cloudflare.config.ts: ${result.error.message}`);
        }
        const { worker, accountId, complianceRegion } = result.data;
        if (!worker) {
          throw new Error("cloudflare.config.ts must define `worker`.");
        }
        await cleanBuildOutputDir(root);
        await writeAssets({ root, sourceDirectory: fileURLToPath(dir) });
        await writeWorkerConfig({ root, config: worker });
        await writeRootConfig(root, { accountId, complianceRegion }, context);
        logger.info(`Cloudflare Build Output written${context.isPreview ? " (Preview)" : ""}`);
      },
    },
  };
}

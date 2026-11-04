import { defineConfig } from "cf/config";

// Static assets from `vp build`. `stable` deploys production to svgreel.roundtrip.dev; `main`
// deploys a Preview to <preview>.svgreel-preview.roundtrip.dev (see .github/workflows/deploy.yml).
// Previews use the domains applied by the last production deployment.
export default defineConfig(({ isPreview }) => ({
  worker: {
    name: "svgreel-website",
    compatibilityDate: "2026-10-29",
    workersDev: false,
    previewUrls: true,
    domains: [
      ...(isPreview ? [] : ["svgreel.roundtrip.dev"]),
      {
        hostname: "svgreel-preview.roundtrip.dev",
        production: false,
        previews: true,
      },
    ],
    assets: {
      htmlHandling: "drop-trailing-slash",
      notFoundHandling: "404-page",
    },
  },
}));

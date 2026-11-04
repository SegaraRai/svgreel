import { defineConfig } from "cf/config";

// An assets-only Worker. `cf deploy` runs `astro build`, and integrations/cloudflare-output.ts
// writes dist/ with this config as the Build Output. `stable` deploys production to
// svgreel.roundtrip.dev; `main` deploys a Preview to <preview>.svgreel-preview.roundtrip.dev (see
// .github/workflows/deploy.yml). Previews use the domains applied by the last production deployment.
// auto-trailing-slash: /examples/ (an index.html in a folder) keeps its slash, so the embedded
// preview's relative URLs resolve.
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
      htmlHandling: "auto-trailing-slash",
      notFoundHandling: "404-page",
    },
  },
}));

import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "svgreel-localize",
    compatibilityDate: "2026-10-29",
    entrypoint: "./src/index.ts",
    workersDev: false,
    domains: ["svgreel-localize.roundtrip.dev"],
  },
});

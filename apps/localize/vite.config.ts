import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";

export default defineConfig({
  root: import.meta.dirname,
  // `cf dev` and `cf build` run the Worker through the plugin; unit tests call the Hono app directly.
  plugins: process.env.VITEST ? [] : [cloudflare()],
  test: {
    name: "localize",
    include: ["src/**/*.test.ts"],
  },
});

import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";

// Placeholder: a static page. `vp build` and `cf build` read cloudflare.config.ts through the plugin.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [cloudflare()],
});

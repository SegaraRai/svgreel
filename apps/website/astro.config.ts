import { stillwind } from "@stillwind/integration/astro";
import { defineConfig } from "astro/config";

import { cloudflareOutput } from "./integrations/cloudflare-output.ts";
import { svgreelAssets } from "./integrations/examples.ts";

// A static site. `cf deploy` runs `astro build`; cloudflareOutput() turns dist/ into the Build Output
// it deploys (see cloudflare.config.ts).
export default defineConfig({
  site: "https://svgreel.roundtrip.dev",
  trailingSlash: "ignore",
  integrations: [svgreelAssets(), stillwind(), cloudflareOutput()],
});

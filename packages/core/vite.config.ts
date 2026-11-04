import { stillwind } from "@stillwind/integration/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  root: import.meta.dirname,

  // `vp build`: the preview UI (preview/) as one classic script + Stillwind's stylesheet, so a
  // project's dist/index.html works straight from file://. The CLI copies these files into each
  // project and links the stylesheet listed in stillwind-manifest.json.
  // stillwind() compiles style() calls, so it must run before the JSX transform.
  plugins: [stillwind(), react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist/preview",
    emptyOutDir: true,
    lib: {
      entry: "preview/main.tsx",
      formats: ["iife"],
      name: "SvgreelPreview",
      fileName: () => "app.js",
    },
  },

  // `vp pack`: the library and CLI. Shared modules land in one chunk, so the CLI and user
  // compositions see the same React contexts and font registry. The CLI's compile workers load
  // worker.js by that name, next to the chunk with run.ts.
  pack: {
    entry: {
      index: "src/index.ts",
      cli: "src/cli/main.ts",
      worker: "src/cli/worker.ts",
    },
    format: ["esm"],
    dts: true,
    platform: "node",
    target: "node22",
    fixedExtension: false,
  },

  // `vp test`: unit tests next to the modules they cover.
  test: {
    name: "core",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./test-setup.ts"],
  },
});

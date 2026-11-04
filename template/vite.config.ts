import { defineConfig } from "vite-plus";

// Only used by `pnpm check` / `pnpm fix` (format + lint + type check). Builds use `svgreel build`.
export default defineConfig({
  fmt: {
    ignorePatterns: ["dist/**"],
    printWidth: 120,
    sortPackageJson: true,
  },
  lint: {
    ignorePatterns: ["dist/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});

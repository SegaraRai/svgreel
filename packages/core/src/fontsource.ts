import fs from "node:fs";
import path from "node:path";

import type { FontSpec } from "./fonts.js";

/** Finds node_modules/@fontsource/<pkg> from the current directory upwards. */
function packageDir(pkg: string): string {
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", "@fontsource", pkg);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    if (path.dirname(dir) === dir) {
      throw new Error(
        `@fontsource/${pkg} is not installed. Add it with \`pnpm add @fontsource/${pkg}\` (or npm install).`,
      );
    }
  }
}

/**
 * FontSpecs for a Fontsource package (`pnpm add @fontsource/<pkg>`), one per weight.
 *
 *   fontsource("inter", { family: "Inter", weights: [400, 800] })
 *   fontsource("noto-sans-jp", { family: "Noto Sans JP", subsets: ["japanese"], fallback: true })
 *
 * Several subsets become one face split across files.
 */
export function fontsource(
  pkg: string,
  {
    family,
    weights = [400],
    subsets = ["latin"],
    italic = false,
    ...rest
  }: {
    family: string;
    weights?: number[];
    subsets?: string[];
    italic?: boolean;
  } & Pick<FontSpec, "features" | "fallback">,
): FontSpec[] {
  const dir = packageDir(pkg);
  const style = italic ? "italic" : "normal";
  return weights.map((weight) => ({
    family,
    weight,
    src: subsets.map((s) => path.join(dir, "files", `${pkg}-${s}-${weight}-${style}.woff2`)),
    ...rest,
  }));
}

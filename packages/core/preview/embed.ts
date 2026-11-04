import { variantKeyLabel, variantValueLabel } from "../src/variants";
import type { CompositionData, Output } from "./types";

export interface Snippet {
  /** The fixed values of this snippet's files (e.g. "日本語"), or "" when there's only one. */
  label: string;
  html: string;
}

const MOTION_OK = "(not (prefers-reduced-motion: reduce))";
const DARK = "(prefers-color-scheme: dark)";

/**
 * `<picture>` markup for a README, as in docs/embedding.md: theme dark/light maps to
 * prefers-color-scheme and motion default/still to prefers-reduced-motion. The other keys (lang,
 * your own) can't be picked by a media query, so each combination of them gets its own snippet.
 */
export function embedSnippets(comp: CompositionData): Snippet[] {
  const themes = comp.variants.find(([k]) => k === "theme")?.[1] ?? [];
  const themed = themes.includes("dark") && themes.includes("light");
  const fixedKeys = comp.variants.map(([k]) => k).filter((k) => k !== "motion" && !(themed && k === "theme"));

  const groups = new Map<string, Output[]>();
  for (const o of comp.outputs) {
    const id = fixedKeys.map((k) => o.variant[k]).join("\0");
    groups.set(id, [...(groups.get(id) ?? []), o]);
  }

  const alt = comp.title ?? "Describe the image here";
  return [...groups.values()].map((outputs) => {
    const pick = (theme: string | undefined, motion: string) =>
      outputs.find((o) => o.variant.motion === motion && (theme === undefined || o.variant.theme === theme));
    // Each entry: [media query or undefined for the <img> fallback, output].
    const entries: [string | undefined, Output | undefined][] = [];
    const hasAnimated = outputs.some((o) => o.variant.motion === "default");
    const hasStill = outputs.some((o) => o.variant.motion === "still");
    const motions = hasAnimated && hasStill ? ["default", "still"] : [hasAnimated ? "default" : "still"];
    for (const [i, motion] of motions.entries()) {
      const last = i === motions.length - 1;
      const motionQuery = motion === "default" && !last ? MOTION_OK : undefined;
      if (themed) {
        entries.push([[DARK, motionQuery].filter(Boolean).join(" and "), pick("dark", motion)]);
        entries.push([last ? undefined : motionQuery, pick("light", motion)]);
      } else {
        entries.push([last ? undefined : motionQuery, pick(undefined, motion)]);
      }
    }
    const lines = entries.flatMap(([media, o]) => {
      if (!o) {
        return [];
      }
      const src = `./assets/${o.file}`;
      return media === undefined
        ? [`  <img src="${src}" alt="${alt}" width="100%" />`]
        : [`  <source media="${media}" srcset="${src}" />`];
    });
    const v = outputs[0].variant;
    const label =
      groups.size > 1
        ? fixedKeys
            .map((k) =>
              k === "lang" ? variantValueLabel(k, v[k]) : `${variantKeyLabel(k)}: ${variantValueLabel(k, v[k])}`,
            )
            .join(" · ")
        : "";
    return { label, html: ["<picture>", ...lines, "</picture>"].join("\n") };
  });
}

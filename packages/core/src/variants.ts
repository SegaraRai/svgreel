/**
 * Variant axes: each key (theme, lang, motion, or your own) lists its values, and every
 * combination is compiled to its own file. Pure data helpers, shared by the CLI and the preview.
 */

/** Keys and values svgreel knows: the preview labels them and maps them to media features. */
export interface PredefinedVariants {
  theme: "dark" | "light";
  lang: "en" | "ja" | "en-US" | "ja-JP";
  motion: "default" | "still";
}

/** A predefined value (offered by autocomplete) or any other string. */
type Open<T extends string> = T | (string & {});

export type VariantAxes = {
  [K in keyof PredefinedVariants]?: readonly Open<PredefinedVariants[K]>[];
} & {
  [key: string]: readonly string[] | undefined;
};

/** One combination of values, as `useVariant()` returns it. `motion` is always set. */
export type VariantOf<A extends VariantAxes = VariantAxes> = {
  readonly [K in keyof A]: NonNullable<A[K]>[number];
} & {
  readonly motion: "motion" extends keyof A ? NonNullable<A["motion"]>[number] : PredefinedVariants["motion"];
};

export type Variant = Readonly<Record<string, string>> & { readonly motion: string };

/** Without a `motion` key, every combination gets an animated and a still file. */
export const DEFAULT_MOTION: readonly string[] = ["default", "still"];

/** Keeps the literal values, so `useVariant<typeof variants>()` is typed. */
export function defineVariants<const A extends VariantAxes>(axes: A): A {
  return axes;
}

const KEY = /^[A-Za-z][A-Za-z0-9_]*$/;
const VALUE = /^[A-Za-z0-9_-]+$/;

/** The axes with `motion` filled in and moved last; throws on invalid keys or values. */
export function normalizeAxes(axes: VariantAxes = {}): [string, readonly string[]][] {
  const entries = Object.entries(axes).filter(
    (e): e is [string, readonly string[]] => e[0] !== "motion" && e[1] !== undefined,
  );
  entries.push(["motion", axes.motion ?? DEFAULT_MOTION]);
  for (const [key, values] of entries) {
    if (!Array.isArray(values)) {
      throw new Error(
        `variants.${key} must be a list of values, like \`theme: ["dark", "light"]\`. Since 0.2, ` +
          "variants are axes; read the current one with useVariant() instead of props.",
      );
    }
    if (!KEY.test(key)) {
      throw new Error(`Invalid variant key "${key}": use letters, digits and _ (starting with a letter).`);
    }
    if (values.length === 0) {
      throw new Error(`Variant key "${key}" has no values.`);
    }
    for (const value of values) {
      if (!VALUE.test(value)) {
        throw new Error(`Invalid value "${value}" for variant key "${key}": use letters, digits, - and _.`);
      }
    }
    if (new Set(values).size !== values.length) {
      throw new Error(`Variant key "${key}" lists a value twice.`);
    }
  }
  return entries;
}

/** Every combination of the axes, in declaration order (motion varies fastest). */
export function expandVariants(axes?: VariantAxes): Variant[] {
  let out: Record<string, string>[] = [{}];
  for (const [key, values] of normalizeAxes(axes)) {
    out = out.flatMap((v) => values.map((value) => ({ ...v, [key]: value })));
  }
  return out as Variant[];
}

/** A still variant is compiled from a single frame, without animation. */
export function isStill(variant: Variant): boolean {
  return variant.motion === "still";
}

/**
 * `<name>-<value>-<value>…`, in key order. motion is special: "default" adds nothing, "still"
 * adds `.still`, any other value adds `-<value>`. So `banner-dark.svg`, `banner-dark.still.svg`.
 */
export function variantFileName(name: string, variant: Variant, keys: readonly string[]): string {
  const parts = [name, ...keys.filter((k) => k !== "motion").map((k) => variant[k])];
  const motion = variant.motion === "default" ? "" : variant.motion === "still" ? ".still" : `-${variant.motion}`;
  return `${parts.join("-")}${motion}.svg`;
}

/** Display names for predefined keys and values. Others are shown as written. */
export const VARIANT_LABELS: Record<string, { label: string; values: Record<string, string> }> = {
  theme: { label: "Theme", values: { dark: "Dark", light: "Light" } },
  lang: {
    label: "Language",
    values: { en: "English", ja: "日本語", "en-US": "English (US)", "ja-JP": "日本語 (日本)" },
  },
  motion: { label: "Motion", values: { default: "Animated", still: "Still" } },
};

export function variantKeyLabel(key: string): string {
  return VARIANT_LABELS[key]?.label ?? key;
}

export function variantValueLabel(key: string, value: string): string {
  return VARIANT_LABELS[key]?.values[value] ?? value;
}

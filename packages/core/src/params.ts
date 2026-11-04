/**
 * Params: named values a composition reads with `useParams()` (an accent color, a speed, a
 * title). Unlike variant axes they don't multiply the output files: every file is built with the
 * defaults, or with the values given by `svgreel build --param key=value`. Pure data helpers,
 * shared by the CLI, the compiler and the preview.
 */

import { parseColor } from "./animation/color.js";
import type { Variant } from "./variants.js";

/** A value, or a function of the variant being compiled (e.g. a color per theme). */
export type ParamDefault<T> = T | ((variant: Variant) => T);

interface ParamBase<K extends string, T> {
  readonly kind: K;
  readonly default: ParamDefault<T>;
  /** Shown in the preview instead of the key. */
  readonly label?: string;
  readonly description?: string;
}

export interface ColorParam extends ParamBase<"color", string> {}
export interface NumberParam extends ParamBase<"number", number> {
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}
export interface BooleanParam extends ParamBase<"boolean", boolean> {}
export interface TextParam extends ParamBase<"text", string> {
  readonly multiline?: boolean;
}
export interface SelectParam<O extends string = string> extends ParamBase<"select", O> {
  readonly options: readonly O[];
}

export type Param = ColorParam | NumberParam | BooleanParam | TextParam | SelectParam;

export type ParamSchema = { readonly [key: string]: Param };

type Common = Pick<ParamBase<string, unknown>, "label" | "description">;

/** Builders for `defineParams`: `param.color("#7c3aed")`, `param.number(1, { min: 0, max: 2 })`. */
export const param = {
  color: (value: ParamDefault<string>, options: Common = {}): ColorParam => ({
    ...options,
    kind: "color",
    default: value,
  }),
  number: (
    value: ParamDefault<number>,
    options: Common & { min?: number; max?: number; step?: number } = {},
  ): NumberParam => ({ ...options, kind: "number", default: value }),
  boolean: (value: ParamDefault<boolean>, options: Common = {}): BooleanParam => ({
    ...options,
    kind: "boolean",
    default: value,
  }),
  text: (value: ParamDefault<string>, options: Common & { multiline?: boolean } = {}): TextParam => ({
    ...options,
    kind: "text",
    default: value,
  }),
  select: <const O extends string>(
    options: readonly O[],
    value: ParamDefault<NoInfer<O>>,
    extra: Common = {},
  ): SelectParam<O> => ({ ...extra, kind: "select", options, default: value }),
};

type ValueOf<P extends Param> =
  P extends SelectParam<infer O> ? O : P extends NumberParam ? number : P extends BooleanParam ? boolean : string;

/** The values `useParams<typeof params>()` returns. */
export type ParamsOf<S extends ParamSchema = ParamSchema> = { readonly [K in keyof S]: ValueOf<S[K]> };

export type ParamValue = string | number | boolean;
export type ParamValues = Readonly<Record<string, ParamValue>>;

/** Keeps the literal types, so `useParams<typeof params>()` is typed. */
export function defineParams<const S extends ParamSchema>(schema: S): S {
  return schema;
}

const KEY = /^[A-Za-z][A-Za-z0-9_]*$/;

function check(key: string, p: Param, value: unknown): ParamValue {
  const fail = (msg: string): never => {
    throw new Error(`Param "${key}": ${msg}`);
  };
  switch (p.kind) {
    case "color":
      if (typeof value !== "string") {
        fail(`expected a color string, got ${JSON.stringify(value)}.`);
      }
      try {
        parseColor(value as string);
      } catch (e) {
        fail((e as Error).message);
      }
      return value as string;
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return fail(`expected a number, got ${JSON.stringify(value)}.`);
      }
      if ((p.min !== undefined && value < p.min) || (p.max !== undefined && value > p.max)) {
        fail(`${value} is outside ${p.min ?? "-∞"}…${p.max ?? "∞"}.`);
      }
      return value;
    }
    case "boolean":
      if (typeof value !== "boolean") {
        fail(`expected true or false, got ${JSON.stringify(value)}.`);
      }
      return value as boolean;
    case "text":
      if (typeof value !== "string") {
        fail(`expected a string, got ${JSON.stringify(value)}.`);
      }
      return value as string;
    case "select":
      if (!p.options.includes(value as string)) {
        fail(`${JSON.stringify(value)} is not one of ${p.options.map((o) => JSON.stringify(o)).join(", ")}.`);
      }
      return value as string;
    default:
      return fail(
        `unknown kind ${JSON.stringify((p as { kind: unknown }).kind)}. Build params with param.color() etc.`,
      );
  }
}

/** Parses a `--param` value (always a string on the command line) for the param's kind. */
export function parseParamValue(key: string, p: Param, raw: string): ParamValue {
  switch (p.kind) {
    case "number":
      return check(key, p, raw.trim() === "" ? NaN : Number(raw));
    case "boolean":
      if (raw === "true" || raw === "false") {
        return raw === "true";
      }
      throw new Error(`Param "${key}": expected true or false, got "${raw}".`);
    default:
      return check(key, p, raw);
  }
}

/**
 * The values for one variant: overrides (already parsed) where given, defaults elsewhere.
 * Throws on invalid keys, unknown override keys and values that don't fit the schema.
 */
export function resolveParams(
  schema: ParamSchema | undefined,
  variant: Variant,
  overrides: ParamValues = {},
): ParamValues {
  const out: Record<string, ParamValue> = {};
  for (const [key, p] of Object.entries(schema ?? {})) {
    if (!KEY.test(key)) {
      throw new Error(`Invalid param key "${key}": use letters, digits and _ (starting with a letter).`);
    }
    if (p.kind === "select" && p.options.length === 0) {
      throw new Error(`Param "${key}" has no options.`);
    }
    const value = key in overrides ? overrides[key] : typeof p.default === "function" ? p.default(variant) : p.default;
    out[key] = check(key, p, value);
  }
  for (const key of Object.keys(overrides)) {
    if (!(key in out)) {
      throw new Error(`Unknown param "${key}".`);
    }
  }
  return out;
}

/** The schema as JSON for the manifest (defaults left out: they can be functions). */
export interface ParamInfo {
  key: string;
  kind: Param["kind"];
  label?: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  multiline?: boolean;
  options?: string[];
}

export function describeParams(schema: ParamSchema | undefined): ParamInfo[] {
  return Object.entries(schema ?? {}).map(([key, p]) => {
    const { default: _, options, ...rest } = p as Param & { options?: readonly string[] };
    return { key, ...rest, ...(options && { options: [...options] }) };
  });
}

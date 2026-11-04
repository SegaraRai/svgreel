import { useEffect, useRef, useState } from "react";
import { style } from "stillwind/react";

import { parseColor } from "../src/animation/color";
import type { ParamInfo, ParamValue, ParamValues } from "../src/params";
import type { CompositionData, Output } from "./types";

/** True when the page is served by `svgreel build --watch`, which can re-render with new params. */
export function useLiveServer(): boolean {
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!location.protocol.startsWith("http")) {
      return;
    }
    fetch("/_svgreel/live")
      .then((r) => r.json() as Promise<{ live?: boolean }>)
      .then((r) => setLive(!!r.live))
      .catch(() => setLive(false));
  }, []);
  return live;
}

interface RenderState {
  /** Rendered outputs by file, from the latest response. */
  outputs: Record<string, Output>;
  error?: string;
  ms?: number;
  busy: boolean;
}

type RenderResponse = { outputs: Output[]; ms: number } | { error: string; retry?: boolean };

/** The edits that still fit the params: known keys, with a value of the param's kind. */
export function fittingEdits(params: ParamInfo[], edits: ParamValues): ParamValues {
  const out: Record<string, ParamValue> = {};
  for (const [key, value] of Object.entries(edits)) {
    const p = params.find((q) => q.key === key);
    const fits =
      p?.kind === "number"
        ? typeof value === "number"
        : p?.kind === "boolean"
          ? typeof value === "boolean"
          : p?.kind === "select"
            ? (p.options ?? []).includes(value as string)
            : p !== undefined && typeof value === "string";
    if (fits) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Re-renders `files` with `params` on the watch server. One request at a time: changes made while
 * one runs are sent together when it returns, so dragging a slider shows renders as they come.
 */
export function useLiveRender(
  enabled: boolean,
  name: string,
  files: string[],
  params: ParamValues,
  buildId: string,
): RenderState | undefined {
  const [state, setState] = useState<RenderState>();
  const queue = useRef<{ running: boolean; next?: string }>({ running: false });
  const active = enabled && Object.keys(params).length > 0;
  // Everything that should trigger a render, as one string (buildId: re-render after a rebuild).
  const request = active ? JSON.stringify({ name, files, params, buildId }) : undefined;

  useEffect(() => {
    if (!request) {
      // Don't show renders of earlier values when the next change starts rendering.
      setState(undefined);
      return;
    }
    const q = queue.current;
    const run = (body: string) => {
      q.running = true;
      setState((s) => ({ outputs: s?.outputs ?? {}, error: s?.error, ms: s?.ms, busy: true }));
      const {
        name: n,
        files: f,
        params: p,
      } = JSON.parse(body) as { name: string; files: string[]; params: ParamValues };
      void fetch("/_svgreel/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: n, files: f, params: p }),
      })
        .then((r) => r.json() as Promise<RenderResponse>)
        .catch((e: unknown): RenderResponse => ({ error: `The watch server didn't answer (${String(e)}).` }))
        .then((res) => {
          const next = q.next;
          q.next = undefined;
          q.running = false;
          setState((s) =>
            "error" in res
              ? res.retry
                ? // The server is rebuilding; the new build re-requests, so keep showing the last render.
                  { outputs: s?.outputs ?? {}, busy: true }
                : // Don't leave renders of earlier values marked live: the cards fall back to the files.
                  { outputs: {}, error: res.error, busy: !!next }
              : // Only the files of this response: others would show earlier values.
                { outputs: Object.fromEntries(res.outputs.map((o) => [o.file, o])), ms: res.ms, busy: !!next },
          );
          if (next) {
            run(next);
          }
        });
    };
    if (q.running) {
      q.next = request;
    } else {
      run(request);
    }
  }, [request]);

  return active ? state : undefined;
}

/** `#rrggbb` for `<input type="color">`, which takes nothing else (alpha is dropped). */
function toHex(color: string): string {
  try {
    const [r, g, b] = parseColor(color);
    return `#${[r, g, b]
      .map((c) =>
        Math.round(Math.min(255, Math.max(0, c)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
  } catch {
    return "#000000";
  }
}

const shellArg = (v: string) => (/^[\w#.,:%+@/-]+$/.test(v) ? v : `'${v.replace(/'/g, `'\\''`)}'`);

/** Buttons and selects, as in App.tsx. */
const control = style("px-2.25 py-0.75 bg-panel rounded-md border border-line cursor-pointer hover:border-muted");
const check = style("inline-flex items-center gap-1 cursor-pointer");
const chip = style(
  "inline-flex px-1.5 items-center gap-1 font-mono text-caption bg-panel rounded-sm border border-line",
);
const field = style("px-1.5 py-0.5 font-mono text-caption bg-panel rounded-sm border border-line");

/**
 * The composition's params. Read-only from a file (the values the files were built with); under
 * `svgreel build --watch` each one gets a control, and changes re-render the shown files.
 */
export function Params({
  comp,
  live,
  values,
  onChange,
  render,
}: {
  comp: CompositionData;
  live: boolean;
  values: ParamValues;
  onChange: (values: ParamValues) => void;
  render?: RenderState;
}) {
  const params = comp.params ?? [];
  if (!params.length) {
    return null;
  }
  const changed = Object.keys(values).length > 0;
  const set = (key: string, value: ParamValue | undefined) => {
    const next = { ...values };
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange(next);
  };
  const copy = (text: string) => void navigator.clipboard.writeText(text);

  return (
    <section {...style("flex px-4 pbe-2.5 flex-col gap-1.5")}>
      <div {...style("flex flex-wrap items-center gap-x-5 gap-y-1.5")}>
        <span {...style("text-muted")}>Params</span>
        {params.map((p) => {
          // A default can depend on the variant, so the files may use different values.
          const built = [...new Set(comp.outputs.map((o) => o.params?.[p.key]))].filter((v) => v !== undefined);
          const value = values[p.key];
          return (
            <span key={p.key} {...style("inline-flex items-center gap-1.5")} title={p.description}>
              <span>{p.label ?? p.key}</span>
              {live ? (
                <>
                  <Control param={p} value={value ?? built[0]} onChange={(v) => set(p.key, v)} />
                  {value !== undefined ? (
                    <button
                      {...style(control, "px-1.25 py-0 text-micro")}
                      title="Back to the built value"
                      onClick={() => set(p.key, undefined)}
                    >
                      ×
                    </button>
                  ) : (
                    built.length > 1 && <span {...style("text-micro text-muted")}>per variant</span>
                  )}
                </>
              ) : (
                built.map((v) => (
                  <code key={String(v)} {...style(chip)}>
                    {p.kind === "color" && <Swatch color={String(v)} />}
                    {typeof v === "string" && p.kind !== "color" ? JSON.stringify(v) : String(v)}
                  </code>
                ))
              )}
              {comp.overridden?.includes(p.key) && <span {...style("text-accent text-micro")}>--param</span>}
            </span>
          );
        })}
        {live && changed && (
          <span {...style("inline-flex items-center gap-1")}>
            <button
              {...style(control)}
              title="The changed values as --param options"
              onClick={() =>
                copy(
                  Object.entries(values)
                    .map(([k, v]) => `--param ${k}=${shellArg(String(v))}`)
                    .join(" "),
                )
              }
            >
              copy --param
            </button>
            <button
              {...style(control)}
              title="The changed values, to make them the defaults"
              onClick={() =>
                copy(
                  Object.entries(values)
                    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                    .join("\n"),
                )
              }
            >
              copy values
            </button>
            <button {...style(control)} onClick={() => onChange({})}>
              reset
            </button>
          </span>
        )}
      </div>
      {live && changed && (
        <div {...style("text-micro text-muted")} role="status">
          {render?.busy
            ? "Rendering…"
            : render?.error
              ? null
              : `Live render${render?.ms !== undefined ? ` in ${render.ms} ms` : ""}. The files on disk keep the built values.`}
          {render?.error && <span {...style("text-danger whitespace-pre-wrap")}>{render.error}</span>}
        </div>
      )}
    </section>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span {...style("inline-block size-2.5 bg-(--swatch) rounded-full border border-line", { "--swatch": color })} />
  );
}

function Control({
  param: p,
  value,
  onChange,
}: {
  param: ParamInfo;
  value: ParamValue | undefined;
  onChange: (v: ParamValue) => void;
}) {
  switch (p.kind) {
    case "color": {
      const v = String(value ?? "");
      return (
        <span {...style("inline-flex items-center gap-1")}>
          <input
            type="color"
            {...style("h-5 w-7 p-0 bg-transparent border-0 cursor-pointer")}
            value={toHex(v)}
            onChange={(e) => onChange(e.target.value)}
          />
          <TextField value={v} size={10} onCommit={onChange} />
        </span>
      );
    }
    case "number": {
      const v = Number(value ?? 0);
      const ranged = p.min !== undefined && p.max !== undefined;
      return ranged ? (
        <span {...style("inline-flex items-center gap-1.5")}>
          <input
            type="range"
            {...style("m-0 w-28 accent-accent")}
            min={p.min}
            max={p.max}
            step={p.step ?? "any"}
            value={v}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <code {...style("min-w-8 font-mono text-caption tabular-nums")}>{v}</code>
        </span>
      ) : (
        <input
          type="number"
          {...style(field, "w-20")}
          min={p.min}
          max={p.max}
          step={p.step ?? "any"}
          value={v}
          onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))}
        />
      );
    }
    case "boolean":
      return (
        <label {...style(check)}>
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        </label>
      );
    case "select":
      return (
        <select {...style(control)} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          {(p.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "text":
      return p.multiline ? (
        <textarea
          {...style(field, "w-56 align-middle")}
          rows={2}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type="text"
          {...style(field, "w-40")}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

/** Text that applies on Enter or blur, for values that are invalid while being typed (colors). */
function TextField({ value, size, onCommit }: { value: string; size: number; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => draft !== value && draft.trim() !== "" && onCommit(draft.trim());
  return (
    <input
      type="text"
      {...style(field)}
      size={size}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
    />
  );
}

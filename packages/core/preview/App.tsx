import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { style } from "stillwind/react";

import type { ParamValues } from "../src/params";
import { variantKeyLabel, variantValueLabel } from "../src/variants";
import { clock } from "./clock";
import { embedSnippets } from "./embed";
import { fittingEdits, Params, useLiveRender, useLiveServer } from "./Params";
import { SvgView } from "./SvgView";
import type { CompositionData, Output, PreviewData } from "./types";

type Bg = "auto" | "dark" | "light" | "checker";

/** Small persisted UI preference (falls back to in-memory when storage is unavailable). */
function usePref<T extends string | number>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(`svgreel:${key}`);
      return s === null ? initial : (JSON.parse(s) as T);
    } catch {
      return initial;
    }
  });
  const set = (next: T) => {
    setV(next);
    try {
      localStorage.setItem(`svgreel:${key}`, JSON.stringify(next));
    } catch {
      // ignore
    }
  };
  return [v, set] as const;
}

/** Re-loads preview-data.js every second and swaps in a newer build (works from file:// too). */
function useLiveData(): PreviewData | undefined {
  const [data, setData] = useState(window.__SVGREEL__);
  useEffect(() => {
    const id = setInterval(() => {
      const s = document.createElement("script");
      s.src = `preview-data.js?t=${Date.now()}`;
      s.onload = s.onerror = () => {
        s.remove();
        const next = window.__SVGREEL__;
        if (next && next.buildId !== data?.buildId) {
          setData(next);
        }
      };
      document.head.appendChild(s);
    }, 1000);
    return () => clearInterval(id);
  }, [data?.buildId]);
  return data;
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

/** Buttons and selects. */
const control = style("px-2.25 py-0.75 bg-panel rounded-md border border-line cursor-pointer hover:border-muted");
const check = style("inline-flex items-center gap-1 cursor-pointer");
const empty = style("px-4 py-12 text-center text-muted");

export function App() {
  const data = useLiveData();
  const comps = data?.compositions ?? [];
  const [selected, setSelected] = usePref("comp", comps[0]?.name ?? "");
  const comp = comps.find((c) => c.name === selected) ?? comps[0];
  const [bg, setBg] = usePref<Bg>("bg", "auto");
  const [cols, setCols] = usePref<number>("cols", 2);
  const [focus, setFocus] = useState<string | null>(null);
  // Hidden variant values, as "key=value". Stills start hidden: the animated files are the main output.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(["motion=still"]));
  const [embed, setEmbed] = useState(false);
  const live = useLiveServer();
  // Param values changed in the preview, per composition (only under --watch).
  const [paramEdits, setParamEdits] = useState<Record<string, ParamValues>>({});
  // Edits that no longer fit the schema (a param renamed or changed in the source) are dropped.
  const edits = comp ? fittingEdits(comp.params ?? [], paramEdits[comp.name] ?? {}) : {};

  useEffect(() => {
    if (comp) {
      clock.configure(comp.fps, comp.durationInFrames);
    }
    setFocus(null);
  }, [comp?.name, comp?.fps, comp?.durationInFrames]);

  const built = (comp?.outputs ?? []).filter(
    (o) => Object.entries(o.variant).every(([k, v]) => !hidden.has(`${k}=${v}`)) && (!focus || o.file === focus),
  );
  const render = useLiveRender(
    live,
    comp?.name ?? "",
    built.map((o) => o.file),
    edits,
    data?.buildId ?? "",
  );
  // Live renders replace the built files they cover; the rest show the built file until theirs arrives.
  const outputs = built.map((o) => render?.outputs[o.file] ?? o);

  if (!data) {
    return (
      <div {...style(empty)}>
        No build data found. Run <code>pnpm build</code> and reload.
      </div>
    );
  }

  const toggle = (id: string) => {
    const next = new Set(hidden);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setHidden(next);
  };

  return (
    <div {...style("flex min-h-screen flex-col")}>
      <header
        {...style(
          "flex px-4 py-2.5 flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-panel border-line border-b",
        )}
      >
        <nav {...style("flex flex-wrap gap-1")}>
          {comps.map((c) => (
            <button
              key={c.name}
              aria-current={c === comp ? "page" : undefined}
              {...style(control, "font-medium bg-transparent border-transparent", {
                "aria-[current=page]:": "bg-background border-line",
              })}
              onClick={() => setSelected(c.name)}
            >
              {c.error && (
                <span
                  {...style("inline-block mr-1.5 size-1.75 align-[1px] bg-danger rounded-full")}
                  title="Build failed"
                />
              )}
              {c.name}
            </button>
          ))}
        </nav>
        {comp && !comp.error && (
          <div {...style("text-muted tabular-nums")}>
            {comp.width}×{comp.height} · {comp.fps} fps · {(comp.durationInFrames / comp.fps).toFixed(1)} s
            {comp.stats && ` · ${comp.stats.keyframes} keyframes · built in ${comp.stats.ms} ms`}
            {" · "}
            {new Date(comp.builtAt).toLocaleTimeString()}
          </div>
        )}
      </header>

      {comp?.error ? (
        <pre {...style("overflow-auto m-4 p-4 text-danger whitespace-pre-wrap rounded-lg border border-danger")}>
          {comp.error}
        </pre>
      ) : comp ? (
        <>
          <div {...style("flex px-4 py-2.5 flex-wrap gap-x-5 gap-y-2")}>
            <Segmented label="Background" value={bg} options={["auto", "dark", "light", "checker"]} onChange={setBg} />
            <Segmented
              label="Columns"
              value={String(cols)}
              options={["1", "2", "3"]}
              onChange={(v) => setCols(Number(v))}
            />
            {comp.variants
              .filter(([, values]) => values.length > 1)
              .map(([key, values]) => (
                <Group key={key} label={variantKeyLabel(key)}>
                  {values.map((v) => (
                    <label key={v} {...style(check)}>
                      <input
                        type="checkbox"
                        checked={!hidden.has(`${key}=${v}`)}
                        onChange={() => toggle(`${key}=${v}`)}
                      />
                      {variantValueLabel(key, v)}
                    </label>
                  ))}
                </Group>
              ))}
            <button aria-expanded={embed} {...style(control)} onClick={() => setEmbed(!embed)}>
              {embed ? "Hide embed code" : "Embed code"}
            </button>
          </div>
          <Params
            comp={comp}
            live={live}
            values={edits}
            onChange={(v) => setParamEdits({ ...paramEdits, [comp.name]: v })}
            render={render}
          />
          {embed && <Embed comp={comp} />}
          <main
            {...style("grid px-4 pbe-4 flex-1 grid-cols-[repeat(var(--cols),minmax(0,1fr))] content-start gap-3", {
              "--cols": String(focus ? 1 : cols),
            })}
          >
            {outputs.map((o, i) => (
              <Card
                key={`${data.buildId}:${o.file}`}
                comp={comp}
                output={o}
                bg={bg}
                focused={focus === o.file}
                onFocus={() => setFocus(focus === o.file ? null : o.file)}
                live={o !== built[i]}
              />
            ))}
          </main>
          <Transport comp={comp} />
        </>
      ) : (
        <div {...style(empty)}>No compositions yet. Add compositions/&lt;name&gt;/index.tsx and run pnpm build.</div>
      )}
    </div>
  );
}

function Card({
  comp,
  output,
  bg,
  focused,
  onFocus,
  live,
}: {
  comp: CompositionData;
  output: Output;
  bg: Bg;
  focused: boolean;
  onFocus: () => void;
  /** Rendered with the preview's param values, not the file on disk. */
  live: boolean;
}) {
  // The card shows the SVG on GitHub's README backgrounds.
  const surface = bg === "auto" ? (output.variant.theme === "dark" ? "dark" : "light") : bg;
  const { motion, ...fixed } = output.variant;
  const values = Object.entries(fixed).map(([k, v]) => variantValueLabel(k, v));
  return (
    <figure
      data-surface={surface}
      {...style("overflow-hidden rounded-card border border-line", {
        "data-[surface=dark]:": "text-readme-dark-foreground bg-readme-dark",
        "data-[surface=light]:": "text-readme-light-foreground bg-readme-light",
        "data-[surface=checker]:":
          "text-readme-light-foreground bg-[image:repeating-conic-gradient(var(--color-checker)_0_25%,var(--color-readme-light)_0_50%)] bg-size-[20px_20px]",
      })}
    >
      <figcaption {...style("flex px-2.5 py-1.5 items-center justify-between gap-2 text-caption bg-tint")}>
        <span>
          {values.join(" · ") || "default"}{" "}
          <span {...style("ml-1 opacity-60")}>{variantValueLabel("motion", motion)}</span>
          {live && (
            <span {...style("ml-2 px-1 text-micro text-white bg-accent rounded-sm")} title="Live render, not saved">
              live
            </span>
          )}
        </span>
        <span {...style("flex items-center gap-2.5 tabular-nums opacity-80")}>
          {kb(output.bytes)}
          <a
            href={`${comp.name}/${output.file}`}
            target="_blank"
            rel="noreferrer"
            title="Open the SVG file"
            {...style("underline")}
          >
            open
          </a>
          <button
            {...style(control, "px-1.75 py-px bg-transparent border-current opacity-80 hover:border-current")}
            onClick={onFocus}
          >
            {focused ? "back" : "focus"}
          </button>
        </span>
      </figcaption>
      <SvgView svg={output.svg} animated={output.animated} />
    </figure>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (v: T) => void;
}) {
  return (
    <Group label={label}>
      <div {...style("flex")}>
        {options.map((o) => (
          <button
            key={o}
            aria-pressed={o === value}
            {...style(control, "-ml-px rounded-none first:rounded-l-md last:rounded-r-md", {
              "aria-pressed:": "relative text-white bg-accent border-accent",
            })}
            onClick={() => onChange(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </Group>
  );
}

/** README `<picture>` markup for the composition's files, one block per language etc. */
function Embed({ comp }: { comp: CompositionData }) {
  return (
    <section {...style("flex px-4 pbe-3 flex-col gap-3")}>
      {embedSnippets(comp).map((s) => (
        <div key={s.label} {...style("flex flex-col gap-1")}>
          <div {...style("flex items-center justify-between gap-2")}>
            <span {...style("text-muted")}>{s.label}</span>
            <button {...style(control)} onClick={() => void navigator.clipboard.writeText(s.html)}>
              copy
            </button>
          </div>
          <pre {...style("overflow-auto m-0 p-3 font-mono text-caption bg-panel rounded-lg border border-line")}>
            {s.html}
          </pre>
        </div>
      ))}
    </section>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div {...style("flex items-center gap-2")}>
      <span {...style("text-muted")}>{label}</span>
      {children}
    </div>
  );
}

const SPEEDS = [0.1, 0.25, 0.5, 1, 2];

function Transport({ comp }: { comp: CompositionData }) {
  useSyncExternalStore(clock.subscribe, clock.snapshot);
  const n = comp.durationInFrames;
  const frame = Math.floor(clock.frame);
  const marks = useMemo(
    () => [...comp.markers, { frame: comp.stillFrame, label: "still frame" }].sort((a, b) => a.frame - b.frame),
    [comp],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (
        t instanceof HTMLSelectElement ||
        t instanceof HTMLTextAreaElement ||
        // Inputs keep their keys, except checkboxes and the timeline (param sliders move themselves).
        (t instanceof HTMLInputElement && t.type !== "checkbox" && t.dataset.timeline === undefined)
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const f = Math.floor(clock.frame);
      if (e.key === " ") {
        clock.set({ playing: !clock.playing });
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        clock.set({ playing: false });
        clock.seek(f + (e.key === "ArrowLeft" ? -step : step));
      } else if (e.key === "Home") {
        clock.seek(0);
      } else if (e.key === "End") {
        clock.seek(n - 1);
      } else if (e.key === "[" || e.key === "]") {
        const i = SPEEDS.indexOf(clock.speed) + (e.key === "]" ? 1 : -1);
        clock.set({ speed: SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, i))] });
      } else if (e.key === "PageUp" || e.key === "PageDown") {
        const prev = [...marks].reverse().find((m) => m.frame < f);
        const next = marks.find((m) => m.frame > f);
        const target = e.key === "PageUp" ? prev : next;
        if (target) {
          clock.seek(target.frame);
        }
      } else {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n, marks]);

  return (
    <footer
      {...style(
        "sticky bottom-0 flex px-4 pbs-2.5 pbe-6 items-center gap-3.5 bg-panel border-line border-t max-sm:flex-wrap",
      )}
    >
      <div {...style("flex gap-1")}>
        <button
          {...style(control)}
          title="Previous frame (←, Shift+← = 10)"
          onClick={() => (clock.set({ playing: false }), clock.seek(frame - 1))}
        >
          ◀︎
        </button>
        <button
          {...style(control, "min-w-10.5")}
          title="Play / pause (Space)"
          onClick={() => clock.set({ playing: !clock.playing })}
        >
          {clock.playing ? "❚❚" : "▶︎"}
        </button>
        <button
          {...style(control)}
          title="Next frame (→, Shift+→ = 10)"
          onClick={() => (clock.set({ playing: false }), clock.seek(frame + 1))}
        >
          ▶︎
        </button>
      </div>
      <div {...style("relative min-w-30 flex-1 max-sm:mb-2 max-sm:-order-1 max-sm:basis-full")}>
        <input
          {...style("m-0 w-full accent-accent")}
          type="range"
          data-timeline
          min={0}
          max={n - 1}
          step={1}
          value={frame}
          onChange={(e) => {
            clock.set({ playing: false });
            clock.seek(Number(e.target.value));
          }}
        />
        <div {...style("absolute inset-x-2 inset-bs-full h-0")}>
          {marks.map((m) => {
            const mark = style.ref("mark");
            return (
              <button
                key={`${m.frame}:${m.label}`}
                data-still={m.label === "still frame" || undefined}
                {...style(
                  mark,
                  "absolute top-0 left-(--at) h-2 w-0.5 bg-muted rounded-[1px] -translate-x-px cursor-pointer data-still:bg-accent",
                  { "--at": `${(m.frame / Math.max(1, n - 1)) * 100}%` },
                )}
                title={`${m.label} (frame ${m.frame})`}
                onClick={() => clock.seek(m.frame)}
              >
                <span
                  {...style(
                    "absolute bottom-5.5 left-1/2 hidden px-1.5 py-0.5 text-background text-micro whitespace-nowrap bg-foreground rounded-sm -translate-x-1/2",
                    { [mark("hover")]: "block" },
                  )}
                >
                  {m.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div {...style("flex min-w-21 flex-col items-end tabular-nums")}>
        <span>
          {String(frame).padStart(String(n - 1).length, "0")} / {n - 1}
        </span>
        <span {...style("text-micro text-muted")}>{(clock.frame / comp.fps).toFixed(2)} s</span>
      </div>
      <select
        {...style(control)}
        title="Speed ([ and ])"
        value={clock.speed}
        onChange={(e) => clock.set({ speed: Number(e.target.value) })}
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}×
          </option>
        ))}
      </select>
      <label {...style(check)} title="Loop">
        <input type="checkbox" checked={clock.loop} onChange={(e) => clock.set({ loop: e.target.checked })} />
        loop
      </label>
    </footer>
  );
}

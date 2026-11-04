import { createContext, useContext, type ComponentType, type CSSProperties, type ReactNode } from "react";

import type { FontSpec } from "./fonts.js";
import type { ParamSchema, ParamsOf, ParamValues } from "./params.js";
import type { Variant, VariantAxes, VariantOf } from "./variants.js";

export interface VideoConfig {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export interface Marker {
  frame: number;
  label: string;
}

/** A sound track for the preview and for beat timing. It is never put into the SVG. */
export interface CompositionAudio {
  /** Audio file (mp3, wav, ogg, …), relative to the composition's folder: `"music.mp3"`. */
  src: string;
  /**
   * Seconds on the timeline at which the file's 0 s plays (default 0). Negative skips the start
   * of the file: -12 starts the composition 12 s into the song. Beat hooks apply it too.
   */
  offset?: number;
}

export interface Composition extends VideoConfig {
  component: ComponentType;
  /**
   * Variant axes: `{ theme: ["dark", "light"], lang: ["en", "ja"] }`. Every combination is
   * compiled to its own file; the component reads the current one with `useVariant()`. `motion`
   * defaults to `["default", "still"]`; "still" is compiled from `stillFrame` without animation.
   */
  variants?: VariantAxes;
  /**
   * Named values the component reads with `useParams()`: `{ accent: param.color("#7c3aed") }`.
   * They don't add files; `svgreel build --param accent=#f00` overrides the defaults.
   */
  params?: ParamSchema;
  /** Frame rendered for the static (reduced-motion) version. Defaults to the last frame. */
  stillFrame?: number;
  fonts?: FontSpec[];
  /** Accessible label put on the root <svg>. */
  title?: string;
  /** Named points on the timeline (scene starts, etc.), shown as jump targets in the preview. */
  markers?: Marker[];
  /**
   * Music or narration that the motion is timed to. The preview plays it in sync; the SVG stays
   * silent. See docs/audio.md.
   */
  audio?: CompositionAudio;
}

export function defineComposition(c: Composition): Composition {
  return c;
}

const FrameContext = createContext<number>(0);
/** The composition-level frame, unaffected by <Sequence>. */
const TimelineFrameContext = createContext<number>(0);
const ConfigContext = createContext<VideoConfig | null>(null);
const VariantContext = createContext<Variant>({ motion: "default" });
const ParamsContext = createContext<ParamValues>({});

export function TimelineProvider(props: {
  frame: number;
  config: VideoConfig;
  variant?: Variant;
  params?: ParamValues;
  children?: ReactNode;
}) {
  return (
    <ConfigContext.Provider value={props.config}>
      <VariantContext.Provider value={props.variant ?? { motion: "default" }}>
        <ParamsContext.Provider value={props.params ?? {}}>
          <TimelineFrameContext.Provider value={props.frame}>
            <FrameContext.Provider value={props.frame}>{props.children}</FrameContext.Provider>
          </TimelineFrameContext.Provider>
        </ParamsContext.Provider>
      </VariantContext.Provider>
    </ConfigContext.Provider>
  );
}

/**
 * Frame on the composition's own timeline, ignoring <Sequence> shifts. The audio track plays on
 * this timeline, so beat hooks use it. Internal: not exported from the package.
 */
export function useTimelineFrame(): number {
  return useContext(TimelineFrameContext);
}

/** The composition's audio offset in seconds (0 without audio). Internal. */
export function useAudioOffset(): number {
  const c = useContext(ConfigContext) as Partial<Composition> | null;
  return c?.audio?.offset ?? 0;
}

/** Current frame, relative to the innermost <Sequence>. Same semantics as Remotion. */
export function useCurrentFrame(): number {
  return useContext(FrameContext);
}

/**
 * The variant being compiled, e.g. `{ theme: "dark", lang: "ja", motion: "default" }`. Pass
 * `typeof variants` (from `defineVariants`) for literal value types.
 */
export function useVariant<A extends VariantAxes = VariantAxes>(): VariantOf<A> {
  return useContext(VariantContext) as VariantOf<A>;
}

/**
 * The composition's param values, e.g. `{ accent: "#7c3aed", speed: 1 }`: defaults, or the
 * values given with `--param`. Pass `typeof params` (from `defineParams`) for value types.
 */
export function useParams<S extends ParamSchema = ParamSchema>(): ParamsOf<S> {
  return useContext(ParamsContext) as ParamsOf<S>;
}

/** Writing direction: left-to-right or right-to-left. */
export type Direction = "ltr" | "rtl";

const DirectionContext = createContext<Direction>("ltr");

/**
 * Sets the writing direction for its children. Components that place things at a logical
 * "start" or "end" (such as `<WindowFrame>`) read it with `useDirection()`. Without a provider
 * the direction is "ltr". It doesn't change how `<Text>` lays out glyphs.
 */
export function DirectionProvider(props: { dir: Direction; children?: ReactNode }) {
  return <DirectionContext.Provider value={props.dir}>{props.children}</DirectionContext.Provider>;
}

/** The writing direction set by the nearest `<DirectionProvider>`, or "ltr". */
export function useDirection(): Direction {
  return useContext(DirectionContext);
}

export function useVideoConfig(): VideoConfig {
  const c = useContext(ConfigContext);
  if (!c) {
    throw new Error("useVideoConfig() called outside of a composition");
  }
  return c;
}

/**
 * Time-shifts its children and hides them outside [from, from + durationInFrames).
 *
 * Unlike Remotion, children are always rendered (only hidden), because the compiler needs the
 * same element tree on every frame to turn changes into CSS keyframes.
 */
export function Sequence(props: { from?: number; durationInFrames?: number; children: ReactNode }) {
  const parent = useCurrentFrame();
  const from = props.from ?? 0;
  const local = parent - from;
  const visible = local >= 0 && local < (props.durationInFrames ?? Infinity);
  return (
    <Shifted frame={local} style={{ visibility: visible ? "visible" : "hidden" }}>
      {props.children}
    </Shifted>
  );
}

/** A <g> whose children see `frame` as the current frame. Internal building block. */
export function Shifted(props: { frame: number; style: CSSProperties; children: ReactNode }) {
  return (
    <g style={props.style}>
      <FrameContext.Provider value={props.frame}>{props.children}</FrameContext.Provider>
    </g>
  );
}

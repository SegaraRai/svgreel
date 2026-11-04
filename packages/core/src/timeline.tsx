import { createContext, useContext, type ComponentType, type CSSProperties, type ReactNode } from "react";

import type { FontSpec } from "./fonts.js";
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

export interface Composition extends VideoConfig {
  component: ComponentType;
  /**
   * Variant axes: `{ theme: ["dark", "light"], lang: ["en", "ja"] }`. Every combination is
   * compiled to its own file; the component reads the current one with `useVariant()`. `motion`
   * defaults to `["default", "still"]`; "still" is compiled from `stillFrame` without animation.
   */
  variants?: VariantAxes;
  /** Frame rendered for the static (reduced-motion) version. Defaults to the last frame. */
  stillFrame?: number;
  fonts?: FontSpec[];
  /** Accessible label put on the root <svg>. */
  title?: string;
  /** Named points on the timeline (scene starts, etc.), shown as jump targets in the preview. */
  markers?: Marker[];
}

export function defineComposition(c: Composition): Composition {
  return c;
}

const FrameContext = createContext<number>(0);
const ConfigContext = createContext<VideoConfig | null>(null);
const VariantContext = createContext<Variant>({ motion: "default" });

export function TimelineProvider(props: {
  frame: number;
  config: VideoConfig;
  variant?: Variant;
  children?: ReactNode;
}) {
  return (
    <ConfigContext.Provider value={props.config}>
      <VariantContext.Provider value={props.variant ?? { motion: "default" }}>
        <FrameContext.Provider value={props.frame}>{props.children}</FrameContext.Provider>
      </VariantContext.Provider>
    </ConfigContext.Provider>
  );
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

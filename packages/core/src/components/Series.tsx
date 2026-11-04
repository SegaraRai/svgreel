import { Children, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from "react";

import { Easing, type EasingFn } from "../animation/easing.js";
import { round, tween } from "../animation/helpers.js";
import { Shifted, useCurrentFrame, useVideoConfig } from "../timeline.js";

/**
 * Style for one side of a transition. `progress` runs 0 → 1 over the overlap. `above` says
 * whether this scene is drawn on top of the other one (the later scene normally is; at a
 * wrapping transition the first scene is drawn below the last one), so a presentation can
 * animate whichever side is visible.
 */
export type Presentation = (
  progress: number,
  side: "enter" | "exit",
  ctx: { width: number; height: number; above: boolean },
) => CSSProperties;

type Direction = "left" | "right" | "up" | "down";

const offset = (dir: Direction, width: number, height: number, k: number) => {
  const [x, y] = { left: [-width, 0], right: [width, 0], up: [0, -height], down: [0, height] }[dir];
  return `translate(${round(x * k)}px, ${round(y * k)}px)`;
};

/** Built-in presentations for <Series.Transition>. */
export const transitions = {
  /** Cross-fade: the scene on top fades over the other. */
  fade:
    (): Presentation =>
    (p, side, { above }) =>
      above ? { opacity: round(side === "enter" ? p : 1 - p, 3) } : {},
  /**
   * The scene on top slides over the other: the new scene comes in from the `from` side, or (at
   * a wrapping transition, where the old scene is on top) the old scene leaves towards the
   * opposite side.
   */
  slide:
    (from: Direction = "right"): Presentation =>
    (p, side, { width, height, above }) => {
      if (!above) {
        return {};
      }
      const away = ({ left: "right", right: "left", up: "down", down: "up" } as const)[from];
      return { transform: side === "enter" ? offset(from, width, height, 1 - p) : offset(away, width, height, p) };
    },
  /** Both scenes move together: the new one pushes the old one out. */
  push:
    (from: Direction = "right"): Presentation =>
    (p, side, { width, height }) => {
      const away = ({ left: "right", right: "left", up: "down", down: "up" } as const)[from];
      return { transform: side === "enter" ? offset(from, width, height, 1 - p) : offset(away, width, height, p) };
    },
};

export interface SceneProps {
  /** Length in frames, including any overlap with neighbouring transitions. */
  duration: number;
  children?: ReactNode;
}

export interface TransitionProps {
  /** Overlap in frames between the scenes on either side. */
  duration: number;
  presentation?: Presentation;
  easing?: EasingFn;
}

/** Combines an entrance and an exit style: opacities multiply, transforms chain. */
function mergeStyles(a: CSSProperties, b: CSSProperties): CSSProperties {
  const out: CSSProperties = { ...a, ...b };
  if (a.opacity !== undefined && b.opacity !== undefined) {
    out.opacity = round(Number(a.opacity) * Number(b.opacity), 3);
  }
  if (a.transform && b.transform) {
    out.transform = `${a.transform} ${b.transform}`;
  }
  return out;
}

function Scene({ children }: SceneProps) {
  return <>{children}</>;
}

/** Marks an overlap; <Series> reads its props and renders nothing for it. */
const Transition: (props: TransitionProps) => null = () => null;

export interface SeriesSlot {
  start: number;
  duration: number;
  /** Frame range (relative to the series) where the scene transitions in or out. */
  enter?: { start: number; duration: number };
  exit?: { start: number; duration: number };
}

/**
 * Start frames of scenes played back to back with overlapping transitions, without rendering
 * anything (for markers and for placing other elements in sync). Numbers are scene lengths,
 * `{ transition }` an overlap between the neighbouring scenes. A trailing transition overlaps
 * the last scene with the first one across the loop seam; the first scene then starts at
 * `-transition` so its entrance ends at frame 0.
 *
 *   seriesTimeline([90, { transition: 15 }, 60]) // → starts 0 and 75, total 135
 */
export function seriesTimeline(items: (number | { transition: number })[]): { scenes: SeriesSlot[]; total: number } {
  const wrap = items.length > 1 && typeof items[items.length - 1] === "object" ? items[items.length - 1] : undefined;
  const wrapLen = typeof wrap === "object" ? wrap.transition : 0;
  const scenes: SeriesSlot[] = [];
  let cursor = wrapLen ? -wrapLen : 0;
  let pending: number | undefined = wrapLen || undefined;
  items.forEach((item, i) => {
    if (typeof item === "number") {
      const slot: SeriesSlot = { start: cursor, duration: item };
      if (pending !== undefined) {
        slot.enter = { start: cursor, duration: pending };
      }
      scenes.push(slot);
      cursor += item;
      pending = undefined;
      return;
    }
    if (i === items.length - 1) {
      return;
    }
    const prev = scenes[scenes.length - 1];
    const next = items[i + 1];
    if (!prev || typeof next !== "number") {
      throw new Error("seriesTimeline: a transition must sit between two scenes");
    }
    if (item.transition > Math.min(prev.duration, next)) {
      throw new Error(`seriesTimeline: transition of ${item.transition} frames is longer than a neighbouring scene`);
    }
    cursor -= item.transition;
    prev.exit = { start: cursor, duration: item.transition };
    pending = item.transition;
  });
  // The last scene ends where the first one (started at -wrapLen) comes round again.
  const total = cursor;
  if (wrapLen) {
    const last = scenes[scenes.length - 1];
    if (wrapLen > Math.min(last.duration, scenes[0].duration)) {
      throw new Error(`seriesTimeline: transition of ${wrapLen} frames is longer than a neighbouring scene`);
    }
    last.exit = { start: total - wrapLen, duration: wrapLen };
  }
  return { scenes, total };
}

/**
 * Scenes played one after another, with optional overlapping transitions:
 *
 *   <Series>
 *     <Series.Scene duration={90}><Intro /></Series.Scene>
 *     <Series.Transition duration={15} presentation={transitions.fade()} />
 *     <Series.Scene duration={60}><Stats /></Series.Scene>
 *     <Series.Transition duration={15} />   // trailing: last scene → first across the loop
 *   </Series>
 *
 * Each scene sees its own local frame (0 at its start) and is hidden outside its slot, as with
 * <Sequence>. Changing one scene's length moves everything after it. With a trailing
 * transition, the series' total length (see `seriesTimeline`) should equal the composition's
 * `durationInFrames`.
 */
export function Series({ children }: { children: ReactNode }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<SceneProps | TransitionProps>[];
  const layout = seriesTimeline(
    items.map((el) => {
      if (el.type === Scene) {
        return (el.props as SceneProps).duration;
      }
      if (el.type === Transition) {
        return { transition: (el.props as TransitionProps).duration };
      }
      throw new Error("<Series> children must be <Series.Scene> or <Series.Transition>");
    }),
  );
  const transitionProps: TransitionProps[] = items
    .filter((el) => el.type === Transition)
    .map((el) => el.props as TransitionProps);
  const wraps = items.length > 1 && items[items.length - 1].type === Transition;
  const scenes = items.filter((el) => el.type === Scene);

  return (
    <>
      {scenes.map((el, i) => {
        const slot = layout.scenes[i];
        let local = frame - slot.start;
        // The first scene of a wrapping series also plays its entrance at the end of the loop.
        if (wraps && i === 0 && frame >= layout.total + slot.start) {
          local = frame - layout.total - slot.start;
        }
        const visible = local >= 0 && local < slot.duration;
        // Presentations run on every frame (settled at 1 after an entrance, at 0 before an exit)
        // so the scene's style has the same properties on every frame.
        const side = (range: SeriesSlot["enter"], kind: "enter" | "exit", t: TransitionProps | undefined) => {
          if (!range || !t) {
            return {};
          }
          const ease = t.easing ?? Easing.inOut(Easing.cubic);
          const p = tween(local + slot.start - range.start, [0, range.duration], [0, 1], ease);
          const wrapping = wraps && ((kind === "enter" && i === 0) || (kind === "exit" && i === scenes.length - 1));
          const above = wrapping ? kind === "exit" : kind === "enter";
          return (t.presentation ?? transitions.fade())(p, kind, { width, height, above });
        };
        // Transition i sits between scenes i and i + 1; a wrapping one is the last in the list.
        const last = transitionProps[transitionProps.length - 1];
        const style = mergeStyles(
          side(slot.enter, "enter", i === 0 ? last : transitionProps[i - 1]),
          side(slot.exit, "exit", wraps && i === scenes.length - 1 ? last : transitionProps[i]),
        );
        return (
          <Shifted key={i} frame={local} style={{ visibility: visible ? "visible" : "hidden", ...style }}>
            {(el.props as SceneProps).children}
          </Shifted>
        );
      })}
    </>
  );
}

Series.Scene = Scene;
Series.Transition = Transition;

import type { ReactNode } from "react";

import { Easing, type EasingFn } from "../animation/easing.js";
import { round, tween } from "../animation/helpers.js";
import { spring } from "../animation/spring.js";
import { useCurrentFrame, useVideoConfig } from "../timeline.js";

type Preset = "fade" | "up" | "down" | "left" | "right" | "scale" | "pop";

export interface AppearProps {
  children: ReactNode;
  /** Local frame at which the entrance starts. */
  at?: number;
  /** Entrance length in frames (ignored by "pop", which springs). */
  duration?: number;
  preset?: Preset;
  /** Travel in px for up/down/left/right. */
  distance?: number;
  /** Local frame at which the exit starts (the entrance in reverse). Omit to stay. */
  exitAt?: number;
  exitDuration?: number;
  /** Pivot for scale / pop, in the children's coordinates. */
  origin?: [number, number];
  easing?: EasingFn;
}

/** Wraps children in an entrance (and optional exit) animation. */
export function Appear({
  children,
  at = 0,
  duration = 18,
  preset = "up",
  distance = 30,
  exitAt,
  exitDuration = 14,
  origin = [0, 0],
  easing = Easing.out(Easing.cubic),
}: AppearProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter =
    preset === "pop"
      ? spring({
          frame: frame - at,
          fps,
          config: {
            damping: 10,
            mass: 0.5,
          },
        })
      : tween(frame, [at, at + duration], [0, 1], easing);
  const exit =
    exitAt === undefined ? 0 : tween(frame, [exitAt, exitAt + exitDuration], [0, 1], Easing.in(Easing.cubic));
  const p = enter * (1 - exit);
  const off = (1 - p) * distance;
  const transform = {
    fade: "translate(0px, 0px)",
    up: `translate(0px, ${round(off)}px)`,
    down: `translate(0px, ${round(-off)}px)`,
    left: `translate(${round(off)}px, 0px)`,
    right: `translate(${round(-off)}px, 0px)`,
    scale: `scale(${round(0.6 + 0.4 * p)})`,
    pop: `scale(${round(Math.max(0, p))})`,
  }[preset];
  return (
    <g
      style={{
        opacity: round(Math.min(1, preset === "pop" ? p * 3 : p)),
        transform,
        transformOrigin: preset === "scale" || preset === "pop" ? `${origin[0]}px ${origin[1]}px` : undefined,
      }}
    >
      {children}
    </g>
  );
}

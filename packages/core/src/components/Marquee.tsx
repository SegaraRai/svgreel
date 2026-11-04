import type { ReactNode } from "react";

import { round } from "../animation/helpers.js";
import { useCurrentFrame, useVideoConfig } from "../timeline.js";

export interface MarqueeProps {
  x?: number;
  y?: number;
  /** Visible window; the strip is clipped to it. */
  width: number;
  height: number;
  /** Width of one copy of `children` (the strip repeats it with `gap` in between). */
  itemWidth: number;
  gap?: number;
  /** Approximate speed in px per frame; adjusted so the loop has no jump. */
  speed?: number;
  direction?: "left" | "right";
  /** One copy of the content, drawn from (0, 0). */
  children: ReactNode;
}

/**
 * How far the strip moves per frame: the speed closest to `speed` at which the composition's
 * length moves it a whole number of copies (at least one), so the loop is seamless.
 */
export function marqueeSpeed(speed: number, period: number, loop: number): number {
  return (Math.max(1, Math.round((speed * loop) / period)) * period) / loop;
}

/**
 * Content scrolling endlessly across a window: logos, tags, a news ticker.
 *
 * The strip moves in one straight line over the whole composition (one keyframe pair, no
 * per-cycle jumps), so it holds as many copies as that distance needs. Keep `speed` modest:
 * each extra copy is extra markup, not extra keyframes.
 */
export function Marquee({
  x = 0,
  y = 0,
  width,
  height,
  itemWidth,
  gap = 40,
  speed = 1,
  direction = "left",
  children,
}: MarqueeProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const period = itemWidth + gap;
  const v = marqueeSpeed(speed, period, durationInFrames);
  const travel = v * durationInFrames;
  const copies = Math.ceil((width + travel) / period) + 1;
  const shift = direction === "left" ? -frame * v : frame * v - travel;
  return (
    <svg x={x} y={y} width={width} height={height} overflow="hidden">
      <g style={{ transform: `translateX(${round(shift)}px)` }}>
        {Array.from({ length: copies }, (_, i) => (
          <g key={i} transform={`translate(${round(i * period)} 0)`}>
            {children}
          </g>
        ))}
      </g>
    </svg>
  );
}

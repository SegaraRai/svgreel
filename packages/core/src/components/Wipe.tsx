import { Easing } from "../animation/easing.js";
import { round, tween } from "../animation/helpers.js";
import { useCurrentFrame, useVideoConfig } from "../timeline.js";

export interface WipeProps {
  /** One slanted band per color, in order. */
  colors: string[];
  /** Frames for one band to cross. */
  duration?: number;
  /** Frames between consecutive bands. */
  gap?: number;
  /** Band width in px. */
  bandWidth?: number;
  /** Horizontal slant in px across the full height. */
  slant?: number;
  direction?: "right" | "left";
  opacity?: number[];
}

/**
 * Slanted color bands sweeping across the frame: a scene transition. Starts at local frame 0, so
 * put it in a <Sequence> at the cut.
 */
export function Wipe({
  colors,
  duration = 14,
  gap = 1.5,
  bandWidth = 220,
  slant = 200,
  direction = "right",
  opacity,
}: WipeProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const from = -bandWidth - slant;
  const to = width + slant;
  return (
    <g transform={direction === "left" ? `matrix(-1 0 0 1 ${width} 0)` : undefined}>
      {colors.map((c, i) => {
        const x = tween(frame, [i * gap, duration + i * gap], [from, to], Easing.inOut(Easing.cubic));
        return (
          <polygon
            key={i}
            points={`${slant},0 ${slant + bandWidth},0 ${bandWidth},${height} 0,${height}`}
            fill={c}
            opacity={opacity?.[i]}
            style={{ transform: `translateX(${round(x)}px)` }}
          />
        );
      })}
    </g>
  );
}

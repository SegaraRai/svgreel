import type { SVGProps } from "react";

import { round } from "../animation/helpers.js";

/**
 * Path data for a circular arc around (cx, cy), starting at `start` degrees (0 = 12 o'clock,
 * clockwise) and sweeping `sweep` degrees. A full circle is drawn as two halves, because a
 * single SVG arc command can't start and end at the same point.
 */
export function arcPath(cx: number, cy: number, r: number, start = 0, sweep = 360): string {
  const point = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${round(cx + r * Math.cos(a), 3)} ${round(cy + r * Math.sin(a), 3)}`;
  };
  const s = Math.max(-360, Math.min(360, sweep));
  const dir = s >= 0 ? 1 : 0;
  if (Math.abs(s) >= 360) {
    const half = start + (s > 0 ? 180 : -180);
    return `M${point(start)}A${r} ${r} 0 1 ${dir} ${point(half)}A${r} ${r} 0 1 ${dir} ${point(start)}`;
  }
  return `M${point(start)}A${r} ${r} 0 ${Math.abs(s) > 180 ? 1 : 0} ${dir} ${point(start + s)}`;
}

export interface ArcProgressProps extends Omit<
  SVGProps<SVGPathElement>,
  "d" | "style" | "pathLength" | "strokeDasharray" | "strokeDashoffset"
> {
  cx?: number;
  cy?: number;
  r: number;
  /** Filled fraction, 0 → 1. */
  value: number;
  /** Where the fill starts, 0 → 1 (for segments of a donut chart). */
  from?: number;
  /** Start angle in degrees (0 = 12 o'clock). */
  startAngle?: number;
  /** Total angle of the gauge in degrees (360 = full ring, 270 = speedometer). */
  sweep?: number;
  /** Track color behind the fill; omit for none. */
  track?: string;
}

/**
 * Ring / gauge / donut segment that fills along its arc. The arc is normalised with
 * `pathLength`, so `value` maps straight to the dash length; an empty fill is hidden so round
 * caps don't leave a dot.
 */
export function ArcProgress({
  cx = 0,
  cy = 0,
  r,
  value,
  from = 0,
  startAngle = 0,
  sweep = 360,
  track,
  stroke = "currentColor",
  strokeWidth = 8,
  strokeLinecap = "round",
  fill = "none",
  ...rest
}: ArcProgressProps) {
  const d = arcPath(cx, cy, r, startAngle, sweep);
  const a = Math.min(1, Math.max(0, from));
  const len = Math.min(1, Math.max(0, value)) - a;
  return (
    <g>
      {track && <path d={d} fill="none" stroke={track} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} />}
      <path
        d={d}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap={strokeLinecap}
        pathLength={1}
        style={{
          strokeDasharray: `${round(Math.max(0, len), 4)} 2`,
          strokeDashoffset: round(-a, 4),
          opacity: len > 0 ? 1 : 0,
        }}
        {...rest}
      />
    </g>
  );
}

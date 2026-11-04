import type { SVGProps } from "react";

import { round } from "../animation/helpers.js";

export interface DrawPathProps extends Omit<
  SVGProps<SVGPathElement>,
  "style" | "pathLength" | "strokeDasharray" | "strokeDashoffset"
> {
  d: string;
  /** 0 = nothing drawn, 1 = whole path drawn. */
  progress: number;
}

/** A stroked path that draws itself along its length as `progress` goes 0 → 1. */
export function DrawPath({
  d,
  progress,
  fill = "none",
  stroke = "currentColor",
  strokeWidth = 2,
  strokeLinecap = "round",
  strokeLinejoin = "round",
  ...rest
}: DrawPathProps) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <path
      d={d}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap={strokeLinecap}
      strokeLinejoin={strokeLinejoin}
      // pathLength normalises the dash units, so no length measurement is needed.
      pathLength={1}
      strokeDasharray="1 2"
      // Hidden at 0, where a round cap would otherwise leave a dot.
      style={{ strokeDashoffset: round(1 - p), opacity: p > 0 ? 1 : 0 }}
      {...rest}
    />
  );
}

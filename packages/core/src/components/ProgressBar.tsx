import { round } from "../animation/helpers.js";

export interface ProgressBarProps {
  x?: number;
  y?: number;
  width: number;
  height?: number;
  /** Filled part, 0..1. */
  value: number;
  /** Where the fill starts, 0..1 (animate it to make the tail chase the head). */
  start?: number;
  /** Positions (0..1) of dots along the track, e.g. scene starts. Dots before `value` are lit. */
  marks?: number[];
  track?: string;
  fill?: string;
  markColor?: string;
}

/** A thin track with a fill and optional milestone dots. */
export function ProgressBar({
  x = 0,
  y = 0,
  width,
  height = 2,
  value,
  start = 0,
  marks = [],
  track = "rgba(127, 127, 127, 0.3)",
  fill = "currentColor",
  markColor,
}: ProgressBarProps) {
  const r = height / 2;
  // The fill is one dash on a round-capped line (inset by the cap radius so the caps end flush).
  // Unlike scaleX, this keeps the rounded ends undistorted, and pathLength={1} lets the dash be
  // given as a fraction. 4 decimals keep the head moving smoothly on long bars.
  const len = round(Math.max(0, value - start), 4);
  const at = (m: number) => round(r + m * (width - height));
  return (
    <g transform={`translate(${round(x)} ${round(y)})`}>
      <rect width={width} height={height} rx={r} fill={track} />
      <line
        x1={r}
        y1={r}
        x2={width - r}
        y2={r}
        stroke={fill}
        strokeWidth={height}
        strokeLinecap="round"
        pathLength={1}
        style={{ strokeDasharray: `${len} 2`, strokeDashoffset: round(-start, 4), opacity: len > 0 ? 1 : 0 }}
      />
      {marks.map((m, i) => (
        <circle
          key={i}
          cx={at(m)}
          cy={r}
          r={height + 1.5}
          style={{ fill: value >= m && m >= start ? fill : (markColor ?? track) }}
        />
      ))}
    </g>
  );
}

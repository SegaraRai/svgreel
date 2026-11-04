import { round } from "../animation/helpers.js";
import { useCurrentFrame } from "../timeline.js";

export interface RingsProps {
  x?: number;
  y?: number;
  /** Radius of the main ring. */
  r?: number;
  color?: string;
  /** Second color for the faint outer ring. */
  muted?: string;
  /** Degrees per frame of the main arc. Pick 360 / loop length × n for a seamless loop. */
  speed?: number;
}

/** Decorative concentric rings spinning at different speeds (a "loading" / tech motif). */
export function Rings({ x = 0, y = 0, r = 150, color = "currentColor", muted = color, speed = 1.8 }: RingsProps) {
  const frame = useCurrentFrame();
  const spin = frame * speed;
  const circ = 2 * Math.PI * r;
  return (
    <g transform={`translate(${x} ${y})`} fill="none">
      <circle r={r} stroke={color} strokeOpacity={0.25} strokeWidth={1} />
      <circle
        r={r}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={`${round(circ * 0.13)} ${round(circ * 0.87)}`}
        style={{ transform: `rotate(${round(spin - 90)}deg)` }}
      />
      <circle
        r={r * 0.85}
        stroke={color}
        strokeOpacity={0.6}
        strokeWidth={r / 15}
        strokeDasharray="2 14"
        style={{ transform: `rotate(${round(-spin / 2)}deg)` }}
      />
      <circle
        r={r * 1.17}
        stroke={muted}
        strokeOpacity={0.15}
        strokeWidth={1}
        strokeDasharray="60 40 10 40"
        style={{ transform: `rotate(${round(spin / 4)}deg)` }}
      />
    </g>
  );
}

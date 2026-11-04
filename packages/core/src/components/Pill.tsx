import { round } from "../animation/helpers.js";
import { spring } from "../animation/spring.js";
import type { TextStyle } from "../fonts.js";
import { useCurrentFrame, useVideoConfig } from "../timeline.js";
import { measureText, Text } from "./Text.js";

export interface PillProps extends TextStyle {
  text: string;
  x?: number;
  y?: number;
  height?: number;
  /** Horizontal padding in px. Defaults to height / 2.2. */
  padding?: number;
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeOpacity?: number;
  /** Text color. */
  color?: string;
}

/** Width a <Pill> with these props will take. */
export function pillWidth({
  text,
  padding,
  height = 32,
  ...ts
}: Pick<PillProps, "text" | "padding" | "height"> & TextStyle) {
  return measureText(text, ts) + 2 * (padding ?? height / 2.2);
}

/** Rounded label (tag, badge, chip) sized to its text. (x, y) is the top-left corner. */
export function Pill({
  text,
  x = 0,
  y = 0,
  height = 32,
  padding,
  fill = "none",
  fillOpacity,
  stroke,
  strokeOpacity,
  color = "currentColor",
  ...ts
}: PillProps) {
  const pad = padding ?? height / 2.2;
  const w = pillWidth({ text, padding: pad, height, ...ts });
  return (
    <g transform={`translate(${round(x)} ${round(y)})`}>
      <rect
        width={round(w)}
        height={height}
        rx={height / 2}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeOpacity={strokeOpacity}
      />
      <Text x={pad} y={height / 2} baseline="middle" fill={color} {...ts}>
        {text}
      </Text>
    </g>
  );
}

export interface PillRowProps extends Omit<PillProps, "text"> {
  items: string[];
  gap?: number;
  /** Local frame at which the first pill pops in. Omit for no animation. */
  at?: number;
  /** Frames between pills popping in. */
  stagger?: number;
}

/** A row of pills that pop in one after another. */
export function PillRow({ items, x = 0, y = 0, gap = 10, at, stagger = 4, ...pill }: PillRowProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const h = pill.height ?? 32;
  let px = 0;
  return (
    <g transform={`translate(${round(x)} ${round(y)})`}>
      {items.map((t, k) => {
        const w = pillWidth({ text: t, ...pill });
        const left = px;
        px += w + gap;
        const s =
          at === undefined ? 1 : spring({ frame: frame - at - k * stagger, fps, config: { damping: 10, mass: 0.5 } });
        return (
          <g key={k} transform={`translate(${round(left)} 0)`}>
            <g
              style={
                at === undefined
                  ? undefined
                  : {
                      opacity: round(Math.min(1, s * 3)),
                      transform: `scale(${round(Math.max(0, s))})`,
                      transformOrigin: `${round(w / 2)}px ${h / 2}px`,
                    }
              }
            >
              <Pill text={t} {...pill} />
            </g>
          </g>
        );
      })}
    </g>
  );
}

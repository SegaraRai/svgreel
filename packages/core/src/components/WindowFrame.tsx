import type { ReactNode } from "react";

import type { TextStyle } from "../fonts.js";
import { Text } from "./Text.js";

export interface WindowFrameProps {
  x?: number;
  y?: number;
  width: number;
  height: number;
  /** Title shown in the bar (needs `font`). */
  title?: string;
  /** Font for the title. */
  font?: TextStyle;
  barHeight?: number;
  radius?: number;
  background?: string;
  bar?: string;
  border?: string;
  titleColor?: string;
  /** Show the three window buttons. Default true. */
  buttons?: boolean;
  /** Content, positioned with (0, 0) at the top-left below the bar and clipped to the window. */
  children?: ReactNode;
}

/** A desktop-style window: rounded card, title bar with buttons, clipped content area. */
export function WindowFrame({
  x = 0,
  y = 0,
  width,
  height,
  title,
  font,
  barHeight = 40,
  radius = 14,
  background = "#111827",
  bar = "#1a2233",
  border = "#273042",
  titleColor = "#8b95a5",
  buttons = true,
  children,
}: WindowFrameProps) {
  const contentH = height - barHeight;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={width} height={height} rx={radius} fill={background} />
      {/* Bar: rounded on top only (a rounded rect plus a square one covering its lower corners). */}
      <rect width={width} height={barHeight} rx={radius} fill={bar} />
      <rect y={barHeight - radius} width={width} height={radius} fill={bar} />
      <line x1={0} y1={barHeight} x2={width} y2={barHeight} stroke={border} />
      {buttons &&
        ["#ff5f57", "#febc2e", "#28c840"].map((c, i) => (
          <circle key={c} cx={radius + 6 + i * 20} cy={barHeight / 2} r={6} fill={c} />
        ))}
      {title && font && (
        <Text x={width / 2} y={barHeight / 2} anchor="middle" baseline="middle" fill={titleColor} {...font}>
          {title}
        </Text>
      )}
      {/* A nested <svg> clips without needing a clipPath id. */}
      <svg y={barHeight} width={width} height={contentH} overflow="hidden">
        {children}
      </svg>
      <rect x={0.5} y={0.5} width={width - 1} height={height - 1} rx={radius} fill="none" stroke={border} />
    </g>
  );
}

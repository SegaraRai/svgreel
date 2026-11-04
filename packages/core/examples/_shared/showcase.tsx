// The frame the showcase examples share: palette, fonts, a title header and a grid of cards.
// Folders starting with "_" aren't compositions, so this one is only imported.
// When you copy an example, copy this file along with it, or inline what you use.

import type { ReactNode } from "react";
import { DotGrid, fontsource, GlowOrb, measureText, Text } from "svgreel";

export const W = 1200;
export const H = 720;
export const SANS = "Inter";
export const MONO = "JetBrains Mono";

export const C = {
  bg: "#0a0e17",
  panel: "#101624",
  raised: "#162033",
  border: "#1f2838",
  text: "#e6edf3",
  muted: "#8b95a5",
  faint: "#5b6575",
  dim: "#2a3242",
  accent: "#7aa2ff",
  warm: "#f0a66a",
  green: "#7ee2a8",
  pink: "#f38ba8",
};

/** Inter at the weights the header and cards use (pass more for your own text), plus JetBrains Mono. */
export function showcaseFonts(weights: number[] = []) {
  return [
    ...fontsource("inter", { family: SANS, weights: [...new Set([400, 600, 800, ...weights])].sort((a, b) => a - b) }),
    ...fontsource("jetbrains-mono", { family: MONO, weights: [400] }),
  ];
}

/** Card size and the grid: three columns, two rows below the header. */
export const CARD = { w: 364, h: 290, head: 46 };
const COLS = [36, 418, 800];
const ROWS = [96, 404];

/** Top-left corner of grid cell (col, row). */
export function cell(col: number, row: number) {
  return { x: COLS[col], y: ROWS[row] };
}

/** Background, dot grid, a soft glow and the title row. */
export function Backdrop({
  title,
  subtitle,
  path,
  glow,
}: {
  title: string;
  subtitle: string;
  path: string;
  glow?: ReactNode;
}) {
  const titleStyle = { family: SANS, weight: 800, size: 28, letterSpacing: -0.5 };
  return (
    <g>
      <rect width={W} height={H} fill={C.bg} />
      <DotGrid color={C.dim} />
      {glow ?? <GlowOrb color={C.accent} intensity={0.22} style={{ transform: "translate(160px, 40px)" }} />}
      <rect x={36} y={36} width={6} height={26} rx={3} fill={C.accent} />
      <Text x={54} y={60} {...titleStyle} fill={C.text}>
        {title}
      </Text>
      <Text x={54 + measureText(title, titleStyle) + 16} y={59} family={SANS} size={15} fill={C.muted}>
        {subtitle}
      </Text>
      <Text x={W - 36} y={59} anchor="end" family={MONO} size={13} fill={C.faint}>
        {path}
      </Text>
    </g>
  );
}

/**
 * A titled card. Children draw in card coordinates below the label row: (0, 0) is the content's
 * top-left, CARD.w wide and CARD.h - CARD.head tall.
 */
export function Card({
  x,
  y,
  w = CARD.w,
  h = CARD.h,
  label,
  note,
  color = C.accent,
  children,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  label: string;
  note?: string;
  color?: string;
  children: ReactNode;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx={14} fill={C.panel} stroke={C.border} />
      <circle cx={22} cy={25} r={3.5} fill={color} />
      <Text x={34} y={30} family={MONO} size={13} fill={C.text}>
        {label}
      </Text>
      {note && (
        <Text x={w - 20} y={30} anchor="end" family={SANS} size={12} fill={C.faint}>
          {note}
        </Text>
      )}
      <g transform={`translate(0 ${CARD.head})`}>{children}</g>
    </g>
  );
}

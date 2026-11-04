import type { ReactNode } from "react";

import { round } from "../animation/helpers.js";

export interface RevealProps {
  x?: number;
  y?: number;
  /** The masked area: children outside it are never visible. */
  width: number;
  height: number;
  /** 0 = hidden, 1 = fully shown. */
  progress: number;
  /** Direction the motion travels in ("up": content rises into view / the edge moves up). */
  direction?: "up" | "down" | "left" | "right";
  /**
   * "slide": the content moves into the area from outside it (the classic line-by-line text
   * reveal). "wipe": the content stays put and the area's edge sweeps across it.
   */
  mode?: "slide" | "wipe";
  /** Content, drawn with (0, 0) at the area's top-left. */
  children: ReactNode;
}

/**
 * Shows its children through a rectangular mask, either sliding them in from behind an edge or
 * wiping the mask across them. Uses nested <svg> viewports instead of a <clipPath>, so it needs
 * no ids and no animated clip geometry.
 */
export function Reveal({
  x = 0,
  y = 0,
  width,
  height,
  progress,
  direction = "up",
  mode = "slide",
  children,
}: RevealProps) {
  const p = Math.min(1, Math.max(0, progress));
  const [ux, uy] = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[direction];
  // Offset that pushes something completely out of the area against the direction of travel.
  const ox = round(ux * width * (1 - p), 4);
  const oy = round(uy * height * (1 - p), 4);
  const tr = (dx: number, dy: number) => `translate(${round(dx)}px, ${round(dy)}px)`;
  if (mode === "slide") {
    return (
      <svg x={x} y={y} width={width} height={height} overflow="hidden">
        <g style={{ transform: tr(ox, oy) }}>{children}</g>
      </svg>
    );
  }
  // Wipe: move the window one way and the content the other, so the content stays still.
  return (
    <g transform={`translate(${x} ${y})`}>
      <g style={{ transform: tr(ox, oy) }}>
        <svg width={width} height={height} overflow="hidden">
          <g style={{ transform: tr(-ox, -oy) }}>{children}</g>
        </svg>
      </g>
    </g>
  );
}

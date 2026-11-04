import type { ReactNode } from "react";

import { round } from "../animation/helpers.js";
import { pointOnPath } from "../animation/path.js";

export interface FollowPathProps {
  /** Path data to travel along (it isn't drawn; draw it yourself or with <DrawPath>). */
  d: string;
  /** Position along the path, 0 → 1 of its length. Values outside are clamped. */
  progress: number;
  /** Turn the children to face the direction of travel. */
  rotate?: boolean;
  /** Extra rotation in degrees (e.g. for an icon drawn pointing up: 90). */
  angleOffset?: number;
  /** What travels, drawn centred on (0, 0). */
  children: ReactNode;
}

/** Moves its children along a path, optionally turning them to face where they are going. */
export function FollowPath({ d, progress, rotate = false, angleOffset = 0, children }: FollowPathProps) {
  const p = pointOnPath(d, progress);
  const turn = rotate ? ` rotate(${round(p.angle + angleOffset, 1)}deg)` : "";
  return <g style={{ transform: `translate(${round(p.x)}px, ${round(p.y)}px)${turn}` }}>{children}</g>;
}

import type { ReactNode } from "react";

import { Easing, type EasingFn } from "../animation/easing.js";
import { round, tween } from "../animation/helpers.js";
import { useCurrentFrame, useVideoConfig } from "../timeline.js";

/** A region of the scene: [x, y, width, height]. */
export type Rect = readonly [number, number, number, number];

export interface Shot {
  /** Local frame at which the camera starts moving to this shot (the first shot holds from 0). */
  at: number;
  /** Region to frame; it is fitted into the viewport, keeping its aspect ratio. */
  rect: Rect;
}

/**
 * CSS transform that fits `rect` into a `viewport`-sized frame, centred. Pair with
 * `transformOrigin: "0px 0px"`.
 */
export function cameraTransform(rect: Rect, viewport: readonly [number, number]): string {
  const [x, y, w, h] = rect;
  const s = Math.min(viewport[0] / w, viewport[1] / h);
  const tx = viewport[0] / 2 - s * (x + w / 2);
  const ty = viewport[1] / 2 - s * (y + h / 2);
  return `translate(${round(tx)}px, ${round(ty)}px) scale(${round(s, 4)})`;
}

/**
 * The framed region at `frame`. Between shots the centre moves with the easing while the zoom is
 * interpolated on a log scale, so a 4× zoom feels as even as a 2× one, and the centre and zoom
 * stay in step (interpolating translate and scale separately makes the view swing).
 */
export function cameraRect(
  frame: number,
  shots: Shot[],
  duration = 30,
  easing: EasingFn = Easing.inOut(Easing.cubic),
): Rect {
  let rect = shots[0].rect;
  for (const shot of shots.slice(1)) {
    const t = tween(frame, [shot.at, shot.at + duration], [0, 1], easing);
    if (t <= 0) {
      break;
    }
    if (t >= 1) {
      rect = shot.rect;
      continue;
    }
    const [ax, ay, aw, ah] = rect;
    const [bx, by, bw, bh] = shot.rect;
    const cx = ax + aw / 2 + (bx + bw / 2 - ax - aw / 2) * t;
    const cy = ay + ah / 2 + (by + bh / 2 - ay - ah / 2) * t;
    const logLerp = (a: number, b: number) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
    const w = logLerp(aw, bw);
    const h = logLerp(ah, bh);
    rect = [cx - w / 2, cy - h / 2, w, h];
  }
  return rect;
}

export interface CameraProps {
  /** Shots in order of `at`. Without shots the scene is shown as is. */
  shots: Shot[];
  /** Frames for each move between shots. */
  duration?: number;
  easing?: EasingFn;
  /** Viewport size; defaults to the composition's size. */
  width?: number;
  height?: number;
  /** The scene, in its own coordinates. */
  children: ReactNode;
}

/** Pans and zooms over its children, moving between framed regions ("shots"). */
export function Camera({ shots, duration = 30, easing, width, height, children }: CameraProps) {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const viewport = [width ?? config.width, height ?? config.height] as const;
  const rect = shots.length ? cameraRect(frame, shots, duration, easing) : ([0, 0, ...viewport] as const);
  return <g style={{ transform: cameraTransform(rect, viewport), transformOrigin: "0px 0px" }}>{children}</g>;
}

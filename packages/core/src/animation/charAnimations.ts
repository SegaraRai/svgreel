import type { CSSProperties } from "react";

import type { CharInfo } from "../components/Text.js";
import { round } from "./helpers.js";
import { interpolate } from "./interpolate.js";
import { spring, type SpringConfig } from "./spring.js";

type CharStyle = (c: CharInfo) => CSSProperties;

interface Base {
  /** Current (local) frame, from useCurrentFrame(). */
  frame: number;
  fps: number;
  /** Frame at which the first glyph starts. */
  delay?: number;
  /** Frames between consecutive glyphs. */
  stagger?: number;
  config?: Partial<SpringConfig>;
}

const sp = (b: Base, index: number, config: Partial<SpringConfig>) =>
  spring({
    frame: b.frame - (b.delay ?? 0) - index * (b.stagger ?? 2),
    fps: b.fps,
    config: { ...config, ...b.config },
  });

/**
 * Ready-made `charStyle` functions for <Text>:
 *
 *   <Text charStyle={charAnimations.rise({ frame, fps, delay: 10 })} … />
 */
export const charAnimations = {
  /** Glyphs fade in one after another. */
  fade:
    (b: Base & { duration?: number }): CharStyle =>
    ({ index }) => {
      const start = (b.delay ?? 0) + index * (b.stagger ?? 2);
      return {
        opacity: round(
          interpolate(b.frame, [start, start + (b.duration ?? 10)], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        ),
      };
    },

  /** Glyphs spring up from below (negative distance: from above). */
  rise:
    (b: Base & { distance?: number; rotate?: number }): CharStyle =>
    ({ index }) => {
      const s = sp(b, index, { damping: 12, mass: 0.6 });
      const rot = b.rotate ? ` rotate(${round((1 - s) * b.rotate)}deg)` : "";
      return {
        opacity: round(Math.min(1, s * 2)),
        transform: `translate(0px, ${round((1 - s) * (b.distance ?? 60))}px)${rot}`,
      };
    },

  /** Glyphs scale up from nothing around their own centre. */
  pop:
    (b: Base): CharStyle =>
    ({ index, advance, size }) => {
      const s = sp(b, index, { damping: 10, mass: 0.5 });
      return {
        opacity: round(Math.min(1, s * 3)),
        transform: `scale(${round(Math.max(0, s))})`,
        transformOrigin: `${round(advance / 2)}px ${round(-size * 0.35)}px`,
      };
    },

  /** Glyphs slide in from the side while growing (negative distance: from the left). */
  slide:
    (b: Base & { distance?: number }): CharStyle =>
    ({ index }) => {
      const s = sp(b, index, { damping: 12, mass: 0.5 });
      return {
        opacity: round(Math.min(1, s * 2)),
        transform: `translate(${round((1 - s) * (b.distance ?? 40))}px, 0px) scale(${round(0.4 + s * 0.6)})`,
      };
    },

  /**
   * Continuous wave. `period` frames per cycle; pick a divisor of the loop length so it repeats
   * seamlessly. `from` delays the start (amplitude ramps in).
   */
  wave:
    (b: Omit<Base, "fps"> & { amplitude?: number; period?: number; from?: number }): CharStyle =>
    ({ index }) => {
      const local = b.frame - (b.from ?? 0);
      if (local <= 0) {
        return { transform: "translate(0px, 0px)" };
      }
      const ramp = Math.min(1, local / 15);
      const phase = (local / (b.period ?? 60)) * Math.PI * 2 - index * ((b.stagger ?? 2) / 4);
      return { transform: `translate(0px, ${round(Math.sin(phase) * (b.amplitude ?? 6) * ramp)}px)` };
    },

  /** Glyphs appear one per `stagger` frames (hard cut) and optionally disappear from the end. */
  type:
    (b: Omit<Base, "fps" | "config"> & { eraseAt?: number }): CharStyle =>
    ({ index, count }) => {
      const st = b.stagger ?? 2;
      const on = b.frame >= (b.delay ?? 0) + index * st;
      const off = b.eraseAt !== undefined && b.frame >= b.eraseAt + (count - 1 - index) * Math.max(1, st / 2);
      return { opacity: on && !off ? 1 : 0 };
    },
};

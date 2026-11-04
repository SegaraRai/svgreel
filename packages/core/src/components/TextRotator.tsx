import { Easing, type EasingFn } from "../animation/easing.js";
import { round } from "../animation/helpers.js";
import type { TextStyle } from "../fonts.js";
import { useCurrentFrame } from "../timeline.js";
import { measureText, Text } from "./Text.js";

export interface RotatorTiming {
  /** Local frame at which the first word starts showing. */
  start?: number;
  /** Frames each word stays fully shown. */
  hold?: number;
  /** Frames of each change. */
  transition?: number;
  easing?: EasingFn;
}

/**
 * Which word is showing at `frame`: `from` → `to` with `t` going 0 → 1 during a change (t is 0
 * while a word holds). The cycle repeats every `count × (hold + transition)` frames, so it loops
 * cleanly when the composition's length is a multiple of that.
 */
export function rotatorState(
  frame: number,
  count: number,
  { start = 0, hold = 45, transition = 15, easing = Easing.inOut(Easing.cubic) }: RotatorTiming = {},
): { from: number; to: number; t: number } {
  const slot = hold + transition;
  const f = Math.max(0, frame - start);
  const pos = f % (slot * count);
  const from = Math.floor(pos / slot);
  const into = pos - from * slot;
  const t = count > 1 && into > hold ? easing((into - hold) / transition) : 0;
  return { from, to: (from + 1) % count, t };
}

/**
 * Width of the rotating word at `frame`, eased between the two words during a change. Use it to
 * place text that follows the word, so the sentence closes up around it.
 */
export function textRotatorWidth(frame: number, words: string[], style: TextStyle, timing?: RotatorTiming): number {
  const { from, to, t } = rotatorState(frame, words.length, timing);
  return measureText(words[from], style) * (1 - t) + measureText(words[to], style) * t;
}

export interface TextRotatorProps extends TextStyle, RotatorTiming {
  words: string[];
  x?: number;
  y?: number;
  anchor?: "start" | "middle" | "end";
  fill?: string;
  /** "slide": the old word rises out and the new one rises in, clipped to the line. */
  effect?: "fade" | "slide";
  /** Travel for "slide", in px. Defaults to the font size. */
  distance?: number;
}

/**
 * A word (or phrase) that cycles through `words` in place: "I build [tools | games | sites]".
 *
 * Every word is rendered on every frame (text content can't animate) and cross-faded. For text
 * after the word, measure it with `textRotatorWidth()` and move it with `style.transform`.
 */
export function TextRotator({
  words,
  x = 0,
  y = 0,
  anchor = "start",
  fill = "currentColor",
  effect = "slide",
  distance,
  start,
  hold,
  transition,
  easing,
  ...ts
}: TextRotatorProps) {
  const frame = useCurrentFrame();
  const { from, to, t } = rotatorState(frame, words.length, { start, hold, transition, easing });
  const d = distance ?? ts.size;
  const widest = Math.max(...words.map((w) => measureText(w, ts)));
  const left = anchor === "middle" ? x - widest / 2 : anchor === "end" ? x - widest : x;
  const top = y - ts.size * 1.1;
  const body = words.map((w, i) => {
    const opacity = i === from ? 1 - t : i === to ? t : 0;
    const dy = effect === "slide" ? (i === from ? -t * d : i === to ? (1 - t) * d : 0) : 0;
    return (
      <Text
        key={i}
        x={x - left}
        y={y - top}
        anchor={anchor}
        fill={fill}
        {...ts}
        style={{ opacity: round(opacity, 3), transform: `translateY(${round(dy)}px)` }}
      >
        {w}
      </Text>
    );
  });
  // A nested <svg> clips the sliding words to the line without a clipPath id.
  return (
    <svg x={round(left)} y={round(top)} width={round(widest + ts.size)} height={round(ts.size * 1.5)} overflow="hidden">
      {body}
    </svg>
  );
}

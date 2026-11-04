import { blink, round, typedChars } from "../animation/helpers.js";
import type { TextStyle } from "../fonts.js";
import { useCurrentFrame } from "../timeline.js";
import { measureText, Text } from "./Text.js";

export interface TypewriterProps extends TextStyle {
  /** Single line of text. */
  text: string;
  x?: number;
  y?: number;
  fill?: string;
  /** Local frame at which typing starts. */
  start?: number;
  /** Frames per character. */
  speed?: number;
  /** Local frame at which it starts backspacing (omit to keep the text). */
  eraseAt?: number;
  /** Show a blinking block caret. Default true. */
  caret?: boolean;
  caretColor?: string;
}

/** Text typed in character by character, with an optional caret and backspace. */
export function Typewriter({
  text,
  x = 0,
  y = 0,
  fill,
  start = 0,
  speed = 2,
  eraseAt,
  caret = true,
  caretColor,
  ...ts
}: TypewriterProps) {
  const frame = useCurrentFrame();
  const chars = [...text];
  const eraseSpeed = Math.max(1, speed / 2);
  const typed = Math.min(chars.length, Math.max(0, typedChars(frame - start, speed) + 1));
  const erased =
    eraseAt === undefined ? 0 : Math.min(chars.length, Math.max(0, Math.floor((frame - eraseAt) / eraseSpeed) + 1));
  const shown = frame < start ? 0 : Math.max(0, typed - erased);
  const typedText = chars.slice(0, shown).join("");
  const caretX = measureText(typedText, ts);
  const busy =
    frame >= start && (typed < chars.length || (eraseAt !== undefined && frame >= eraseAt && erased < chars.length));
  return (
    <g transform={`translate(${round(x)} ${round(y)})`}>
      <Text {...ts} fill={fill} charStyle={({ offset }) => ({ opacity: offset < typedText.length ? 1 : 0 })}>
        {text}
      </Text>
      {caret && (
        <rect
          x={2}
          y={round(-ts.size * 0.8)}
          width={round(Math.max(2, ts.size * 0.08))}
          height={round(ts.size * 0.95)}
          fill={caretColor ?? fill ?? "currentColor"}
          style={{ opacity: busy ? 1 : blink(frame), transform: `translateX(${round(caretX)}px)` }}
        />
      )}
    </g>
  );
}

import { blink, round, tween, typedChars } from "../animation/helpers.js";
import type { TextStyle } from "../fonts.js";
import { useCurrentFrame } from "../timeline.js";
import { measureText, Text } from "./Text.js";
import { windowChrome, WindowFrame, type WindowFrameProps } from "./WindowFrame.js";

export interface TerminalTheme {
  background: string;
  bar: string;
  border: string;
  /** Commands and default output. */
  text: string;
  prompt: string;
  /** Caret. */
  accent: string;
  title: string;
}

/** A typed command, or a line of output that appears at once. */
export type TerminalLine = { command: string } | { output: string; color?: string };

export interface TerminalTiming {
  /** Local frame at which the first line starts. */
  start?: number;
  /** Frames per typed character (0.5 = 2 characters per frame). */
  speed?: number;
  /** Frames between the end of a command and its first output line. */
  commandPause?: number;
  /** Frames between output lines. */
  outputSpeed?: number;
}

/** When each line starts (and, for commands, finishes typing). */
export function terminalTimeline(
  lines: TerminalLine[],
  { start = 0, speed = 1.5, commandPause = 10, outputSpeed = 3 }: TerminalTiming = {},
): { start: number; end: number }[] {
  let t = start;
  return lines.map((line) => {
    const s = t;
    if ("command" in line) {
      const end = s + [...line.command].length * speed;
      t = end + commandPause;
      return { start: s, end };
    }
    t = s + outputSpeed;
    return { start: s, end: s };
  });
}

export interface TerminalProps
  extends TerminalTiming, Pick<WindowFrameProps, "preset" | "controls" | "controlsSide" | "titleAlign"> {
  lines: TerminalLine[];
  x?: number;
  y?: number;
  width: number;
  height: number;
  /** A monospace font. */
  font: TextStyle;
  theme: TerminalTheme;
  title?: string;
  prompt?: string;
  lineHeight?: number;
  padding?: number;
  caret?: boolean;
}

/**
 * Terminal window replaying a session: commands are typed, their output appears line by line,
 * and the content scrolls up once it fills the window.
 */
export function Terminal({
  lines,
  x = 0,
  y = 0,
  width,
  height,
  font,
  theme,
  title,
  prompt = "$",
  lineHeight = font.size * 1.6,
  padding = 16,
  caret = true,
  preset,
  controls,
  controlsSide,
  titleAlign,
  ...timing
}: TerminalProps) {
  const frame = useCurrentFrame();
  const bar = windowChrome({ preset }).barHeight;
  const times = terminalTimeline(lines, timing);
  const speed = timing.speed ?? 1.5;
  const promptW = measureText(`${prompt} `, font);
  const rows = Math.max(1, Math.floor((height - bar - 2 * padding) / lineHeight));
  const baseline = (k: number) => padding + font.size + k * lineHeight;
  // Each line past the last visible row scrolls the content up by one line as it appears.
  const scroll = times.reduce(
    (sum, tm, k) => (k >= rows ? sum + tween(frame, [tm.start, tm.start + 4], [0, lineHeight]) : sum),
    0,
  );

  // Caret: on the command being typed, or after the latest started command.
  let caretRow = -1;
  times.forEach((tm, k) => {
    if ("command" in lines[k] && frame >= tm.start) {
      caretRow = k;
    }
  });
  const typing = caretRow >= 0 && frame < times[caretRow].end;
  const caretText = caretRow >= 0 ? (lines[caretRow] as { command: string }).command : "";
  const typed = typing ? typedChars(frame - times[caretRow].start, speed) : [...caretText].length;
  const caretX = promptW + measureText([...caretText].slice(0, typed).join(""), font);
  const caretOn = caret && caretRow >= 0 && (typing || blink(frame) === 1);

  return (
    <WindowFrame
      x={x}
      y={y}
      width={width}
      height={height}
      title={title}
      font={font}
      preset={preset}
      controls={controls}
      controlsSide={controlsSide}
      titleAlign={titleAlign}
      background={theme.background}
      bar={theme.bar}
      border={theme.border}
      titleColor={theme.title}
    >
      <g transform={`translate(${padding} 0)`}>
        <g style={{ transform: `translateY(${round(-scroll)}px)` }}>
          {lines.map((line, k) => {
            const tm = times[k];
            const shown = frame >= tm.start ? 1 : 0;
            if (!("command" in line)) {
              return (
                <g key={k} style={{ opacity: shown }}>
                  {line.output.trim() !== "" && (
                    <Text y={baseline(k)} {...font} fill={line.color ?? theme.text}>
                      {line.output}
                    </Text>
                  )}
                </g>
              );
            }
            const w = measureText(line.command, font);
            const prog = tween(frame, [tm.start, Math.max(tm.end, tm.start + 1)], [0, 1], (v) => v);
            return (
              <g key={k} style={{ opacity: shown }}>
                <Text y={baseline(k)} {...font} fill={theme.prompt}>
                  {prompt}
                </Text>
                <Text x={promptW} y={baseline(k)} {...font} fill={theme.text}>
                  {line.command}
                </Text>
                {/* A cover in the background color slides right as the command is typed. */}
                <rect
                  x={promptW - 1}
                  y={round(baseline(k) - lineHeight * 0.75)}
                  width={width}
                  height={lineHeight}
                  fill={theme.background}
                  style={{ transform: `translateX(${round(prog * (w + 2))}px)` }}
                />
              </g>
            );
          })}
          <rect
            width={round(font.size * 0.6)}
            height={round(font.size * 1.2)}
            fill={theme.accent}
            style={{
              opacity: caretOn ? 0.85 : 0,
              transform: `translate(${round(caretX)}px, ${round(baseline(Math.max(0, caretRow)) - font.size)}px)`,
            }}
          />
        </g>
      </g>
    </WindowFrame>
  );
}

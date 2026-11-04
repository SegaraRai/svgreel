import { round as r } from "../animation/helpers.js";
import { spring } from "../animation/spring.js";
import { EM, layoutLine, type TextStyle } from "../fonts.js";
import { useCurrentFrame, useVideoConfig } from "../timeline.js";

export interface SlotCounterProps {
  /** e.g. "1,284" or "12k+": digits roll, other characters stay put. */
  value: string;
  x?: number;
  y?: number;
  family: string | string[];
  weight?: number;
  size: number;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  /** Local frame at which rolling starts. */
  delay?: number;
  /** Frames between consecutive digits starting (rightmost first). */
  stagger?: number;
  /** Full extra turns before landing. */
  turns?: number;
}

/** Width a <SlotCounter> with this value and font will take (digits use equal-width cells). */
export function slotCounterWidth(value: string, ts: TextStyle): number {
  const cellW = Math.max(...[..."0123456789"].map((d) => layoutLine(d, ts).glyphs[0].advance));
  return [...value].reduce((w, c) => w + (/\d/.test(c) ? cellW : layoutLine(c, ts).width), 0);
}

/** Slot-machine style number: each digit is a clipped column of outlined 0–9 glyphs. */
export function SlotCounter({
  value,
  x = 0,
  y = 0,
  family,
  weight,
  size,
  fill = "currentColor",
  anchor = "start",
  delay = 0,
  stagger = 4,
  turns = 1,
}: SlotCounterProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ts: TextStyle = { family, weight, size };
  const digitGlyphs = [..."0123456789"].map((d) => layoutLine(d, ts).glyphs[0]);
  const cellW = Math.max(...digitGlyphs.map((g) => g.advance));
  const cellH = size * 1.2;
  const scale = `scale(${Math.round((size / EM) * 10000) / 10000})`;
  const chars = [...value];
  const widths = chars.map((c) => (/\d/.test(c) ? cellW : layoutLine(c, ts).width));
  const total = widths.reduce((a, b) => a + b, 0);
  const x0 = anchor === "middle" ? -total / 2 : anchor === "end" ? -total : 0;

  const digitCount = chars.filter((c) => /\d/.test(c)).length;
  let digitIndex = 0;
  let pen = x0;
  const cells = chars.map((c, i) => {
    const cx = pen;
    pen += widths[i];
    if (!/\d/.test(c)) {
      const l = layoutLine(c, ts);
      return (
        <g key={i} transform={`translate(${r(cx)} 0)`}>
          {l.glyphs
            .filter((g) => g.d)
            .map((g, k) => (
              <path key={k} d={g.d} transform={`translate(${r(g.x)} 0) ${scale}`} />
            ))}
        </g>
      );
    }
    const order = digitCount - 1 - digitIndex++;
    const target = turns * 10 + Number(c);
    const p = spring({ frame: frame - delay - order * stagger, fps, config: { damping: 18, mass: 0.9 } });
    const offset = -p * target * cellH;
    // Column of digits; the nested <svg> clips it to one cell without needing ids.
    return (
      <svg key={i} x={r(cx)} y={r(-size)} width={r(cellW)} height={r(cellH)} overflow="hidden">
        <g style={{ transform: `translateY(${r(offset)}px)` }}>
          {Array.from({ length: target + 1 }, (_, k) => {
            const g = digitGlyphs[k % 10];
            return (
              <path
                key={k}
                d={g.d}
                transform={`translate(${r((cellW - g.advance) / 2)} ${r(size + k * cellH)}) ${scale}`}
              />
            );
          })}
        </g>
      </svg>
    );
  });

  return (
    <g transform={`translate(${x} ${y})`} fill={fill}>
      {cells}
    </g>
  );
}

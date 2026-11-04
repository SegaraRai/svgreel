import { Fragment, type ReactNode } from "react";

import type { TextStyle } from "../fonts.js";
import { useDirection, type Direction } from "../timeline.js";
import { Text } from "./Text.js";

/** Window buttons drawn in the title bar. */
export type WindowControls =
  /** Red, yellow and green circles (macOS). */
  | "traffic-lights"
  /** Three circles in `controlColor`. */
  | "dots"
  /** Minimize, maximize and close glyphs (Windows). */
  | "glyphs"
  /** One close button: a × on a faint circle (GNOME). */
  | "close"
  | "none";

/** Title alignment: "start" and "end" follow `useDirection()`, "left" and "right" don't. */
export type WindowTitleAlign = "start" | "center" | "end" | "left" | "right";

export type WindowPreset = "macos" | "windows" | "gnome" | "plain";

interface Chrome {
  controls: WindowControls;
  controlsSide: "start" | "end";
  titleAlign: WindowTitleAlign;
  barHeight: number;
  radius: number;
}

const PRESETS: Record<WindowPreset, Chrome> = {
  macos: { controls: "traffic-lights", controlsSide: "start", titleAlign: "center", barHeight: 40, radius: 14 },
  windows: { controls: "glyphs", controlsSide: "end", titleAlign: "start", barHeight: 32, radius: 8 },
  gnome: { controls: "close", controlsSide: "end", titleAlign: "center", barHeight: 40, radius: 12 },
  plain: { controls: "none", controlsSide: "end", titleAlign: "center", barHeight: 40, radius: 14 },
};

export interface WindowFrameProps {
  x?: number;
  y?: number;
  width: number;
  height: number;
  /** Title shown in the bar (needs `font`). */
  title?: string;
  /** Font for the title. */
  font?: TextStyle;
  /**
   * Starting point for `controls`, `controlsSide`, `titleAlign`, `barHeight` and `radius`; any
   * of them given as a prop wins. Default "macos".
   */
  preset?: WindowPreset;
  /** Buttons in the bar. */
  controls?: WindowControls;
  /** Side of the bar the buttons sit on, following `useDirection()`. */
  controlsSide?: "start" | "end";
  titleAlign?: WindowTitleAlign;
  barHeight?: number;
  radius?: number;
  background?: string;
  bar?: string;
  border?: string;
  titleColor?: string;
  /** Color of "dots", "glyphs" and "close" buttons. Defaults to `titleColor`. */
  controlColor?: string;
  /** @deprecated Use `controls="none"`. `false` hides the buttons. */
  buttons?: boolean;
  /** Content, positioned with (0, 0) at the top-left below the bar and clipped to the window. */
  children?: ReactNode;
}

/** The preset merged with the props that override it. Internal (used by `<Terminal>`). */
export function windowChrome(props: Partial<Chrome> & { preset?: WindowPreset; buttons?: boolean }): Chrome {
  const base = PRESETS[props.preset ?? "macos"];
  return {
    controls: props.buttons === false ? "none" : (props.controls ?? base.controls),
    controlsSide: props.controlsSide ?? base.controlsSide,
    titleAlign: props.titleAlign ?? base.titleAlign,
    barHeight: props.barHeight ?? base.barHeight,
    radius: props.radius ?? base.radius,
  };
}

interface Button {
  width: number;
  draw: (cx: number, cy: number) => ReactNode;
}

/** The buttons of a control style, outermost first, and the gap between them and the window edge. */
function buttonSet(controls: WindowControls, chrome: Chrome, color: string): { inset: number; buttons: Button[] } {
  const { barHeight, radius } = chrome;
  const circles = (fills: string[]) => ({
    inset: Math.max(radius - 4, 8),
    buttons: fills.map((fill) => ({
      width: 20,
      draw: (cx: number, cy: number) => <circle cx={cx} cy={cy} r={6} fill={fill} />,
    })),
  });
  switch (controls) {
    case "traffic-lights":
      return circles(["#ff5f57", "#febc2e", "#28c840"]);
    case "dots":
      return circles([color, color, color]);
    case "glyphs": {
      const width = Math.round(barHeight * 1.44);
      // 10 × 10 glyphs drawn from their top-left corner.
      const glyph = (rest: string) => (cx: number, cy: number) => (
        <path d={`M${cx - 5} ${cy - 5}${rest}`} fill="none" stroke={color} />
      );
      return {
        inset: 0,
        buttons: [
          { width, draw: glyph("l10 10m0 -10l-10 10") }, // close
          { width, draw: glyph("h10v10h-10z") }, // maximize
          { width, draw: glyph("m0 5.5h10") }, // minimize
        ],
      };
    }
    case "close": {
      const r = Math.round(barHeight * 0.3);
      return {
        inset: 10,
        buttons: [
          {
            width: 2 * r,
            draw: (cx, cy) => (
              <g>
                <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.18} />
                <path d={`M${cx - 4} ${cy - 4}l8 8m0 -8l-8 8`} fill="none" stroke={color} strokeWidth={1.5} />
              </g>
            ),
          },
        ],
      };
    }
    case "none":
      return { inset: 0, buttons: [] };
  }
}

const physical = (side: "start" | "end", dir: Direction): "left" | "right" =>
  (side === "start") === (dir === "ltr") ? "left" : "right";

/**
 * A desktop-style window: rounded card, title bar with buttons, clipped content area. `preset`
 * picks the look (macOS by default); "start" and "end" sides follow `useDirection()`.
 */
export function WindowFrame({
  x = 0,
  y = 0,
  width,
  height,
  title,
  font,
  preset,
  controls,
  controlsSide,
  titleAlign,
  barHeight,
  radius,
  background = "#111827",
  bar = "#1a2233",
  border = "#273042",
  titleColor = "#8b95a5",
  controlColor = titleColor,
  buttons,
  children,
}: WindowFrameProps) {
  const dir = useDirection();
  const chrome = windowChrome({ preset, controls, controlsSide, titleAlign, barHeight, radius, buttons });
  const bh = chrome.barHeight;
  const r = chrome.radius;
  const set = buttonSet(chrome.controls, chrome, controlColor);
  const buttonsSide = physical(chrome.controlsSide, dir);
  // Buttons are laid out from the window edge inward, so RTL mirrors their order too.
  let offset = set.inset;
  const drawn = set.buttons.map((b, i) => {
    const fromEdge = offset + b.width / 2;
    offset += b.width;
    return <Fragment key={i}>{b.draw(buttonsSide === "left" ? fromEdge : width - fromEdge, bh / 2)}</Fragment>;
  });
  const buttonsWidth = set.buttons.length > 0 ? offset : 0;

  const align =
    chrome.titleAlign === "start" || chrome.titleAlign === "end" ? physical(chrome.titleAlign, dir) : chrome.titleAlign;
  const pad = 16;
  const titleX =
    align === "center"
      ? width / 2
      : align === "left"
        ? (buttonsSide === "left" ? buttonsWidth : 0) + pad
        : width - (buttonsSide === "right" ? buttonsWidth : 0) - pad;
  const anchor = align === "center" ? "middle" : align === "left" ? "start" : "end";

  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={width} height={height} rx={r} fill={background} />
      {/* Bar: rounded on top only (a rounded rect plus a square one covering its lower corners). */}
      <rect width={width} height={bh} rx={r} fill={bar} />
      <rect y={bh - r} width={width} height={r} fill={bar} />
      <line x1={0} y1={bh} x2={width} y2={bh} stroke={border} />
      {drawn}
      {title && font && (
        <Text x={titleX} y={bh / 2} anchor={anchor} baseline="middle" fill={titleColor} {...font}>
          {title}
        </Text>
      )}
      {/* A nested <svg> clips without needing a clipPath id. */}
      <svg y={bh} width={width} height={height - bh} overflow="hidden">
        {children}
      </svg>
      <rect x={0.5} y={0.5} width={width - 1} height={height - 1} rx={r} fill="none" stroke={border} />
    </g>
  );
}
